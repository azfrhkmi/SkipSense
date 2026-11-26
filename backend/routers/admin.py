from datetime import datetime, timedelta, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import desc, func
from sqlalchemy.orm import Session

from ..database import IS_SQLITE, get_db
from ..models import SecurityEvent, User, WorkoutSession
from ..schemas import (
    AdminOverviewResponse,
    AdminUserDetailResponse,
    AdminUserSummary,
    SecurityEventResponse,
    WorkoutResponse,
)
from ..security import get_client_ip, get_current_admin, is_user_locked, log_security_event
from .stats import compute_user_stats

router = APIRouter(prefix="/api/admin", tags=["admin"])

THREAT_EVENT_TYPES = (
    "LOGIN_FAILED",
    "BRUTE_FORCE_LOCKOUT",
    "CREDENTIAL_STUFFING",
    "RATE_LIMIT_EXCEEDED",
    "PRIVILEGE_ESCALATION_ATTEMPT",
    "IDOR_ACCESS_DENIED",
    "INJECTION_PROBE",
    "PATH_SCAN_PROBE",
    "SUSPENDED_ACCOUNT_ACCESS",
    "LOCKED_ACCOUNT_ATTEMPT",
)


def _build_user_summary(user: User, db: Session) -> AdminUserSummary:
    workouts = db.query(WorkoutSession).filter(WorkoutSession.user_id == user.id).all()
    total_jumps = sum((w.total_jumps or 0) for w in workouts if w.exercise_type != "push_up")
    total_pushups = sum(
        (w.completed_reps or w.total_jumps or 0) for w in workouts if w.exercise_type == "push_up"
    )
    active_sec = sum((w.active_duration_seconds or 0.0) for w in workouts)
    locked, _ = is_user_locked(user)

    return AdminUserSummary(
        id=user.id,
        username=user.username,
        email=user.email,
        role=user.role,
        is_active=user.is_active,
        is_locked=locked,
        failed_login_attempts=user.failed_login_attempts,
        locked_until=user.locked_until,
        last_login_at=user.last_login_at,
        last_login_ip=user.last_login_ip,
        created_at=user.created_at,
        total_sessions=len(workouts),
        total_jumps=int(total_jumps),
        total_pushups=int(total_pushups),
        active_duration_seconds=float(active_sec),
    )


@router.get("/overview", response_model=AdminOverviewResponse)
def get_admin_overview(
    admin_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    users = db.query(User).all()
    total_users = len(users)
    active_users = sum(1 for u in users if u.is_active)
    suspended_users = total_users - active_users
    locked_users = sum(1 for u in users if is_user_locked(u)[0])

    total_workouts = db.query(func.count(WorkoutSession.id)).scalar() or 0
    total_jumps = (
        db.query(func.coalesce(func.sum(WorkoutSession.total_jumps), 0))
        .filter(WorkoutSession.exercise_type != "push_up")
        .scalar()
        or 0
    )
    total_pushups = (
        db.query(func.coalesce(func.sum(WorkoutSession.completed_reps), 0))
        .filter(WorkoutSession.exercise_type == "push_up")
        .scalar()
        or 0
    )

    cutoff_24h = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()
    unresolved_high_threats = (
        db.query(func.count(SecurityEvent.id))
        .filter(
            SecurityEvent.resolved.is_(False),
            SecurityEvent.severity.in_(("HIGH", "CRITICAL")),
        )
        .scalar()
        or 0
    )
    total_threats_24h = (
        db.query(func.count(SecurityEvent.id))
        .filter(
            SecurityEvent.created_at >= cutoff_24h,
            SecurityEvent.event_type.in_(THREAT_EVENT_TYPES),
        )
        .scalar()
        or 0
    )
    blocked_attempts_24h = (
        db.query(func.count(SecurityEvent.id))
        .filter(
            SecurityEvent.created_at >= cutoff_24h,
            SecurityEvent.event_type.in_(
                (
                    "BRUTE_FORCE_LOCKOUT",
                    "CREDENTIAL_STUFFING",
                    "RATE_LIMIT_EXCEEDED",
                    "INJECTION_PROBE",
                    "PATH_SCAN_PROBE",
                    "IDOR_ACCESS_DENIED",
                    "PRIVILEGE_ESCALATION_ATTEMPT",
                )
            ),
        )
        .scalar()
        or 0
    )

    return AdminOverviewResponse(
        total_users=total_users,
        active_users=active_users,
        suspended_users=suspended_users,
        locked_users=locked_users,
        total_workouts=int(total_workouts),
        total_platform_jumps=int(total_jumps),
        total_platform_pushups=int(total_pushups),
        unresolved_high_threats=int(unresolved_high_threats),
        total_threats_24h=int(total_threats_24h),
        blocked_attempts_24h=int(blocked_attempts_24h),
        database_backend="SQLite (Local)" if IS_SQLITE else "PostgreSQL (Cloud)",
        security_controls=[
            "Argon2id Password Hashing",
            "HttpOnly + SameSite JWT Sessions",
            "Double-Submit CSRF Token Enforcement",
            "Server-Side Token Version Revocation",
            "DB-Backed Brute-Force Lockout & IP Rate Limiting",
            "SQLi / XSS / Path-Scan Probe Middleware",
            "OWASP Security Headers & Strict RBAC/IDOR Audit",
        ],
    )


@router.get("/threats", response_model=List[SecurityEventResponse])
def list_security_events(
    severity: Optional[str] = None,
    resolved: Optional[bool] = None,
    limit: int = 100,
    admin_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    query = db.query(SecurityEvent)
    if severity and severity.upper() in {"LOW", "MEDIUM", "HIGH", "CRITICAL"}:
        query = query.filter(SecurityEvent.severity == severity.upper())
    if resolved is not None:
        query = query.filter(SecurityEvent.resolved.is_(resolved))

    events = (
        query.order_by(desc(SecurityEvent.id))
        .limit(min(limit, 250))
        .all()
    )
    return events


@router.post("/threats/{event_id}/resolve")
def resolve_security_event(
    event_id: int,
    request: Request,
    admin_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    event = db.query(SecurityEvent).filter(SecurityEvent.id == event_id).first()
    if not event:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Security event not found")
    event.resolved = True
    db.commit()
    return {"message": f"Event {event_id} marked resolved", "id": event_id}


@router.post("/threats/resolve-all")
def resolve_all_security_events(
    request: Request,
    admin_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    updated = db.query(SecurityEvent).filter(SecurityEvent.resolved.is_(False)).update(
        {"resolved": True}
    )
    db.commit()
    log_security_event(
        db,
        event_type="ADMIN_ACTION",
        severity="LOW",
        ip_address=get_client_ip(request),
        user_agent=request.headers.get("user-agent", ""),
        target_user_id=admin_user.id,
        target_email=admin_user.email,
        endpoint=request.url.path,
        details=f"Admin '{admin_user.username}' resolved {updated} open security event(s)",
        resolved=True,
    )
    return {"message": f"Resolved {updated} open events", "count": updated}


@router.get("/users", response_model=List[AdminUserSummary])
def list_all_users(
    admin_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    users = db.query(User).order_by(desc(User.id)).all()
    return [_build_user_summary(u, db) for u in users]


@router.get("/users/{user_id}/dashboard", response_model=AdminUserDetailResponse)
def get_user_dashboard_detail(
    user_id: int,
    admin_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    summary = _build_user_summary(user, db)
    stats = compute_user_stats(user.id, db)
    recent_workouts = (
        db.query(WorkoutSession)
        .filter(WorkoutSession.user_id == user.id)
        .order_by(desc(WorkoutSession.id))
        .limit(50)
        .all()
    )
    recent_events = (
        db.query(SecurityEvent)
        .filter(SecurityEvent.target_user_id == user.id)
        .order_by(desc(SecurityEvent.id))
        .limit(30)
        .all()
    )

    return AdminUserDetailResponse(
        user=summary,
        stats=stats,
        recent_workouts=[WorkoutResponse.model_validate(w) for w in recent_workouts],
        recent_security_events=[SecurityEventResponse.model_validate(e) for e in recent_events],
    )


@router.post("/users/{user_id}/toggle-active")
def toggle_user_active(
    user_id: int,
    request: Request,
    admin_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    if user_id == admin_user.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot suspend your own account.")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    user.is_active = not user.is_active
    if not user.is_active:
        user.token_version += 1  # Immediately kick all active sessions
    db.commit()

    log_security_event(
        db,
        event_type="ADMIN_ACTION",
        severity="MEDIUM",
        ip_address=get_client_ip(request),
        user_agent=request.headers.get("user-agent", ""),
        target_user_id=user.id,
        target_email=user.email,
        endpoint=request.url.path,
        details=f"Admin '{admin_user.username}' {'reactivated' if user.is_active else 'suspended'} user '{user.username}'",
        resolved=True,
    )
    return {"user_id": user.id, "is_active": user.is_active}


@router.post("/users/{user_id}/unlock")
def unlock_user_account(
    user_id: int,
    request: Request,
    admin_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    user.failed_login_attempts = 0
    user.locked_until = None
    db.commit()

    log_security_event(
        db,
        event_type="ADMIN_ACTION",
        severity="LOW",
        ip_address=get_client_ip(request),
        user_agent=request.headers.get("user-agent", ""),
        target_user_id=user.id,
        target_email=user.email,
        endpoint=request.url.path,
        details=f"Admin '{admin_user.username}' unlocked user '{user.username}'",
        resolved=True,
    )
    return {"user_id": user.id, "unlocked": True}


@router.post("/users/{user_id}/revoke-sessions")
def revoke_user_sessions(
    user_id: int,
    request: Request,
    admin_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    user.token_version += 1
    db.commit()

    log_security_event(
        db,
        event_type="SESSION_REVOKED",
        severity="MEDIUM",
        ip_address=get_client_ip(request),
        user_agent=request.headers.get("user-agent", ""),
        target_user_id=user.id,
        target_email=user.email,
        endpoint=request.url.path,
        details=f"Admin '{admin_user.username}' revoked all active sessions for '{user.username}'",
        resolved=True,
    )
    return {"user_id": user.id, "token_version": user.token_version}


@router.post("/users/{user_id}/toggle-role")
def toggle_user_role(
    user_id: int,
    request: Request,
    admin_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    if user_id == admin_user.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot change your own role.")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    user.role = "admin" if user.role != "admin" else "user"
    user.token_version += 1  # Force fresh token reflecting updated RBAC role
    db.commit()

    log_security_event(
        db,
        event_type="ADMIN_ACTION",
        severity="HIGH",
        ip_address=get_client_ip(request),
        user_agent=request.headers.get("user-agent", ""),
        target_user_id=user.id,
        target_email=user.email,
        endpoint=request.url.path,
        details=f"Admin '{admin_user.username}' changed role of '{user.username}' to '{user.role}'",
        resolved=True,
    )
    return {"user_id": user.id, "role": user.role}
