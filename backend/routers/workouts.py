from datetime import datetime, timezone
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import desc

from ..database import get_db
from ..models import WorkoutSession
from ..schemas import WorkoutCreate, WorkoutResponse

router = APIRouter(prefix="/api/workouts", tags=["workouts"])


@router.post("", response_model=WorkoutResponse, status_code=status.HTTP_201_CREATED)
def create_workout(workout_in: WorkoutCreate, db: Session = Depends(get_db)):
    created_at = datetime.now(timezone.utc).isoformat()
    session_date = workout_in.session_date or datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    db_workout = WorkoutSession(
        session_date=session_date,
        start_time=workout_in.start_time,
        end_time=workout_in.end_time,
        total_jumps=workout_in.total_jumps,
        active_duration_seconds=workout_in.active_duration_seconds,
        rest_duration_seconds=workout_in.rest_duration_seconds,
        total_duration_seconds=workout_in.total_duration_seconds,
        average_jumps_per_minute=workout_in.average_jumps_per_minute,
        max_jumps_per_minute=workout_in.max_jumps_per_minute,
        created_at=created_at,
    )
    db.add(db_workout)
    db.commit()
    db.refresh(db_workout)
    return db_workout


@router.get("", response_model=List[WorkoutResponse])
def get_workouts(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    workouts = (
        db.query(WorkoutSession)
        .order_by(desc(WorkoutSession.id))
        .offset(skip)
        .limit(limit)
        .all()
    )
    return workouts


@router.get("/{workout_id}", response_model=WorkoutResponse)
def get_workout(workout_id: int, db: Session = Depends(get_db)):
    workout = db.query(WorkoutSession).filter(WorkoutSession.id == workout_id).first()
    if not workout:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Workout session with id {workout_id} not found"
        )
    return workout


@router.delete("/{workout_id}", status_code=status.HTTP_200_OK)
def delete_workout(workout_id: int, db: Session = Depends(get_db)):
    workout = db.query(WorkoutSession).filter(WorkoutSession.id == workout_id).first()
    if not workout:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Workout session with id {workout_id} not found"
        )
    db.delete(workout)
    db.commit()
    return {"message": f"Workout session {workout_id} deleted successfully", "id": workout_id}

