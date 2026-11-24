from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func

from ..database import get_db
from ..models import WorkoutSession
from ..schemas import StatsResponse

router = APIRouter(prefix="/api/stats", tags=["stats"])


@router.get("", response_model=StatsResponse)
def get_stats(db: Session = Depends(get_db)):
    # Skipping stats
    skipping_query = db.query(WorkoutSession).filter(WorkoutSession.exercise_type != "push_up")
    total_lifetime_jumps = skipping_query.with_entities(func.coalesce(func.sum(WorkoutSession.total_jumps), 0)).scalar()
    best_record_jumps = skipping_query.with_entities(func.coalesce(func.max(WorkoutSession.total_jumps), 0)).scalar()
    best_record_pace = skipping_query.with_entities(func.coalesce(func.max(WorkoutSession.average_jumps_per_minute), 0.0)).scalar()

    # Push-up stats
    pushup_query = db.query(WorkoutSession).filter(WorkoutSession.exercise_type == "push_up")
    total_lifetime_pushups = pushup_query.with_entities(func.coalesce(func.sum(WorkoutSession.completed_reps), 0)).scalar()
    total_pushup_sessions = pushup_query.with_entities(func.count(WorkoutSession.id)).scalar()
    best_record_pushups = pushup_query.with_entities(func.coalesce(func.max(WorkoutSession.completed_reps), 0)).scalar()
    best_pushup_pace = pushup_query.with_entities(func.coalesce(func.max(WorkoutSession.average_jumps_per_minute), 0.0)).scalar()

    # Total across all sessions
    total_sessions = db.query(func.count(WorkoutSession.id)).scalar()
    total_active_seconds = db.query(func.coalesce(func.sum(WorkoutSession.active_duration_seconds), 0.0)).scalar()

    return StatsResponse(
        total_lifetime_jumps=int(total_lifetime_jumps or 0),
        total_sessions=int(total_sessions or 0),
        total_active_duration_seconds=float(total_active_seconds or 0.0),
        best_record_jumps=int(best_record_jumps or 0),
        best_record_pace=float(best_record_pace or 0.0),
        total_lifetime_pushups=int(total_lifetime_pushups or 0),
        total_pushup_sessions=int(total_pushup_sessions or 0),
        best_record_pushups=int(best_record_pushups or 0),
        best_pushup_pace=float(best_pushup_pace or 0.0),
    )

