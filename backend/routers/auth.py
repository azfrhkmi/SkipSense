import os
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from ..database import IS_SQLITE, IS_VERCEL, get_db
from ..models import User, WorkoutSession
from ..schemas import (
    AuthResponse,
    BootstrapStatusResponse,
    PasswordChangeRequest,
    UserLogin,
    UserRegister,
    UserResponse,
)
from ..security import (
    CSRF_COOKIE_NAME,
    LOCKOUT_MINUTES,
    MAX_FAILED_ATTEMPTS,
    check_ip_rate_limit,
    clear_auth_cookies,
    get_client_ip,
    get_current_user,
    hash_password,
    is_user_locked,
    log_security_event,
    set_auth_cookies,
    validate_password_strength,
    verify_csrf_if_cookie_auth,
    verify_password,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])

# Precomputed Argon2id dummy hash to neutralize timing attacks when account doesn't exist
_DUMMY_HASH = hash_password("SkipSense-Timing-Guard-99!")


@router.get("/bootstrap-status", response_model=BootstrapStatusResponse)
def get_bootstrap_status(db: Session = Depends(get_db)):
    admin_count = db.query(func.count(User.id)).filter(User.role == "admin").scalar() or 0
    return BootstrapStatusResponse(
        needs_admin_setup=(admin_count == 0),
        database_backend="sqlite" if IS_SQLITE else "postgresql",
    )


@router.post("/bootstrap-admin", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
def bootstrap_initial_admin(
    payload: UserRegister,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    """
    One-time initial Admin setup when zero admins exist in the database.
    Optionally protected by ADMIN_SETUP_KEY header on public deployments.
    """
    admin_count = db.query(func.count(User.id)).filter(User.role == "admin").scalar() or 0
    if admin_count > 0:
        log_security_event(
            db,
            event_type="PRIVILEGE_ESCALATION_ATTEMPT",
            severity="CRITICAL",
            ip_address=get_client_ip(request),
            user_agent=request.headers.get("user-agent", ""),
            target_email=payload.email,
            endpoint=request.url.path,
            details="Attempted admin bootstrap after an admin account already exists",
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin setup is already completed.",
        )

    setup_key = os.getenv("ADMIN_SETUP_KEY")
    if IS_VERCEL and setup_key:
        provided_key = request.headers.get("x-setup-key", "")
        if provided_key != setup_key:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Invalid admin setup key.",
            )

    strength_err = validate_password_strength(payload.password)
    if strength_err:
        raise HTTPException(status_code=422, detail=strength_err)

    normalized_email = payload.email.strip().lower()
    normalized_username = payload.username.strip()

    existing = (
        db.query(User)
        .filter(or_(User.email == normalized_email, User.username == normalized_username))
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Username or email is already registered.",
        )

    ip = get_client_ip(request)
    now_iso = datetime.now(timezone.utc).isoformat()
    admin_user = User(
        username=normalized_username,
        email=normalized_email,
        password_hash=hash_password(payload.password),
        role="admin",
        is_active=True,
        token_version=1,
        last_login_at=now_iso,
        last_login_ip=ip,
        created_at=now_iso,
    )
    db.add(admin_user)
    db.commit()
    db.refresh(admin_user)

    # Assign any pre-existing legacy workouts cleanly to initial owner
    db.query(WorkoutSession).filter(WorkoutSession.user_id.is_(None)).update(
        {"user_id": admin_user.id}
    )
    db.commit()

    log_security_event(
        db,
        event_type="ADMIN_BOOTSTRAP",
        severity="LOW",
        ip_address=ip,
        user_agent=request.headers.get("user-agent", ""),
        target_user_id=admin_user.id,
        target_email=admin_user.email,
        endpoint=request.url.path,
        details=f"Initial admin account '{admin_user.username}' created",
        resolved=True,
    )

    csrf_token = set_auth_cookies(response, request, admin_user)
    return AuthResponse(
        user=UserResponse.model_validate(admin_user),
        csrf_token=csrf_token,
        message="Administrator account initialized.",
    )


@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
def register(
    payload: UserRegister,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    ip = get_client_ip(request)
    ua = request.headers.get("user-agent", "")

    # Sliding-window IP rate limiting on account registrations (max 10 per 10 mins)
    if check_ip_rate_limit(db, ip, ("USER_REGISTERED", "RATE_LIMIT_EXCEEDED"), max_events=10, window_minutes=10):
        log_security_event(
            db,
            event_type="RATE_LIMIT_EXCEEDED",
            severity="HIGH",
            ip_address=ip,
            user_agent=ua,
            endpoint=request.url.path,
            details="Registration rate limit exceeded from IP",
        )
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many registration attempts. Please wait a few minutes.",
        )

    strength_err = validate_password_strength(payload.password)
    if strength_err:
        raise HTTPException(status_code=422, detail=strength_err)

    normalized_email = payload.email.strip().lower()
    normalized_username = payload.username.strip()

    existing = (
        db.query(User)
        .filter(or_(User.email == normalized_email, User.username == normalized_username))
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email or username already exists.",
        )

    now_iso = datetime.now(timezone.utc).isoformat()
    # Strictly force role='user' to prevent mass-assignment privilege escalation
    user = User(
        username=normalized_username,
        email=normalized_email,
        password_hash=hash_password(payload.password),
        role="user",
        is_active=True,
        token_version=1,
        last_login_at=now_iso,
        last_login_ip=ip,
        created_at=now_iso,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    log_security_event(
        db,
        event_type="USER_REGISTERED",
        severity="LOW",
        ip_address=ip,
        user_agent=ua,
        target_user_id=user.id,
        target_email=user.email,
        endpoint=request.url.path,
        details=f"Registered standard user '{user.username}'",
        resolved=True,
    )

    csrf_token = set_auth_cookies(response, request, user)
    return AuthResponse(
        user=UserResponse.model_validate(user),
        csrf_token=csrf_token,
        message="Account created successfully.",
    )


@router.post("/login", response_model=AuthResponse)
def login(
    payload: UserLogin,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    ip = get_client_ip(request)
    ua = request.headers.get("user-agent", "")
    identifier = payload.identifier.strip()
    identifier_lower = identifier.lower()

    # Check IP burst rate limit (credential stuffing defense: max 10 failures per 10 min)
    if check_ip_rate_limit(
        db,
        ip,
        ("LOGIN_FAILED", "BRUTE_FORCE_LOCKOUT", "CREDENTIAL_STUFFING"),
        max_events=10,
        window_minutes=10,
    ):
        log_security_event(
            db,
            event_type="CREDENTIAL_STUFFING",
            severity="CRITICAL",
            ip_address=ip,
            user_agent=ua,
            target_email=identifier_lower,
            endpoint=request.url.path,
            details=f"IP exceeded 10 failed login attempts in 10 minutes targeting '{identifier_lower}'",
        )
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many failed login attempts from this network. Try again in 10 minutes.",
        )

    user = (
        db.query(User)
        .filter(or_(User.email == identifier_lower, User.username == identifier))
        .first()
    )

    if not user:
        # Constant-time mitigation against timing enumeration
        verify_password(payload.password, _DUMMY_HASH)
        log_security_event(
            db,
            event_type="LOGIN_FAILED",
            severity="MEDIUM",
            ip_address=ip,
            user_agent=ua,
            target_email=identifier_lower,
            endpoint=request.url.path,
            details=f"Failed login for unknown identifier '{identifier_lower}'",
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username/email or password.",
        )

    # Account lockout check
    locked, remaining_mins = is_user_locked(user)
    if locked:
        log_security_event(
            db,
            event_type="LOCKED_ACCOUNT_ATTEMPT",
            severity="HIGH",
            ip_address=ip,
            user_agent=ua,
            target_user_id=user.id,
            target_email=user.email,
            endpoint=request.url.path,
            details=f"Login attempt on locked account ({remaining_mins}m remaining)",
        )
        raise HTTPException(
            status_code=status.HTTP_423_LOCKED,
            detail=f"Account temporarily locked due to failed attempts. Try again in {remaining_mins} minute(s).",
        )

    if not verify_password(payload.password, user.password_hash):
        user.failed_login_attempts += 1
        if user.failed_login_attempts >= MAX_FAILED_ATTEMPTS:
            user.locked_until = (datetime.now(timezone.utc) + timedelta(minutes=LOCKOUT_MINUTES)).isoformat()
            db.commit()
            log_security_event(
                db,
                event_type="BRUTE_FORCE_LOCKOUT",
                severity="HIGH",
                ip_address=ip,
                user_agent=ua,
                target_user_id=user.id,
                target_email=user.email,
                endpoint=request.url.path,
                details=f"Account '{user.username}' locked for {LOCKOUT_MINUTES}m after {user.failed_login_attempts} failed attempts",
            )
            raise HTTPException(
                status_code=status.HTTP_423_LOCKED,
                detail=f"Too many failed attempts. Account locked for {LOCKOUT_MINUTES} minutes.",
            )

        db.commit()
        remaining = MAX_FAILED_ATTEMPTS - user.failed_login_attempts
        log_security_event(
            db,
            event_type="LOGIN_FAILED",
            severity="MEDIUM",
            ip_address=ip,
            user_agent=ua,
            target_user_id=user.id,
            target_email=user.email,
            endpoint=request.url.path,
            details=f"Wrong password for '{user.username}' ({user.failed_login_attempts}/{MAX_FAILED_ATTEMPTS} attempts)",
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid credentials. {remaining} attempt(s) remaining before temporary lock.",
        )

    if not user.is_active:
        log_security_event(
            db,
            event_type="SUSPENDED_ACCOUNT_ACCESS",
            severity="HIGH",
            ip_address=ip,
            user_agent=ua,
            target_user_id=user.id,
            target_email=user.email,
            endpoint=request.url.path,
            details=f"Suspended user '{user.username}' attempted login",
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is suspended. Contact administrator.",
        )

    # Reset lockout counters on valid login
    now_iso = datetime.now(timezone.utc).isoformat()
    user.failed_login_attempts = 0
    user.locked_until = None
    user.last_login_at = now_iso
    user.last_login_ip = ip
    db.commit()
    db.refresh(user)

    log_security_event(
        db,
        event_type="LOGIN_SUCCESS",
        severity="LOW",
        ip_address=ip,
        user_agent=ua,
        target_user_id=user.id,
        target_email=user.email,
        endpoint=request.url.path,
        details=f"User '{user.username}' ({user.role}) signed in",
        resolved=True,
    )

    csrf_token = set_auth_cookies(response, request, user)
    return AuthResponse(
        user=UserResponse.model_validate(user),
        csrf_token=csrf_token,
        message="Signed in successfully.",
    )


@router.get("/me", response_model=AuthResponse)
def get_me(
    request: Request,
    response: Response,
    current_user: User = Depends(get_current_user),
):
    csrf_token = request.cookies.get(CSRF_COOKIE_NAME)
    if not csrf_token:
        csrf_token = set_auth_cookies(response, request, current_user)
    return AuthResponse(
        user=UserResponse.model_validate(current_user),
        csrf_token=csrf_token,
        message="Active session verified.",
    )


@router.post("/logout")
def logout(
    request: Request,
    response: Response,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Rotate token_version on explicit logout so stolen prior tokens immediately die
    current_user.token_version += 1
    db.commit()
    clear_auth_cookies(response)
    return {"message": "Signed out and session invalidated."}


@router.post("/change-password", response_model=AuthResponse)
def change_password(
    payload: PasswordChangeRequest,
    request: Request,
    response: Response,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    verify_csrf_if_cookie_auth(request)
    if not verify_password(payload.current_password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Current password is incorrect.",
        )

    strength_err = validate_password_strength(payload.new_password)
    if strength_err:
        raise HTTPException(status_code=422, detail=strength_err)

    current_user.password_hash = hash_password(payload.new_password)
    current_user.token_version += 1
    db.commit()
    db.refresh(current_user)

    log_security_event(
        db,
        event_type="PASSWORD_CHANGED",
        severity="LOW",
        ip_address=get_client_ip(request),
        user_agent=request.headers.get("user-agent", ""),
        target_user_id=current_user.id,
        target_email=current_user.email,
        endpoint=request.url.path,
        details=f"User '{current_user.username}' rotated password & invalidated previous sessions",
        resolved=True,
    )

    csrf_token = set_auth_cookies(response, request, current_user)
    return AuthResponse(
        user=UserResponse.model_validate(current_user),
        csrf_token=csrf_token,
        message="Password updated and all prior sessions revoked.",
    )
