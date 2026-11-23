from datetime import datetime, timezone
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field, field_validator


class WorkoutCreate(BaseModel):
    session_date: Optional[str] = None
    start_time: str
    end_time: str
    total_jumps: int = Field(..., ge=0, description="Total completed jumps")
    active_duration_seconds: float = Field(..., ge=0.0)
    rest_duration_seconds: float = Field(default=0.0, ge=0.0)
    total_duration_seconds: float = Field(..., ge=0.0)
    average_jumps_per_minute: float = Field(default=0.0, ge=0.0)
    max_jumps_per_minute: float = Field(default=0.0, ge=0.0)

    @field_validator("session_date", mode="before")
    def default_session_date(cls, v):
        if not v:
            return datetime.now(timezone.utc).strftime("%Y-%m-%d")
        return v


class WorkoutResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    session_date: str
    start_time: str
    end_time: str
    total_jumps: int
    active_duration_seconds: float
    rest_duration_seconds: float
    total_duration_seconds: float
    average_jumps_per_minute: float
    max_jumps_per_minute: float
    created_at: str


class StatsResponse(BaseModel):
    total_lifetime_jumps: int
    total_sessions: int
    total_active_duration_seconds: float
    best_record_jumps: int
    best_record_pace: float

