from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
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


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
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
