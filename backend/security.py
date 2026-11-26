import os
import re
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError, InvalidHashError
from fastapi import Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session

from .database import BASE_DIR, IS_VERCEL, get_db
from .models import SecurityEvent, User

# Argon2id password hasher (OWASP recommended)
_ph = PasswordHasher(time_cost=2, memory_cost=65536, parallelism=2)

SESSION_COOKIE_NAME = "skipsense_session"
CSRF_COOKIE_NAME = "skipsense_csrf"
JWT_ALGORITHM = "HS256"
TOKEN_EXPIRE_HOURS = 24
MAX_FAILED_ATTEMPTS = 5
LOCKOUT_MINUTES = 15

COMMON_WEAK_PASSWORDS = {
    "password", "12345678", "password123", "qwerty123", "admin123",
    "letmein1!", "welcome1!", "skipsense", "changeme1!", "1234567890",
}

# Compiled regex patterns to detect automated attack probes (SQLi, XSS, Path Traversal, Scanner)
THREAT_PATTERNS = [
    ("INJECTION_PROBE", "HIGH", re.compile(r"(union\s+select|select\s+.*\s+from|drop\s+table|;\s*delete\s+|'\s*or\s*['1]=['1]|--\s*$)", re.IGNORECASE)),
    ("INJECTION_PROBE", "HIGH", re.compile(r"(<script\b|javascript:|onerror\s*=|onload\s*=|<iframe\b)", re.IGNORECASE)),
    ("PATH_SCAN_PROBE", "HIGH", re.compile(r"(\.\./|\.\.\\|/etc/passwd|cmd\.exe|powershell)", re.IGNORECASE)),
]

SCANNER_PATHS = (
    "/.env", "/.git", "/wp-admin", "/wp-login", "/phpmyadmin", "/admin.php",
    "/xmlrpc.php", "/actuator", "/config.json", "/.aws",
)


def _load_or_create_jwt_secret() -> str:
    env_secret = os.getenv("JWT_SECRET") or os.getenv("SECRET_KEY")
    if env_secret and len(env_secret) >= 32:
        return env_secret

    if IS_VERCEL:
        # Fallback ephemeral CSPRNG secret if JWT_SECRET env var wasn't added yet
        return secrets.token_urlsafe(48)

    secret_file = os.path.join(BASE_DIR, "data", ".jwt_secret")
    os.makedirs(os.path.dirname(secret_file), exist_ok=True)
    if os.path.exists(secret_file):
        with open(secret_file, "r", encoding="utf-8") as f:
            cached = f.read().strip()
            if len(cached) >= 32:
                return cached

    new_secret = secrets.token_urlsafe(48)
    with open(secret_file, "w", encoding="utf-8") as f:
        f.write(new_secret)
    return new_secret


JWT_SECRET = _load_or_create_jwt_secret()


def hash_password(password: str) -> str:
    return _ph.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return _ph.verify(password_hash, password)
    except (VerifyMismatchError, InvalidHashError):
        return False


def validate_password_strength(password: str) -> Optional[str]:
    if len(password) < 8:
        return "Password must be at least 8 characters long."
    if len(password) > 128:
        return "Password must not exceed 128 characters."
    if password.lower() in COMMON_WEAK_PASSWORDS:
        return "Password is too common. Choose a stronger password."
    if not re.search(r"[A-Z]", password):
        return "Password must contain at least one uppercase letter."
    if not re.search(r"[a-z]", password):
        return "Password must contain at least one lowercase letter."
    if not re.search(r"\d", password):
        return "Password must contain at least one number."
    if not re.search(r"[^A-Za-z0-9]", password):
        return "Password must contain at least one special character (e.g. !@#$%)."
    return None


def sanitize_log_text(val: str, max_len: int = 240) -> str:
    cleaned = re.sub(r"[\r\n\t]+", " ", str(val or "")).strip()
    return cleaned[:max_len]


def get_client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        first_ip = forwarded.split(",")[0].strip()
        return sanitize_log_text(first_ip, 64)
    real_ip = request.headers.get("x-real-ip")
    if real_ip:
        return sanitize_log_text(real_ip, 64)
    if request.client and request.client.host:
        return sanitize_log_text(request.client.host, 64)
    return "unknown"


def create_access_token(user: User) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user.id),
        "role": user.role,
        "tv": user.token_version,
        "jti": secrets.token_hex(12),
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(hours=TOKEN_EXPIRE_HOURS)).timestamp()),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_access_token(token: str) -> dict:
    return jwt.decode(
        token,
        JWT_SECRET,
        algorithms=[JWT_ALGORITHM],
        options={"require": ["sub", "exp", "iat", "tv", "role"]},
    )


def _is_secure_request(request: Request) -> bool:
    proto = request.headers.get("x-forwarded-proto", request.url.scheme)
    return proto == "https" or IS_VERCEL


def set_auth_cookies(response: Response, request: Request, user: User) -> str:
    token = create_access_token(user)
    csrf_token = secrets.token_urlsafe(32)
    secure = _is_secure_request(request)

    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=token,
        httponly=True,
        samesite="lax",
        secure=secure,
        max_age=TOKEN_EXPIRE_HOURS * 3600,
        path="/",
    )
    response.set_cookie(
        key=CSRF_COOKIE_NAME,
        value=csrf_token,
        httponly=False,  # Readable by SPA JS to mirror in X-CSRF-Token header
        samesite="lax",
        secure=secure,
        max_age=TOKEN_EXPIRE_HOURS * 3600,
        path="/",
    )
    return csrf_token


def clear_auth_cookies(response: Response):
    response.delete_cookie(SESSION_COOKIE_NAME, path="/")
    response.delete_cookie(CSRF_COOKIE_NAME, path="/")


def log_security_event(
    db: Session,
    *,
    event_type: str,
    severity: str,
    ip_address: str,
    user_agent: str = "",
    target_user_id: Optional[int] = None,
    target_email: Optional[str] = None,
    endpoint: str = "",
    details: str = "",
    resolved: bool = False,
) -> SecurityEvent:
    event = SecurityEvent(
        event_type=sanitize_log_text(event_type, 60),
        severity=severity if severity in {"LOW", "MEDIUM", "HIGH", "CRITICAL"} else "MEDIUM",
        ip_address=sanitize_log_text(ip_address, 64),
        user_agent=sanitize_log_text(user_agent, 255),
        target_user_id=target_user_id,
        target_email=sanitize_log_text(target_email, 255) if target_email else None,
        endpoint=sanitize_log_text(endpoint, 160),
        details=sanitize_log_text(details, 500),
        resolved=resolved,
        created_at=datetime.now(timezone.utc).isoformat(),
    )
    db.add(event)
    db.commit()
    db.refresh(event)
    return event


def check_ip_rate_limit(
    db: Session,
    ip_address: str,
    event_types: tuple[str, ...],
    max_events: int,
    window_minutes: int = 10,
) -> bool:
    """
    Database-backed sliding window rate limit check.
    Survives serverless cold starts on Vercel across all instances.
    Returns True if limit is exceeded.
    """
    cutoff = (datetime.now(timezone.utc) - timedelta(minutes=window_minutes)).isoformat()
    recent_count = (
        db.query(SecurityEvent)
        .filter(
            SecurityEvent.ip_address == ip_address,
            SecurityEvent.event_type.in_(event_types),
            SecurityEvent.created_at >= cutoff,
        )
        .count()
    )
    return recent_count >= max_events


def is_user_locked(user: User) -> tuple[bool, int]:
    if not user.locked_until:
        return False, 0
    try:
        locked_dt = datetime.fromisoformat(user.locked_until)
        now = datetime.now(timezone.utc)
        if now < locked_dt:
            remaining_mins = max(1, int((locked_dt - now).total_seconds() // 60) + 1)
            return True, remaining_mins
    except ValueError:
        pass
    return False, 0


def detect_malicious_payload(path: str, query: str) -> Optional[tuple[str, str, str]]:
    lower_path = path.lower()
    for probe_path in SCANNER_PATHS:
        if probe_path in lower_path:
            return ("PATH_SCAN_PROBE", "HIGH", f"Blocked scanner path probe: {sanitize_log_text(path, 100)}")

    combined = f"{path}?{query}" if query else path
    for event_type, severity, pattern in THREAT_PATTERNS:
        if pattern.search(combined):
            return (event_type, severity, f"Matched threat signature on {sanitize_log_text(path, 80)}")
    return None


def verify_csrf_if_cookie_auth(request: Request):
    """Validates double-submit CSRF token for mutating requests using cookie auth."""
    if request.method in ("GET", "HEAD", "OPTIONS"):
        return
    # Only enforce CSRF when session cookie is present (safe for stateless API tests before auth)
    session_cookie = request.cookies.get(SESSION_COOKIE_NAME)
    if not session_cookie:
        return

    cookie_csrf = request.cookies.get(CSRF_COOKIE_NAME)
    header_csrf = request.headers.get("x-csrf-token")
    if not cookie_csrf or not header_csrf or not secrets.compare_digest(cookie_csrf, header_csrf):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="CSRF validation failed. Refresh and try again.",
        )


def get_current_user(
    request: Request,
    db: Session = Depends(get_db),
) -> User:
    token = request.cookies.get(SESSION_COOKIE_NAME)
    if not token:
        auth_header = request.headers.get("authorization", "")
        if auth_header.lower().startswith("bearer "):
            token = auth_header[7:].strip()

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
        )

    # Verify CSRF protection on mutating cookie-authenticated requests
    verify_csrf_if_cookie_auth(request)

    try:
        payload = decode_access_token(token)
        user_id = int(payload["sub"])
        token_version = int(payload["tv"])
    except (jwt.PyJWTError, ValueError, KeyError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired session token",
        )

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    if not user.is_active:
        log_security_event(
            db,
            event_type="SUSPENDED_ACCOUNT_ACCESS",
            severity="HIGH",
            ip_address=get_client_ip(request),
            user_agent=request.headers.get("user-agent", ""),
            target_user_id=user.id,
            target_email=user.email,
            endpoint=request.url.path,
            details="Suspended account attempted authenticated request",
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is suspended by administrator",
        )

    if user.token_version != token_version:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session revoked. Please log in again.",
        )

    return user


def get_current_admin(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> User:
    if current_user.role != "admin":
        log_security_event(
            db,
            event_type="PRIVILEGE_ESCALATION_ATTEMPT",
            severity="CRITICAL",
            ip_address=get_client_ip(request),
            user_agent=request.headers.get("user-agent", ""),
            target_user_id=current_user.id,
            target_email=current_user.email,
            endpoint=request.url.path,
            details=f"Non-admin user '{current_user.username}' attempted admin access",
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Administrator privileges required",
        )
    return current_user

