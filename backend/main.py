from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .database import init_db
from .routers import workouts, stats


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize SQLite database and tables on startup
    init_db()
    yield


app = FastAPI(
    title="SkipSense API",
    description="Backend API for SkipSense - AI-Powered Skipping Counter",
    version="1.0.0",
    lifespan=lifespan
)

# Allow CORS for local network and Vite dev server access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(workouts.router)
app.include_router(stats.router)


@app.get("/api/health")
def health_check():
    return {"status": "ok", "app": "SkipSense v1.0"}

