from datetime import datetime, timezone
from typing import Optional, List
from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator, model_validator


# --- Auth & User Schemas ---

class UserRegister(BaseModel):
    username: str = Field(..., min_length=3, max_length=30, pattern=r"^[a-zA-Z0-9_.-]+$")
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)


class UserLogin(BaseModel):
    identifier: str = Field(..., min_length=3, max_length=255, description="Username or email")
    password: str = Field(..., min_length=1, max_length=128)


class PasswordChangeRequest(BaseModel):
    current_password: str = Field(..., min_length=1, max_length=128)
    new_password: str = Field(..., min_length=8, max_length=128)


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    email: str
    role: str
    is_active: bool
    last_login_at: Optional[str] = None
    created_at: str


class AuthResponse(BaseModel):
    user: UserResponse
    csrf_token: str
    message: str = "Authenticated"


class BootstrapStatusResponse(BaseModel):
    needs_admin_setup: bool
    database_backend: str


# --- Workout Schemas ---

class WorkoutCreate(BaseModel):
    session_date: Optional[str] = None
    start_time: str
    end_time: str
    total_jumps: int = Field(default=0, ge=0, description="Total completed jumps (or reps)")
    active_duration_seconds: float = Field(..., ge=0.0)
    rest_duration_seconds: float = Field(default=0.0, ge=0.0)
    total_duration_seconds: float = Field(..., ge=0.0)
    average_jumps_per_minute: float = Field(default=0.0, ge=0.0)
    max_jumps_per_minute: float = Field(default=0.0, ge=0.0)
    exercise_type: Optional[str] = Field(default="skipping", description="Exercise type: skipping or push_up")
    workout_mode: Optional[str] = Field(default="standard", description="Workout mode: standard, 10, 20, 30, freedom")
    target_reps: Optional[int] = Field(default=None, description="Target reps if mode has a target")
    completed_reps: Optional[int] = Field(default=0, ge=0, description="Completed repetitions")
    completion_status: Optional[str] = Field(default="completed", description="completed, stopped, or aborted")

    @field_validator("session_date", mode="before")
    def default_session_date(cls, v):
        if not v:
            return datetime.now(timezone.utc).strftime("%Y-%m-%d")
        return v

    @model_validator(mode="after")
    def sync_reps(self):
        if self.exercise_type == "push_up" and self.completed_reps and not self.total_jumps:
            self.total_jumps = self.completed_reps
        elif self.exercise_type == "skipping" and self.total_jumps and not self.completed_reps:
            self.completed_reps = self.total_jumps
        return self


class WorkoutResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: Optional[int] = None
    session_date: str
    start_time: str
    end_time: str
    total_jumps: int
    active_duration_seconds: float
    rest_duration_seconds: float
    total_duration_seconds: float
    average_jumps_per_minute: float
    max_jumps_per_minute: float
    exercise_type: str = "skipping"
    workout_mode: str = "standard"
    target_reps: Optional[int] = None
    completed_reps: int = 0
    completion_status: str = "completed"
    created_at: str


class StatsResponse(BaseModel):
    total_lifetime_jumps: int
    total_sessions: int
    total_active_duration_seconds: float
    best_record_jumps: int
    best_record_pace: float
    total_lifetime_pushups: int = 0
    total_pushup_sessions: int = 0
    best_record_pushups: int = 0
    best_pushup_pace: float = 0.0


# --- Admin Threat & User Dashboard Schemas ---

class SecurityEventResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    event_type: str
    severity: str
    ip_address: str
    user_agent: str
    target_user_id: Optional[int] = None
    target_email: Optional[str] = None
    endpoint: str
    details: str
    resolved: bool
    created_at: str


class AdminUserSummary(BaseModel):
    id: int
    username: str
    email: str
    role: str
    is_active: bool
    is_locked: bool
    failed_login_attempts: int
    locked_until: Optional[str] = None
    last_login_at: Optional[str] = None
    last_login_ip: Optional[str] = None
    created_at: str
    total_sessions: int
    total_jumps: int
    total_pushups: int
    active_duration_seconds: float


class AdminOverviewResponse(BaseModel):
    total_users: int
    active_users: int
    suspended_users: int
    locked_users: int
    total_workouts: int
    total_platform_jumps: int
    total_platform_pushups: int
    unresolved_high_threats: int
    total_threats_24h: int
    blocked_attempts_24h: int
    database_backend: str
    security_controls: List[str]


class AdminUserDetailResponse(BaseModel):
    user: AdminUserSummary
    stats: StatsResponse
    recent_workouts: List[WorkoutResponse]
    recent_security_events: List[SecurityEventResponse]
