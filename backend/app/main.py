from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import inspect, text
from sqlalchemy.orm import Session

from .config import settings
from .database import engine, Base, SessionLocal
from . import models, security
from .routers import auth, admin, face, attendance, student, teacher, export
from .face_service import get_engine

settings.ensure_dirs()


def seed_admin():
    try:
        db = SessionLocal()
        exists = db.query(models.User).filter(models.User.username == "admin").first()
        if not exists:
            admin = models.User(
                username="admin", email="admin@lifeos.edu", full_name="System Administrator",
                hashed_password=security.hash_password("1234"), role="admin",
                must_change_password=False,
            )
            db.add(admin)
            db.commit()
    except Exception as e:
        print(f"Skipping seed_admin due to DB error: {e}")
    finally:
        try:
            db.close()
        except:
            pass


def ensure_schema_updates():
    try:
        inspector = inspect(engine)
        if "users" in inspector.get_table_names():
            user_columns = {col["name"] for col in inspector.get_columns("users")}
            if "phone" not in user_columns:
                with engine.begin() as conn:
                    conn.execute(text("ALTER TABLE users ADD COLUMN phone VARCHAR DEFAULT ''"))
        if "email_logs" in inspector.get_table_names():
            existing = {col["name"] for col in inspector.get_columns("email_logs")}
            desired = {
                "student_id": "INTEGER",
                "attendance_id": "INTEGER",
                "recipient_email": "VARCHAR DEFAULT ''",
                "error_message": "TEXT DEFAULT ''",
                "sent_at": "TIMESTAMP",
            }
            with engine.begin() as conn:
                for column, ddl in desired.items():
                    if column in existing:
                        continue
                    conn.execute(text(f"ALTER TABLE email_logs ADD COLUMN {column} {ddl}"))

        if "unknown_face_logs" in inspector.get_table_names():
            existing = {col["name"] for col in inspector.get_columns("unknown_face_logs")}
            desired_unknowns = {
                "session_id": "INTEGER",
                "department_name": "VARCHAR DEFAULT ''",
                "course_name": "VARCHAR DEFAULT ''",
                "semester_name": "VARCHAR DEFAULT ''",
                "class_name": "VARCHAR DEFAULT ''",
                "subject_name": "VARCHAR DEFAULT ''",
                "teacher_name": "VARCHAR DEFAULT ''",
                "reason": "VARCHAR DEFAULT 'Unrecognized face'",
                "status": "VARCHAR DEFAULT 'Unrecognized'",
            }
            with engine.begin() as conn:
                for column, ddl in desired_unknowns.items():
                    if column in existing:
                        continue
                    conn.execute(text(f"ALTER TABLE unknown_face_logs ADD COLUMN {column} {ddl}"))
    except Exception as e:
        print(f"Skipping schema updates due to DB error: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    ensure_schema_updates()
    seed_admin()
    yield


app = FastAPI(title=settings.APP_NAME, lifespan=lifespan)

cors_origins = list(set(settings.CORS_ORIGINS + ["http://localhost:5173", "http://127.0.0.1:5173"]))

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve uploads statically
app.mount("/uploads", StaticFiles(directory=str(settings.UPLOAD_DIR)), name="uploads")

app.include_router(auth.router)
app.include_router(admin.router)
app.include_router(face.router)
app.include_router(attendance.router)
app.include_router(student.router)
app.include_router(teacher.router)
app.include_router(export.router)


@app.get("/api/health")
def health():
    return {"status": "ok", "app": settings.APP_NAME, "face_engine": get_engine()}


@app.middleware("http")
async def check_maintenance_mode(request: Request, call_next):
    # Enforce maintenance mode for non-admin API routes
    path = request.url.path
    if path.startswith("/api/") and request.method != "OPTIONS":
        bypass_paths = [
            "/api/auth/login", "/api/auth/me", "/api/auth/branding",
            "/api/branding", "/api/health", "/api/admin"
        ]
        is_bypassed = any(path.startswith(bp) for bp in bypass_paths)
        if not is_bypassed:
            # Check DB for maintenance mode
            db = SessionLocal()
            try:
                row = db.query(models.SystemConfig).filter(models.SystemConfig.key == "maintenance_mode").first()
                if row and row.value and row.value.lower() in ("true", "1", "on"):
                    # Verify if request has admin token
                    auth_header = request.headers.get("authorization", "")
                    token = auth_header.replace("Bearer ", "") if auth_header else ""
                    payload = security.decode_token(token) if token else None
                    if not payload or payload.get("role") != "admin":
                        return JSONResponse(
                            status_code=530,
                            content={"detail": "Life Campus is currently in maintenance mode. Admin access remains available."}
                        )
            except Exception:
                pass
            finally:
                db.close()

    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    return response
