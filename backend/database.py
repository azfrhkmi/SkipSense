import os
import re
from typing import Optional
from sqlalchemy import create_engine, text
from sqlalchemy.orm import declarative_base, sessionmaker
from sqlalchemy.pool import NullPool

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IS_VERCEL = bool(os.getenv("VERCEL"))


def _clean_db_url(raw: str) -> str:
    val = raw.strip()
    # Handle accidental paste of KEY=value from .env
    if val.upper().startswith("DATABASE_URL="):
        val = val.split("=", 1)[1].strip()
    elif val.upper().startswith("POSTGRES_URL="):
        val = val.split("=", 1)[1].strip()

    # Handle accidental paste of Neon CLI snippet: psql 'postgresql://...'
    if val.lower().startswith("psql "):
        val = val[5:].strip()

    # Strip surrounding single or double quotes
    if len(val) >= 2 and ((val[0] == "'" and val[-1] == "'") or (val[0] == '"' and val[-1] == '"')):
        val = val[1:-1].strip()

    # Normalize postgres:// -> postgresql+psycopg:// for SQLAlchemy + Psycopg 3
    if val.startswith("postgres://"):
        return val.replace("postgres://", "postgresql+psycopg://", 1)
    if val.startswith("postgresql://"):
        return val.replace("postgresql://", "postgresql+psycopg://", 1)
    return val


def _resolve_database_url() -> str:
    env_url = os.getenv("DATABASE_URL") or os.getenv("POSTGRES_URL")
    if env_url and env_url.strip():
        return _clean_db_url(env_url)

    if IS_VERCEL:
        return "sqlite:////tmp/skipsense.db"

    data_dir = os.path.join(BASE_DIR, "data")
    os.makedirs(data_dir, exist_ok=True)
    db_path = os.path.join(data_dir, "skipsense.db")
    return f"sqlite:///{db_path}"


DATABASE_URL = _resolve_database_url()
IS_SQLITE = DATABASE_URL.startswith("sqlite")

_db_config_error: Optional[str] = None
_db_initialized = False
_db_init_error: Optional[str] = None


def _build_engine():
    global DATABASE_URL, IS_SQLITE, _db_config_error
    try:
        kwargs = {"pool_pre_ping": True}
        if IS_SQLITE:
            kwargs["connect_args"] = {"check_same_thread": False}
        else:
            kwargs["connect_args"] = {"connect_timeout": 8}
            if IS_VERCEL:
                # Serverless functions work cleanest with NullPool or Neon's external PgBouncer pooler
                kwargs["poolclass"] = NullPool
            else:
                kwargs["pool_recycle"] = 300
                kwargs["pool_size"] = 5
                kwargs["max_overflow"] = 5
        return create_engine(DATABASE_URL, **kwargs)
    except Exception as exc:
        _db_config_error = f"DB URL error ({type(exc).__name__}): check DATABASE_URL format"
        print(_db_config_error)
        DATABASE_URL = "sqlite:////tmp/skipsense_fallback.db" if IS_VERCEL else f"sqlite:///{os.path.join(BASE_DIR, 'data', 'skipsense.db')}"
        IS_SQLITE = True
        return create_engine(DATABASE_URL, connect_args={"check_same_thread": False})


engine = _build_engine()
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db_diagnostics() -> dict:
    return {
        "backend": "sqlite" if IS_SQLITE else "postgresql",
        "initialized": _db_initialized,
        "error": _db_config_error or _db_init_error,
    }


def migrate_db():
    """Safely migrate existing SQLite or PostgreSQL schemas without losing data."""
    try:
        with engine.connect() as conn:
            if IS_SQLITE:
                result = conn.execute(text("PRAGMA table_info(workout_sessions)"))
                columns = [row[1] for row in result.fetchall()]
                if columns:
                    alterations = [
                        ("exercise_type", "VARCHAR(20) DEFAULT 'skipping'"),
                        ("workout_mode", "VARCHAR(20) DEFAULT 'standard'"),
                        ("target_reps", "INTEGER"),
                        ("completed_reps", "INTEGER DEFAULT 0"),
                        ("completion_status", "VARCHAR(20) DEFAULT 'completed'"),
                        ("user_id", "INTEGER"),
                    ]
                    for col_name, col_type in alterations:
                        if col_name not in columns:
                            conn.execute(
                                text(f"ALTER TABLE workout_sessions ADD COLUMN {col_name} {col_type}")
                            )
                conn.commit()
            else:
                pg_alters = [
                    "ALTER TABLE workout_sessions ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE",
                    "ALTER TABLE workout_sessions ADD COLUMN IF NOT EXISTS exercise_type VARCHAR(20) DEFAULT 'skipping'",
                    "ALTER TABLE workout_sessions ADD COLUMN IF NOT EXISTS workout_mode VARCHAR(20) DEFAULT 'standard'",
                    "ALTER TABLE workout_sessions ADD COLUMN IF NOT EXISTS target_reps INTEGER",
                    "ALTER TABLE workout_sessions ADD COLUMN IF NOT EXISTS completed_reps INTEGER DEFAULT 0",
                    "ALTER TABLE workout_sessions ADD COLUMN IF NOT EXISTS completion_status VARCHAR(20) DEFAULT 'completed'",
                ]
                for stmt in pg_alters:
                    conn.execute(text(stmt))
                conn.commit()
    except Exception as e:
        print(f"Database migration notice: {e}")


def bootstrap_admin_from_env():
    """Creates or ensures admin account if ADMIN_EMAIL & ADMIN_PASSWORD are provided via env."""
    admin_email = os.getenv("ADMIN_EMAIL", "").strip().lower()
    admin_password = os.getenv("ADMIN_PASSWORD", "")
    admin_username = os.getenv("ADMIN_USERNAME", "admin").strip() or "admin"

    if not admin_email or not admin_password:
        return

    from . import models
    from .security import hash_password

    db = SessionLocal()
    try:
        existing = db.query(models.User).filter(models.User.email == admin_email).first()
        if not existing:
            # Ensure username doesn't collide
            safe_username = re.sub(r"[^a-zA-Z0-9_.-]", "", admin_username)[:30] or "admin"
            if db.query(models.User).filter(models.User.username == safe_username).first():
                safe_username = f"{safe_username}_admin"[:30]

            admin_user = models.User(
                username=safe_username,
                email=admin_email,
                password_hash=hash_password(admin_password),
                role="admin",
                is_active=True,
                token_version=1,
            )
            db.add(admin_user)
            db.commit()
            db.refresh(admin_user)

            db.query(models.WorkoutSession).filter(
                models.WorkoutSession.user_id.is_(None)
            ).update({"user_id": admin_user.id})
            db.commit()
    except Exception as e:
        db.rollback()
        print(f"Admin bootstrap notice: {e}")
    finally:
        db.close()


def ensure_db_initialized() -> bool:
    """Thread/cold-start safe lazy DB initializer that never crashes module import."""
    global _db_initialized, _db_init_error
    if _db_config_error:
        return False
    if _db_initialized:
        return True
    try:
        from . import models  # noqa: F401
        Base.metadata.create_all(bind=engine)
        migrate_db()
        bootstrap_admin_from_env()
        _db_initialized = True
        _db_init_error = None
        return True
    except Exception as exc:
        # Redact credentials if any URL leaked in exception message
        safe_msg = re.sub(r"://[^@]+@", "://***:***@", str(exc))
        _db_init_error = f"{type(exc).__name__}: {safe_msg[:180]}"
        print(f"Database init warning: {_db_init_error}")
        return False


def init_db():
    ensure_db_initialized()


def get_db():
    ensure_db_initialized()
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
