from datetime import datetime, timedelta
import logging
from .database import SessionLocal
from . import models, notification_service

logger = logging.getLogger("lifeos")

def record_system_alert(title: str, message: str) -> None:
    """Create at most one matching admin alert every 15 minutes; never raise."""
    db = SessionLocal()
    try:
        recent = db.query(models.Notification).filter(models.Notification.type == "system", models.Notification.title == title, models.Notification.created_at >= datetime.utcnow() - timedelta(minutes=15)).first()
        if recent:
            recent.message, recent.created_at, recent.is_read = message, datetime.utcnow(), False
            db.commit()
        else:
            notification_service.notify_admins(db, title=title, message=message, notification_type="system", priority="urgent", send_email=True)
    except Exception:
        db.rollback()
        logger.exception("Failed to persist system alert")
    finally:
        db.close()
