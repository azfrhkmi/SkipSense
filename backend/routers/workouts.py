from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session
from sqlalchemy import desc

from ..database import get_db
from ..models import User, WorkoutSession
from ..schemas import WorkoutCreate, WorkoutResponse
from ..security import get_client_ip, get_current_user, log_security_event

router = APIRouter(prefix="/api/workouts", tags=["workouts"])


@router.post("", response_model=WorkoutResponse, status_code=status.HTTP_201_CREATED)
def create_workout(
    workout_in: WorkoutCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    created_at = datetime.now(timezone.utc).isoformat()
    session_date = workout_in.session_date or datetime.now(timezone.utc).strftime("%Y-%m-%d")

    completed_reps = workout_in.completed_reps or (
        workout_in.total_jumps if workout_in.exercise_type == "skipping" else 0
    )
    total_jumps = workout_in.total_jumps or (
        completed_reps if workout_in.exercise_type == "push_up" else 0
    )

    db_workout = WorkoutSession(
        user_id=current_user.id,
        session_date=session_date,
        start_time=workout_in.start_time,
        end_time=workout_in.end_time,
        total_jumps=total_jumps,
        active_duration_seconds=workout_in.active_duration_seconds,
        rest_duration_seconds=workout_in.rest_duration_seconds,
        total_duration_seconds=workout_in.total_duration_seconds,
        average_jumps_per_minute=workout_in.average_jumps_per_minute,
        max_jumps_per_minute=workout_in.max_jumps_per_minute,
        exercise_type=workout_in.exercise_type or "skipping",
        workout_mode=workout_in.workout_mode or "standard",
        target_reps=workout_in.target_reps,
        completed_reps=completed_reps,
        completion_status=workout_in.completion_status or "completed",
        created_at=created_at,
    )
    db.add(db_workout)
    db.commit()
    db.refresh(db_workout)
    return db_workout


@router.get("", response_model=List[WorkoutResponse])
def get_workouts(
    exercise_type: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(WorkoutSession).filter(WorkoutSession.user_id == current_user.id)
    if exercise_type:
        query = query.filter(WorkoutSession.exercise_type == exercise_type)
    workouts = (
        query.order_by(desc(WorkoutSession.id))
        .offset(skip)
        .limit(min(limit, 200))
        .all()
    )
    return workouts


@router.get("/{workout_id}", response_model=WorkoutResponse)
def get_workout(
    workout_id: int,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    workout = db.query(WorkoutSession).filter(WorkoutSession.id == workout_id).first()
    if not workout:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Workout session with id {workout_id} not found",
        )
    if workout.user_id != current_user.id:
        log_security_event(
            db,
            event_type="IDOR_ACCESS_DENIED",
            severity="HIGH",
            ip_address=get_client_ip(request),
            user_agent=request.headers.get("user-agent", ""),
            target_user_id=current_user.id,
            target_email=current_user.email,
            endpoint=request.url.path,
            details=f"User {current_user.id} attempted to read workout {workout_id} owned by user {workout.user_id}",
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to view this workout",
        )
    return workout


@router.delete("/{workout_id}", status_code=status.HTTP_200_OK)
def delete_workout(
    workout_id: int,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    workout = db.query(WorkoutSession).filter(WorkoutSession.id == workout_id).first()
    if not workout:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Workout session with id {workout_id} not found",
        )
    if workout.user_id != current_user.id:
        log_security_event(
            db,
            event_type="IDOR_ACCESS_DENIED",
            severity="HIGH",
            ip_address=get_client_ip(request),
            user_agent=request.headers.get("user-agent", ""),
            target_user_id=current_user.id,
            target_email=current_user.email,
            endpoint=request.url.path,
            details=f"User {current_user.id} attempted to delete workout {workout_id} owned by user {workout.user_id}",
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to delete this workout",
        )
    db.delete(workout)
    db.commit()
    return {"message": f"Workout session {workout_id} deleted successfully", "id": workout_id}
