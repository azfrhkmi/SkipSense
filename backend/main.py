import mimetypes
import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from .database import BASE_DIR, IS_VERCEL, ensure_db_initialized, get_db, get_db_diagnostics
from .routers import admin, auth, stats, workouts
from .security import detect_malicious_payload, get_client_ip, log_security_event

mimetypes.add_type("application/wasm", ".wasm")


@asynccontextmanager
async def lifespan(app: FastAPI):
    ensure_db_initialized()
    yield


app = FastAPI(
    title="SkipSense API",
    description="Security-Hardened Backend API for SkipSense",
    version="1.3.0",
    lifespan=lifespan,
    docs_url="/api/docs" if not IS_VERCEL else None,
    redoc_url=None,
)


def _get_allowed_origins() -> list[str]:
    origins = [
        "https://localhost:5173",
        "https://127.0.0.1:5173",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]
    vercel_url = os.getenv("VERCEL_URL")
    if vercel_url:
        origins.append(f"https://{vercel_url}")
    prod_url = os.getenv("VERCEL_PROJECT_PRODUCTION_URL")
    if prod_url:
        origins.append(f"https://{prod_url}")
    custom_origins = os.getenv("ALLOWED_ORIGINS", "")
    for item in custom_origins.split(","):
        cleaned = item.strip()
        if cleaned:
            origins.append(cleaned)
    return origins


app.add_middleware(
    CORSMiddleware,
    allow_origins=_get_allowed_origins(),
    allow_origin_regex=r"^https://(192\.168|10\.|172\.(1[6-9]|2\d|3[01]))\.[0-9.]+:5173$",
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "X-CSRF-Token", "X-Setup-Key"],
)


@app.middleware("http")
async def security_guard_and_headers_middleware(request: Request, call_next):
    # 1. Inspect path & query string for automated injection/traversal/scanner probes
    threat = detect_malicious_payload(request.url.path, request.url.query)
    if threat:
        event_type, severity, details = threat
        db_gen_fn = request.app.dependency_overrides.get(get_db, get_db)
        db_gen = db_gen_fn()
        db = next(db_gen)
        try:
            log_security_event(
                db,
                event_type=event_type,
                severity=severity,
                ip_address=get_client_ip(request),
                user_agent=request.headers.get("user-agent", ""),
                endpoint=request.url.path,
                details=details,
            )
        except Exception:
            pass
        finally:
            try:
                next(db_gen)
            except StopIteration:
                pass

        return JSONResponse(
            status_code=403,
            content={"detail": "Blocked by SkipSense Security Shield."},
        )

    response = await call_next(request)

    # 2. Enforce OWASP HTTP security headers
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "camera=(self), microphone=(), geolocation=()"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    if request.url.path.startswith("/api/"):
        response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate"
    if request.headers.get("x-forwarded-proto") == "https" or IS_VERCEL:
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"

    return response


app.include_router(auth.router)
app.include_router(workouts.router)
app.include_router(stats.router)
app.include_router(admin.router)


@app.get("/api/health")
def health_check():
    ensure_db_initialized()
    return {
        "status": "ok",
        "app": "SkipSense v1.3",
        "db": get_db_diagnostics(),
        "dist_exists": _DIST_DIR.exists(),
    }


# Mount built Vite frontend (used as fallback in Vercel FastAPI mode or unified local serving)
_DIST_DIR = Path(BASE_DIR) / "frontend" / "dist"
if _DIST_DIR.exists():
    for _sub in ("assets", "wasm", "models"):
        _sub_dir = _DIST_DIR / _sub
        if _sub_dir.exists():
            app.mount(f"/{_sub}", StaticFiles(directory=str(_sub_dir)), name=f"static_{_sub}")

    @app.get("/{full_path:path}", include_in_schema=False)
    def serve_spa(full_path: str):
        if full_path == "api" or full_path.startswith("api/"):
            raise HTTPException(status_code=404, detail="Not Found")

        if full_path:
            try:
                candidate = (_DIST_DIR / full_path).resolve()
                if candidate.is_relative_to(_DIST_DIR.resolve()) and candidate.is_file():
                    return FileResponse(str(candidate))
            except Exception:
                pass

        index_file = _DIST_DIR / "index.html"
        if index_file.exists():
            return FileResponse(str(index_file))
        raise HTTPException(status_code=404, detail="Not Found")
