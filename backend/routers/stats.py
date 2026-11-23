from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func

from ..database import get_db
from ..models import WorkoutSession
from ..schemas import StatsResponse

router = APIRouter(prefix="/api/stats", tags=["stats"])


@router.get("", response_model=StatsResponse)
def get_stats(db: Session = Depends(get_db)):
    total_lifetime_jumps = db.query(func.coalesce(func.sum(WorkoutSession.total_jumps), 0)).scalar()
    total_sessions = db.query(func.count(WorkoutSession.id)).scalar()
    total_active_seconds = db.query(func.coalesce(func.sum(WorkoutSession.active_duration_seconds), 0.0)).scalar()
    best_record_jumps = db.query(func.coalesce(func.max(WorkoutSession.total_jumps), 0)).scalar()
    best_record_pace = db.query(func.coalesce(func.max(WorkoutSession.average_jumps_per_minute), 0.0)).scalar()

    return StatsResponse(
        total_lifetime_jumps=int(total_lifetime_jumps),
        total_sessions=int(total_sessions),
        total_active_duration_seconds=float(total_active_seconds),
        best_record_jumps=int(best_record_jumps),
        best_record_pace=float(best_record_pace)
    )

