from __future__ import annotations

from datetime import datetime
from concurrent.futures import ThreadPoolExecutor
from typing import Iterable, Optional

from sqlalchemy.orm import Session

from . import email_service, models
from .config import settings

_email_executor = ThreadPoolExecutor(max_workers=3, thread_name_prefix="lifeos-email")


def safe_email_error(error: object) -> str:
    """Return a frontend-safe SMTP error without credentials or stack traces."""
    text = str(error or "").strip() or "Email delivery failed"
    for secret in (
        getattr(settings, "SMTP_PASSWORD", ""),
        getattr(settings, "SMTP_USERNAME", ""),
        getattr(settings, "SMTP_FROM_EMAIL", ""),
    ):
        if secret:
            text = text.replace(secret, "[redacted]")
    if len(text) > 1000:
        text = text[:997] + "..."
    return text


def _add_email_log(
    db: Session,
    to_email: str,
    subject: str,
    body_type: str,
    status: str,
    error: str = "",
    student_id: int | None = None,
):
    db.add(
        models.EmailLog(
            student_id=student_id,
            recipient_email=to_email,
            to_email=to_email,
            subject=subject,
            body_type=body_type,
            status=status,
            error_message=error,
            error=error,
            sent_at=datetime.utcnow() if status == "sent" else None,
        )
    )
    if status == "failed":
        db.add(
            models.EmailDeliveryFailureLog(
                to_email=to_email,
                subject=subject,
                body_type=body_type,
                error=error,
            )
        )


def _student_profile_id(user: models.User) -> int | None:
    return user.student.id if user.role == "student" and user.student else None


def _sender_fields(sender: models.User | None) -> dict:
    if not sender:
        return {"sender_user_id": None, "sender_name": "LifeOS Smart Campus", "sender_role": "system"}
    return {"sender_user_id": sender.id, "sender_name": sender.full_name, "sender_role": sender.role}


def _new_notification(
    user_id: int,
    title: str,
    message: str,
    notification_type: str,
    priority: str,
    sender: models.User | None,
    related_request_id: int | None,
    send_email: bool,
    email_status: str | None = None,
    email_error: str = "",
) -> models.Notification:
    requested = send_email or bool(email_status and email_status != "not_requested")
    return models.Notification(
        user_id=user_id,
        title=title,
        message=message,
        type=notification_type,
        priority=priority,
        related_request_id=related_request_id,
        email_requested=requested,
        email_status=email_status or ("pending" if send_email else "not_requested"),
        email_error=email_error,
        **_sender_fields(sender),
    )


def deliver_notification_email(
    db: Session,
    notification: models.Notification,
    recipient: models.User | None = None,
    *,
    email_subject: str | None = None,
    email_html: str | None = None,
    body_type: str = "notification",
) -> tuple[bool, str]:
    recipient = recipient or db.get(models.User, notification.user_id)
    subject = email_subject or f"[LifeOS Smart Campus] {notification.title}"
    if not recipient:
        notification.email_requested = True
        notification.email_status = "failed"
        notification.email_error = "Recipient account not found"
        return False, notification.email_error

    if email_html:
        ok, error = email_service.send_email(recipient.email, subject, email_html)
    else:
        ok, error = email_service.send_notification_email(
            recipient.email,
            recipient.full_name,
            notification.title,
            notification.message,
            notification.type,
            notification.sender_name or "LifeOS Smart Campus",
            notification.created_at or datetime.utcnow(),
        )

    safe_error = "" if ok else safe_email_error(error)
    notification.email_requested = True
    notification.email_status = "sent" if ok else "failed"
    notification.email_error = safe_error
    _add_email_log(
        db,
        recipient.email,
        subject,
        body_type,
        notification.email_status,
        safe_error,
        student_id=_student_profile_id(recipient),
    )
    return ok, safe_error


def _deliver_notification_email_async(
    notification_id: int,
    email_subject: str | None,
    email_html: str | None,
    body_type: str,
) -> None:
    """SMTP is external I/O; use an isolated DB session outside API requests."""
    from .database import SessionLocal
    db = SessionLocal()
    try:
        notification = db.get(models.Notification, notification_id)
        if not notification:
            return
        deliver_notification_email(
            db,
            notification,
            email_subject=email_subject,
            email_html=email_html,
            body_type=body_type,
        )
        db.commit()
    except Exception:
        db.rollback()
    finally:
        db.close()


def notify_users(
    db: Session,
    user_ids: Iterable[int],
    *,
    title: str,
    message: str,
    notification_type: str = "info",
    priority: str = "normal",
    sender: models.User | None = None,
    send_email: bool = True,
    related_request_id: int | None = None,
    email_subject: str | None = None,
    email_html: str | None = None,
    body_type: str = "notification",
    email_status_override: str | None = None,
    email_error_override: str = "",
) -> dict:
    ids = list(dict.fromkeys(int(user_id) for user_id in user_ids if user_id))
    notifications: list[models.Notification] = []
    for user_id in ids:
        notification = _new_notification(
            user_id,
            title.strip(),
            message.strip(),
            notification_type,
            priority,
            sender,
            related_request_id,
            send_email and not email_status_override,
            email_status=email_status_override,
            email_error=safe_email_error(email_error_override) if email_error_override else "",
        )
        db.add(notification)
        notifications.append(notification)

    if not notifications:
        return {"notification_count": 0, "emails_sent": 0, "emails_failed": 0, "email_requested": False}

    db.commit()
    for notification in notifications:
        db.refresh(notification)

    emails_sent = emails_failed = 0
    if send_email and not email_status_override:
        for notification in notifications:
            _email_executor.submit(
                _deliver_notification_email_async,
                notification.id,
                email_subject,
                email_html,
                body_type,
            )

    return {
        "notification_count": len(notifications),
        "emails_sent": emails_sent,
        "emails_failed": emails_failed,
        "emails_queued": len(notifications) if send_email and not email_status_override else 0,
        "email_requested": send_email or bool(email_status_override),
        "notifications": notifications,
    }


def notify_user(db: Session, user_id: int, **kwargs) -> dict:
    return notify_users(db, [user_id], **kwargs)


def notify_admins(db: Session, **kwargs) -> dict:
    admins = db.query(models.User).filter(models.User.role == "admin", models.User.is_active.is_(True)).all()
    return notify_users(db, [admin.id for admin in admins], **kwargs)
