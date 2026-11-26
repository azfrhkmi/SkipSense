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
    poolclass=StaticPool,
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


def _register_and_headers(client: TestClient, username: str, email: str, password: str = "StrongPass1!"):
    res = client.post(
        "/api/auth/register",
        json={"username": username, "email": email, "password": password},
    )
    assert res.status_code == 201, res.text
    csrf = res.json()["csrf_token"]
    return {"X-CSRF-Token": csrf}, res.json()["user"]


def _bootstrap_admin(client: TestClient, username: str = "secadmin", email: str = "admin@skipsense.com"):
    res = client.post(
        "/api/auth/bootstrap-admin",
        json={"username": username, "email": email, "password": "AdminMaster99!"},
    )
    assert res.status_code == 201, res.text
    return {"X-CSRF-Token": res.json()["csrf_token"]}, res.json()["user"]


def test_health_check_and_security_headers(client):
    res = client.get("/api/health")
    assert res.status_code == 200
    assert res.json()["status"] == "ok"
    assert res.headers.get("X-Content-Type-Options") == "nosniff"
    assert res.headers.get("X-Frame-Options") == "DENY"
    assert "no-store" in (res.headers.get("Cache-Control") or "")


def test_unauthenticated_access_blocked(client):
    assert client.get("/api/workouts").status_code == 401
    assert client.get("/api/stats").status_code == 401
    assert client.get("/api/admin/overview").status_code == 401


def test_password_strength_and_csrf_protection(client):
    # Weak password rejected
    weak_res = client.post(
        "/api/auth/register",
        json={"username": "weakuser", "email": "weak@test.com", "password": "password"},
    )
    assert weak_res.status_code == 422

    # Register valid user
    headers, _ = _register_and_headers(client, "alice", "alice@test.com")

    # Mutating request with cookie auth WITHOUT CSRF header is rejected (403)
    payload = {
        "start_time": "2026-11-26T10:00:00Z",
        "end_time": "2026-11-26T10:05:00Z",
        "total_jumps": 120,
        "active_duration_seconds": 180.0,
        "total_duration_seconds": 180.0,
        "average_jumps_per_minute": 40.0,
    }
    no_csrf_res = client.post("/api/workouts", json=payload)
    assert no_csrf_res.status_code == 403

    # With matching X-CSRF-Token header succeeds
    ok_res = client.post("/api/workouts", json=payload, headers=headers)
    assert ok_res.status_code == 201
    assert ok_res.json()["total_jumps"] == 120


def test_user_isolation_and_idor_threat_logging(client):
    # Bootstrap admin first
    admin_headers, _ = _bootstrap_admin(client)

    # Create Alice (user A) and record workout
    alice_client = TestClient(app)
    alice_headers, _ = _register_and_headers(alice_client, "alice", "alice@test.com")
    w_res = alice_client.post(
        "/api/workouts",
        json={
            "start_time": "2026-11-26T10:00:00Z",
            "end_time": "2026-11-26T10:05:00Z",
            "exercise_type": "push_up",
            "workout_mode": "20",
            "target_reps": 20,
            "completed_reps": 20,
            "active_duration_seconds": 90.0,
            "total_duration_seconds": 90.0,
            "average_jumps_per_minute": 13.3,
        },
        headers=alice_headers,
    )
    assert w_res.status_code == 201
    alice_workout_id = w_res.json()["id"]

    # Bob (user B) logs in
    bob_client = TestClient(app)
    bob_headers, _ = _register_and_headers(bob_client, "bobuser", "bob@test.com")

    # Bob sees empty personal workouts
    assert len(bob_client.get("/api/workouts").json()) == 0

    # Bob tries to access or delete Alice's workout -> 403 IDOR blocked
    assert bob_client.get(f"/api/workouts/{alice_workout_id}").status_code == 403
    assert bob_client.delete(f"/api/workouts/{alice_workout_id}", headers=bob_headers).status_code == 403

    # Bob tries to hit admin overview -> 403 Privilege Escalation blocked
    assert bob_client.get("/api/admin/overview").status_code == 403

    # Admin inspects threats and sees both IDOR_ACCESS_DENIED and PRIVILEGE_ESCALATION_ATTEMPT
    threats = client.get("/api/admin/threats", headers=admin_headers).json()
    event_types = {t["event_type"] for t in threats}
    assert "IDOR_ACCESS_DENIED" in event_types
    assert "PRIVILEGE_ESCALATION_ATTEMPT" in event_types


def test_brute_force_lockout_and_admin_unlock(client):
    admin_headers, _ = _bootstrap_admin(client)
    user_client = TestClient(app)
    _, victim = _register_and_headers(user_client, "victim", "victim@test.com", "SafePass123!")

    attacker = TestClient(app)
    # 4 failed attempts return 401
    for _ in range(4):
        res = attacker.post("/api/auth/login", json={"identifier": "victim", "password": "WrongPassword!"})
        assert res.status_code == 401

    # 5th failed attempt locks account (423 Locked)
    lock_res = attacker.post("/api/auth/login", json={"identifier": "victim", "password": "WrongPassword!"})
    assert lock_res.status_code == 423

    # Even valid password fails while locked
    valid_while_locked = attacker.post("/api/auth/login", json={"identifier": "victim", "password": "SafePass123!"})
    assert valid_while_locked.status_code == 423

    # Admin unlocks victim account & verifies threat logged
    unlock_res = client.post(f"/api/admin/users/{victim['id']}/unlock", headers=admin_headers)
    assert unlock_res.status_code == 200

    # Victim can sign in again after admin unlock
    ok_res = attacker.post("/api/auth/login", json={"identifier": "victim", "password": "SafePass123!"})
    assert ok_res.status_code == 200


def test_admin_user_dashboard_suspension_and_injection_shield(client):
    admin_headers, _ = _bootstrap_admin(client)
    u_client = TestClient(app)
    u_headers, u_data = _register_and_headers(u_client, "athlete1", "athlete1@test.com")
    u_client.post(
        "/api/workouts",
        json={
            "start_time": "2026-11-26T10:00:00Z",
            "end_time": "2026-11-26T10:02:00Z",
            "total_jumps": 150,
            "active_duration_seconds": 120.0,
            "total_duration_seconds": 120.0,
            "average_jumps_per_minute": 75.0,
        },
        headers=u_headers,
    )

    # Admin opens user dashboard
    dash = client.get(f"/api/admin/users/{u_data['id']}/dashboard", headers=admin_headers)
    assert dash.status_code == 200
    assert dash.json()["stats"]["total_lifetime_jumps"] == 150
    assert len(dash.json()["recent_workouts"]) == 1

    # Admin suspends user -> user session immediately rejected
    sus = client.post(f"/api/admin/users/{u_data['id']}/toggle-active", headers=admin_headers)
    assert sus.status_code == 200
    assert sus.json()["is_active"] is False
    assert u_client.get("/api/workouts").status_code == 403

    # Security shield blocks SQLi/scanner probes and logs them
    probe_res = client.get("/api/workouts?q=' UNION SELECT * FROM users--")
    assert probe_res.status_code == 403
    scan_res = client.get("/wp-login.php")
    assert scan_res.status_code == 403

    threats = client.get("/api/admin/threats", headers=admin_headers).json()
    threat_types = {t["event_type"] for t in threats}
    assert "INJECTION_PROBE" in threat_types
    assert "PATH_SCAN_PROBE" in threat_types
