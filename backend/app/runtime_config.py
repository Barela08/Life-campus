"""Database-backed SMTP overrides. Environment values remain the fallback."""
import base64
import hashlib
from cryptography.fernet import Fernet, InvalidToken
from sqlalchemy.orm import Session

from .config import settings
from . import models

SMTP_KEYS = {"smtp_host": "SMTP_HOST", "smtp_port": "SMTP_PORT", "smtp_username": "SMTP_USERNAME", "smtp_password": "SMTP_PASSWORD", "smtp_from_email": "SMTP_FROM_EMAIL", "smtp_from_name": "SMTP_FROM_NAME", "smtp_use_tls": "SMTP_USE_TLS", "email_enabled": "EMAIL_ENABLED"}

def _fernet():
    key = base64.urlsafe_b64encode(hashlib.sha256(settings.EMBEDDING_ENCRYPT_KEY.encode()).digest())
    return Fernet(key)

def encrypt(value: str) -> str:
    return _fernet().encrypt(value.encode()).decode()

def decrypt(value: str) -> str:
    try: return _fernet().decrypt(value.encode()).decode()
    except (InvalidToken, ValueError): return ""

def apply_runtime_smtp_settings(db: Session) -> None:
    try:
        for row in db.query(models.SystemConfig).filter(models.SystemConfig.key.in_(SMTP_KEYS)).all():
            value = decrypt(row.value) if row.is_secret else row.value
            if not value and row.is_secret: continue
            attr = SMTP_KEYS[row.key]
            if attr == "SMTP_PORT": value = int(value)
            elif attr in {"SMTP_USE_TLS", "EMAIL_ENABLED"}: value = str(value).lower() == "true"
            setattr(settings, attr, value)
    finally:
        db.close()
