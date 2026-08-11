from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
import logging
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import inspect, text
from sqlalchemy.orm import Session

from .config import settings
from .database import engine, Base, SessionLocal
from . import models, security
from .routers import auth, admin, face, attendance, student, teacher, export, notifications, approvals, leave, roles
from .face_service import get_engine

logger = logging.getLogger("lifeos")

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

        if "notifications" in inspector.get_table_names():
            existing = {col["name"] for col in inspector.get_columns("notifications")}
            desired_notifications = {
                "sender_user_id": "INTEGER",
                "sender_name": "VARCHAR DEFAULT ''",
                "sender_role": "VARCHAR DEFAULT 'system'",
                "priority": "VARCHAR DEFAULT 'normal'",
                "read_at": "TIMESTAMP",
                "email_requested": "BOOLEAN DEFAULT FALSE",
                "email_status": "VARCHAR DEFAULT 'not_requested'",
                "email_error": "TEXT DEFAULT ''",
            }
            with engine.begin() as conn:
                for column, ddl in desired_notifications.items():
                    if column not in existing:
                        conn.execute(text(f"ALTER TABLE notifications ADD COLUMN {column} {ddl}"))
                if "related_request_id" not in existing:
                    conn.execute(text("ALTER TABLE notifications ADD COLUMN related_request_id INTEGER"))
        if "approval_requests" in inspector.get_table_names():
            existing = {col["name"] for col in inspector.get_columns("approval_requests")}
            json_array_ddl = "JSONB NOT NULL DEFAULT '[]'::jsonb" if engine.dialect.name == "postgresql" else "JSON DEFAULT '[]'"
            desired_approval = {
                "changed_fields": json_array_ddl,
                "reason": "TEXT DEFAULT ''",
            }
            with engine.begin() as conn:
                for column, ddl in desired_approval.items():
                    if column not in existing:
                        conn.execute(text(f"ALTER TABLE approval_requests ADD COLUMN {column} {ddl}"))
        if "system_config" in inspector.get_table_names():
            existing = {col["name"] for col in inspector.get_columns("system_config")}
            with engine.begin() as conn:
                if "is_secret" not in existing:
                    conn.execute(text("ALTER TABLE system_config ADD COLUMN is_secret BOOLEAN DEFAULT FALSE"))
                if "updated_by" not in existing:
                    conn.execute(text("ALTER TABLE system_config ADD COLUMN updated_by INTEGER"))

        if "leave_requests" in inspector.get_table_names():
            existing = {col["name"] for col in inspector.get_columns("leave_requests")}
            desired_leave = {
                "applicant_id": "INTEGER", "applicant_role": "VARCHAR DEFAULT 'student'", "leave_type": "VARCHAR DEFAULT 'general'",
                "from_date": "DATE", "to_date": "DATE", "attachment_url": "VARCHAR DEFAULT ''", "reviewed_by": "INTEGER",
                "reviewed_at": "TIMESTAMP", "rejection_reason": "TEXT DEFAULT ''", "updated_at": "TIMESTAMP",
            }
            with engine.begin() as conn:
                for column, ddl in desired_leave.items():
                    if column not in existing:
                        conn.execute(text(f"ALTER TABLE leave_requests ADD COLUMN {column} {ddl}"))
        if "password_reset_tokens" in inspector.get_table_names():
            existing = {col["name"] for col in inspector.get_columns("password_reset_tokens")}
            with engine.begin() as conn:
                for column, ddl in {"otp_hash": "VARCHAR DEFAULT ''", "attempt_count": "INTEGER DEFAULT 0", "verified_at": "TIMESTAMP"}.items():
                    if column not in existing:
                        conn.execute(text(f"ALTER TABLE password_reset_tokens ADD COLUMN {column} {ddl}"))

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
    from .runtime_config import apply_runtime_smtp_settings
    apply_runtime_smtp_settings(db=SessionLocal())
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
app.include_router(notifications.router)
app.include_router(approvals.router)
app.include_router(leave.router)
app.include_router(roles.router)


@app.exception_handler(Exception)
async def unexpected_error_handler(request: Request, exc: Exception):
    """Log unexpected failures and create one debounced, safe admin alert."""
    logger.exception("Unexpected server error on %s", request.url.path)
    if not request.url.path.startswith("/api/notifications"):
        try:
            from .system_alerts import record_system_alert
            record_system_alert("Unexpected server error", "An unexpected server error occurred. Please check the server logs.")
        except Exception:
            logger.exception("Unable to record system alert")
    return JSONResponse(status_code=500, content={"detail": "A server error occurred. Please try again later."})


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
