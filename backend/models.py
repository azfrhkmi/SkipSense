from datetime import datetime, timezone
from sqlalchemy import Column, Integer, Float, String, DateTime
from .database import Base


class WorkoutSession(Base):
    __tablename__ = "workout_sessions"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    session_date = Column(String(10), nullable=False, index=True)  # YYYY-MM-DD
    start_time = Column(String(30), nullable=False)
    end_time = Column(String(30), nullable=False)
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
    created_at = Column(
        String(30),
        nullable=False,
        default=lambda: datetime.now(timezone.utc).isoformat()
    )

