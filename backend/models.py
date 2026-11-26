from datetime import datetime, timezone
from sqlalchemy import Column, Integer, Float, String, Boolean, Text, ForeignKey
from sqlalchemy.orm import relationship
from .database import Base


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    username = Column(String(40), unique=True, nullable=False, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(20), nullable=False, default="user", index=True)  # 'user' | 'admin'
    is_active = Column(Boolean, nullable=False, default=True)
    token_version = Column(Integer, nullable=False, default=1)
    failed_login_attempts = Column(Integer, nullable=False, default=0)
    locked_until = Column(String(40), nullable=True)
    last_login_at = Column(String(40), nullable=True)
    last_login_ip = Column(String(64), nullable=True)
    created_at = Column(String(40), nullable=False, default=_utc_now_iso)

    workouts = relationship("WorkoutSession", back_populates="owner", cascade="all, delete-orphan")


class WorkoutSession(Base):
    __tablename__ = "workout_sessions"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)
    session_date = Column(String(10), nullable=False, index=True)  # YYYY-MM-DD
    start_time = Column(String(40), nullable=False)
    end_time = Column(String(40), nullable=False)
    total_jumps = Column(Integer, nullable=False, default=0)
    active_duration_seconds = Column(Float, nullable=False, default=0.0)
    rest_duration_seconds = Column(Float, nullable=False, default=0.0)
    total_duration_seconds = Column(Float, nullable=False, default=0.0)
    average_jumps_per_minute = Column(Float, nullable=False, default=0.0)
    max_jumps_per_minute = Column(Float, nullable=False, default=0.0)
    exercise_type = Column(String(20), nullable=False, default="skipping", index=True)
    workout_mode = Column(String(20), nullable=False, default="standard")
    target_reps = Column(Integer, nullable=True)
    completed_reps = Column(Integer, nullable=False, default=0)
    completion_status = Column(String(20), nullable=False, default="completed")
    created_at = Column(String(40), nullable=False, default=_utc_now_iso)

    owner = relationship("User", back_populates="workouts")


class SecurityEvent(Base):
    __tablename__ = "security_events"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    event_type = Column(String(60), nullable=False, index=True)
    severity = Column(String(20), nullable=False, index=True)  # LOW | MEDIUM | HIGH | CRITICAL
    ip_address = Column(String(64), nullable=False, default="unknown", index=True)
    user_agent = Column(String(255), nullable=False, default="")
    target_user_id = Column(Integer, nullable=True, index=True)
    target_email = Column(String(255), nullable=True)
    endpoint = Column(String(160), nullable=False, default="")
    details = Column(Text, nullable=False, default="")
    resolved = Column(Boolean, nullable=False, default=False, index=True)
    created_at = Column(String(40), nullable=False, index=True, default=_utc_now_iso)
