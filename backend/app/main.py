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
    db.close()


def ensure_schema_updates():
    inspector = inspect(engine)
    if "users" in inspector.get_table_names():
        user_columns = {col["name"] for col in inspector.get_columns("users")}
        if "phone" not in user_columns:
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE users ADD COLUMN phone VARCHAR DEFAULT ''"))
    if "email_logs" not in inspector.get_table_names():
        return
    existing = {col["name"] for col in inspector.get_columns("email_logs")}
    desired = {
        "student_id": "INTEGER",
        "attendance_id": "INTEGER",
        "recipient_email": "VARCHAR DEFAULT ''",
        "error_message": "TEXT DEFAULT ''",
        "sent_at": "DATETIME",
    }
    with engine.begin() as conn:
        for column, ddl in desired.items():
            if column in existing:
                continue
            conn.execute(text(f"ALTER TABLE email_logs ADD COLUMN {column} {ddl}"))


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    ensure_schema_updates()
    seed_admin()
    yield


app = FastAPI(title=settings.APP_NAME, lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
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
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    return response
