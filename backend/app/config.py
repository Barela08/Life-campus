import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent


class Settings:
    APP_NAME = "LifeOS Smart Campus"
    SECRET_KEY = os.getenv("SECRET_KEY", "lifeos-smart-campus-secret-key-change-in-production")
    ALGORITHM = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 8
    REFRESH_TOKEN_EXPIRE_DAYS = 7

    DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{BASE_DIR / 'data' / 'lifeos.db'}")

    # Uploads
    UPLOAD_DIR = BASE_DIR / "uploads"
    FACE_UPLOAD_DIR = BASE_DIR / "uploads" / "faces"
    SNAPSHOT_DIR = BASE_DIR / "uploads" / "snapshots"
    UNKNOWN_DIR = BASE_DIR / "uploads" / "unknowns"
    EXPORT_DIR = BASE_DIR / "exports"

    # Face config
    FACE_MATCH_THRESHOLD = float(os.getenv("FACE_MATCH_THRESHOLD", "0.52"))
    EMBEDDING_ENCRYPT_KEY = os.getenv("EMBEDDING_ENCRYPT_KEY", "lifeos-embedding-encryption-key")

    # Email config (Gmail SMTP) — matches required env var structure
    SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
    SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
    SMTP_USERNAME = os.getenv("SMTP_USERNAME", "")
    SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
    SMTP_FROM_EMAIL = os.getenv("SMTP_FROM_EMAIL", "")
    SMTP_USE_TLS = os.getenv("SMTP_USE_TLS", "true").lower() == "true"
    EMAIL_ENABLED = os.getenv("EMAIL_ENABLED", "false").lower() == "true"

    # Backwards-compatible alias
    @property
    def SMTP_USER(self) -> str:
        return self.SMTP_USERNAME

    @property
    def EMAIL_FROM(self) -> str:
        return self.SMTP_FROM_EMAIL or self.SMTP_USERNAME

    # Rate limiting
    RATE_LIMIT_ENABLED = os.getenv("RATE_LIMIT_ENABLED", "false").lower() == "true"

    # CORS
    CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",")

    def ensure_dirs(self):
        for d in [self.UPLOAD_DIR, self.FACE_UPLOAD_DIR, self.SNAPSHOT_DIR, self.UNKNOWN_DIR, self.EXPORT_DIR,
                  BASE_DIR / "data"]:
            d.mkdir(parents=True, exist_ok=True)


settings = Settings()