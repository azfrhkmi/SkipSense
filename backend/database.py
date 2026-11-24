import os
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

# Default database file path: data/skipsense.db relative to project root
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "data")
os.makedirs(DATA_DIR, exist_ok=True)
DB_PATH = os.path.join(DATA_DIR, "skipsense.db")

DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{DB_PATH}")

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def migrate_db():
    """Safely migrate SQLite database schema for v1.2 without data loss."""
    from sqlalchemy import text
    try:
        with engine.connect() as conn:
            result = conn.execute(text("PRAGMA table_info(workout_sessions)"))
            columns = [row[1] for row in result.fetchall()]
            if not columns:
                return

            alterations = [
                ("exercise_type", "VARCHAR(20) DEFAULT 'skipping'"),
                ("workout_mode", "VARCHAR(20) DEFAULT 'standard'"),
                ("target_reps", "INTEGER"),
                ("completed_reps", "INTEGER DEFAULT 0"),
                ("completion_status", "VARCHAR(20) DEFAULT 'completed'"),
            ]
            for col_name, col_type in alterations:
                if col_name not in columns:
                    conn.execute(text(f"ALTER TABLE workout_sessions ADD COLUMN {col_name} {col_type}"))
            conn.commit()
    except Exception as e:
        # Avoid crashing if table doesn't exist yet or connection fails
        print(f"Database migration notice: {e}")


def init_db():
    from . import models
    Base.metadata.create_all(bind=engine)
    migrate_db()

