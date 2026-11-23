import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.database import Base, get_db
from backend.main import app

# In-memory SQLite with StaticPool so memory DB is shared across connections
TEST_DATABASE_URL = "sqlite:///:memory:"
test_engine = create_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db


@pytest.fixture(autouse=True)
def setup_test_db():
    Base.metadata.create_all(bind=test_engine)
    yield
    Base.metadata.drop_all(bind=test_engine)


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


def test_health_check(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "app": "SkipSense v1.0"}


def test_create_and_get_workout(client):
    payload = {
        "start_time": "2026-11-23T10:00:00Z",
        "end_time": "2026-11-23T10:05:00Z",
        "total_jumps": 150,
        "active_duration_seconds": 240.0,
        "rest_duration_seconds": 60.0,
        "total_duration_seconds": 300.0,
        "average_jumps_per_minute": 37.5,
        "max_jumps_per_minute": 55.0
    }
    create_res = client.post("/api/workouts", json=payload)
    assert create_res.status_code == 201
    created_data = create_res.json()
    workout_id = created_data["id"]
    assert created_data["total_jumps"] == 150
    assert created_data["session_date"] is not None

    # Get by ID
    get_res = client.get(f"/api/workouts/{workout_id}")
    assert get_res.status_code == 200
    assert get_res.json()["total_jumps"] == 150

    # Get all workouts
    list_res = client.get("/api/workouts")
    assert list_res.status_code == 200
    assert len(list_res.json()) == 1

    # Check stats
    stats_res = client.get("/api/stats")
    assert stats_res.status_code == 200
    stats = stats_res.json()
    assert stats["total_lifetime_jumps"] == 150
    assert stats["total_sessions"] == 1
    assert stats["total_active_duration_seconds"] == 240.0
    assert stats["best_record_jumps"] == 150
    assert stats["best_record_pace"] == 37.5

    # Delete workout
    del_res = client.delete(f"/api/workouts/{workout_id}")
    assert del_res.status_code == 200

    # Verify not found
    get_after_del = client.get(f"/api/workouts/{workout_id}")
    assert get_after_del.status_code == 404


def test_empty_stats(client):
    res = client.get("/api/stats")
    assert res.status_code == 200
    data = res.json()
    assert data["total_lifetime_jumps"] == 0
    assert data["total_sessions"] == 0
    assert data["total_active_duration_seconds"] == 0.0
    assert data["best_record_jumps"] == 0
    assert data["best_record_pace"] == 0.0


def test_multiple_workouts_stats_aggregation(client):
    workout1 = {
        "start_time": "2026-11-23T08:00:00Z",
        "end_time": "2026-11-23T08:10:00Z",
        "total_jumps": 100,
        "active_duration_seconds": 300.0,
        "rest_duration_seconds": 60.0,
        "total_duration_seconds": 360.0,
        "average_jumps_per_minute": 20.0,
        "max_jumps_per_minute": 40.0
    }
    workout2 = {
        "start_time": "2026-11-23T12:00:00Z",
        "end_time": "2026-11-23T12:15:00Z",
        "total_jumps": 250,
        "active_duration_seconds": 500.0,
        "rest_duration_seconds": 100.0,
        "total_duration_seconds": 600.0,
        "average_jumps_per_minute": 30.0,
        "max_jumps_per_minute": 60.0
    }
    client.post("/api/workouts", json=workout1)
    client.post("/api/workouts", json=workout2)

    stats_res = client.get("/api/stats")
    assert stats_res.status_code == 200
    stats = stats_res.json()
    assert stats["total_lifetime_jumps"] == 350
    assert stats["total_sessions"] == 2
    assert stats["total_active_duration_seconds"] == 800.0
    assert stats["best_record_jumps"] == 250
    assert stats["best_record_pace"] == 30.0


def test_not_found_errors(client):
    assert client.get("/api/workouts/99999").status_code == 404
    assert client.delete("/api/workouts/99999").status_code == 404


def test_validation_errors(client):
    # Invalid: negative jumps
    invalid_payload = {
        "start_time": "2026-11-23T08:00:00Z",
        "end_time": "2026-11-23T08:10:00Z",
        "total_jumps": -10,
        "active_duration_seconds": 300.0,
        "rest_duration_seconds": 60.0,
        "total_duration_seconds": 360.0
    }
    res = client.post("/api/workouts", json=invalid_payload)
    assert res.status_code == 422


