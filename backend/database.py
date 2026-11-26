import os
from sqlalchemy import create_engine, text
from sqlalchemy.orm import declarative_base, sessionmaker

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IS_VERCEL = bool(os.getenv("VERCEL"))


def _resolve_database_url() -> str:
    env_url = os.getenv("DATABASE_URL") or os.getenv("POSTGRES_URL")
    if env_url:
        # Normalize Neon / Heroku postgres:// -> postgresql+psycopg:// for SQLAlchemy + Psycopg 3
        if env_url.startswith("postgres://"):
            return env_url.replace("postgres://", "postgresql+psycopg://", 1)
        if env_url.startswith("postgresql://"):
            return env_url.replace("postgresql://", "postgresql+psycopg://", 1)
        return env_url

    if IS_VERCEL:
        # Ephemeral fallback only if DATABASE_URL wasn't configured yet on Vercel
        return "sqlite:////tmp/skipsense.db"

    data_dir = os.path.join(BASE_DIR, "data")
    os.makedirs(data_dir, exist_ok=True)
    db_path = os.path.join(data_dir, "skipsense.db")
    return f"sqlite:///{db_path}"


DATABASE_URL = _resolve_database_url()
IS_SQLITE = DATABASE_URL.startswith("sqlite")

engine_kwargs = {"pool_pre_ping": True}
if IS_SQLITE:
    engine_kwargs["connect_args"] = {"check_same_thread": False}
else:
    # Serverless connection pool tuning for Neon/Supabase PostgreSQL
    engine_kwargs["pool_recycle"] = 300
    engine_kwargs["pool_size"] = 5
    engine_kwargs["max_overflow"] = 5

engine = create_engine(DATABASE_URL, **engine_kwargs)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


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
                # PostgreSQL safe column migrations if upgrading an existing database
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
    admin_username = os.getenv("ADMIN_USERNAME", "admin").strip()

    if not admin_email or not admin_password:
        return

    from . import models
    from .security import hash_password

    db = SessionLocal()
    try:
        existing = db.query(models.User).filter(models.User.email == admin_email).first()
        if not existing:
            admin_user = models.User(
                username=admin_username,
                email=admin_email,
                password_hash=hash_password(admin_password),
                role="admin",
                is_active=True,
                token_version=1,
            )
            db.add(admin_user)
            db.commit()
            db.refresh(admin_user)

            # Claim any pre-auth local legacy workouts for initial admin owner
            db.query(models.WorkoutSession).filter(
                models.WorkoutSession.user_id.is_(None)
            ).update({"user_id": admin_user.id})
            db.commit()
    except Exception as e:
        db.rollback()
        print(f"Admin bootstrap notice: {e}")
    finally:
        db.close()


def init_db():
    from . import models  # noqa: F401
    Base.metadata.create_all(bind=engine)
    migrate_db()
    bootstrap_admin_from_env()
