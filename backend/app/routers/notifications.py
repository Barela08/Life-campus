from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from .. import models, notification_service, schemas, security
from ..database import get_db


router = APIRouter(prefix="/api/notifications", tags=["notifications"])

VALID_TYPES = {"general", "attendance", "announcement", "assignment", "exam", "important", "warning", "system", "info", "success", "danger", "error"}
VALID_PRIORITIES = {"normal", "important", "urgent"}


def _notification_query(db: Session, user: models.User):
    return db.query(models.Notification).filter(models.Notification.user_id == user.id)


def _eligible_students(db: Session, sender: models.User, request: schemas.NotificationSendRequest):
    query = db.query(models.Student).filter(models.Student.user_id.isnot(None))
    if sender.role == "teacher":
        teacher = db.query(models.Teacher).filter(models.Teacher.user_id == sender.id).first()
        if not teacher or not teacher.department_id:
            raise HTTPException(status_code=403, detail="Your teacher profile does not authorize student notifications")
        query = query.filter(models.Student.department_id == teacher.department_id)
        if request.department_id and request.department_id != teacher.department_id:
            raise HTTPException(status_code=403, detail="Teachers can notify only students in their department")
    if request.department_id:
        query = query.filter(models.Student.department_id == request.department_id)
    if request.course_id:
        query = query.filter(models.Student.course_id == request.course_id)
    if request.semester_id:
        query = query.filter(models.Student.semester_id == request.semester_id)
    if request.class_id:
        query = query.filter(models.Student.class_id == request.class_id)
    if request.section:
        query = query.filter(models.Student.section == request.section.strip())
    return query


def _eligible_recipients(db: Session, sender: models.User, request: schemas.NotificationSendRequest):
    kind = request.recipient_kind.lower()
    if sender.role == "teacher" and kind != "students":
        raise HTTPException(status_code=403, detail="Teachers can send notifications only to authorized students")
    recipients = []
    if kind in {"students", "students_teachers", "all_users"}:
        recipients.extend(_eligible_students(db, sender, request).all())
    if kind in {"teachers", "students_teachers", "all_users"}:
        if sender.role != "admin":
            raise HTTPException(status_code=403, detail="Only admins can notify teachers")
        recipients.extend(db.query(models.Teacher).filter(models.Teacher.user_id.isnot(None)).all())
        recipients.extend(db.query(models.User).filter(models.User.role == "staff", models.User.is_active.is_(True)).all())
    if kind not in {"students", "teachers", "students_teachers", "all_users"}:
        raise HTTPException(status_code=422, detail="Invalid recipient type")
    if kind == "all_users":
        recipients.extend(db.query(models.User).filter(models.User.role == "admin", models.User.is_active.is_(True)).all())
    return recipients


def _recipient_user_id(recipient):
    return recipient.id if isinstance(recipient, models.User) else recipient.user_id


def _recipient_name(recipient):
    if isinstance(recipient, models.User):
        return recipient.full_name
    return recipient.full_name


def _recipient_role(recipient):
    if isinstance(recipient, models.Student):
        return "student"
    if isinstance(recipient, models.Teacher):
        return "teacher"
    return recipient.role


@router.get("")
def list_notifications(
    unread_only: bool = False,
    limit: int = Query(default=100, ge=1, le=200),
    user: models.User = Depends(security.get_current_user),
    db: Session = Depends(get_db),
):
    query = _notification_query(db, user)
    if unread_only:
        query = query.filter(models.Notification.is_read.is_(False))
    return query.order_by(models.Notification.created_at.desc()).limit(limit).all()


@router.get("/unread-count")
def unread_count(user: models.User = Depends(security.get_current_user), db: Session = Depends(get_db)):
    return {"count": _notification_query(db, user).filter(models.Notification.is_read.is_(False)).count()}


@router.get("/recipients")
def recipients(
    query: str = "",
    department_id: int | None = None,
    course_id: int | None = None,
    semester_id: int | None = None,
    class_id: int | None = None,
    section: str | None = None,
    recipient_kind: str = "students",
    user: models.User = Depends(security.require_roles("admin", "teacher")),
    db: Session = Depends(get_db),
):
    request = schemas.NotificationSendRequest(title="x", message="x", recipient_kind=recipient_kind, department_id=department_id, course_id=course_id, semester_id=semester_id, class_id=class_id, section=section)
    recipients = _eligible_recipients(db, user, request)
    if query.strip():
        needle = query.strip().lower()
        recipients = [recipient for recipient in recipients if needle in _recipient_name(recipient).lower() or needle in getattr(recipient, "roll_number", "").lower() or needle in getattr(recipient, "teacher_id", "").lower() or needle in getattr(recipient, "student_id", getattr(recipient, "username", "")).lower()]
    return [{"id": _recipient_user_id(recipient), "user_id": _recipient_user_id(recipient), "full_name": _recipient_name(recipient), "roll_number": getattr(recipient, "roll_number", ""), "student_id": getattr(recipient, "student_id", getattr(recipient, "teacher_id", getattr(recipient, "username", ""))), "section": getattr(recipient, "section", ""), "recipient_role": _recipient_role(recipient)} for recipient in sorted(recipients, key=lambda item: _recipient_name(item).lower())[:500]]


@router.post("/send")
def send_notification(
    request: schemas.NotificationSendRequest,
    sender: models.User = Depends(security.require_roles("admin", "teacher")),
    db: Session = Depends(get_db),
):
    title, message = request.title.strip(), request.message.strip()
    if not title or not message:
        raise HTTPException(status_code=422, detail="Title and message are required")
    notification_type = request.type.lower().strip()
    priority = request.priority.lower().strip()
    if notification_type not in VALID_TYPES:
        raise HTTPException(status_code=422, detail="Invalid notification type")
    if priority not in VALID_PRIORITIES:
        raise HTTPException(status_code=422, detail="Invalid notification priority")

    eligible = _eligible_recipients(db, sender, request)
    if request.recipient_scope == "selected":
        ids = list(dict.fromkeys(request.recipient_ids))
        if not ids:
            raise HTTPException(status_code=422, detail="Select at least one recipient")
        recipients = [recipient for recipient in eligible if _recipient_user_id(recipient) in ids]
        if len(recipients) != len(ids):
            raise HTTPException(status_code=403, detail="One or more recipients are not authorized")
    else:
        recipients = eligible
    if not recipients:
        raise HTTPException(status_code=422, detail="No eligible students match the selected recipients")

    force_email = request.send_email or any(_recipient_role(recipient) in {"student", "teacher", "staff"} for recipient in recipients)
    result = notification_service.notify_users(
        db,
        [_recipient_user_id(recipient) for recipient in recipients],
        title=title,
        message=message,
        notification_type=notification_type,
        priority=priority,
        sender=sender,
        send_email=force_email,
        body_type="notification",
    )
    emails_sent = result["emails_sent"]
    emails_failed = result["emails_failed"]
    if emails_failed:
        from ..system_alerts import record_system_alert
        record_system_alert("Email delivery failure", "One or more notification emails could not be delivered. Review Email Logs for recipient-level status.")
    security.audit(db, sender.id, "notification_sent", f"Sent {result['notification_count']} notification(s)")
    return {"success": True, "notification_count": result["notification_count"], "email_requested": force_email, "emails_sent": emails_sent, "emails_failed": emails_failed}


@router.patch("/{notification_id}/read")
def mark_read(notification_id: int, user: models.User = Depends(security.get_current_user), db: Session = Depends(get_db)):
    notification = _notification_query(db, user).filter(models.Notification.id == notification_id).first()
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")
    notification.is_read, notification.read_at = True, datetime.utcnow()
    db.commit()
    return {"message": "Notification marked as read"}


@router.post("/read-all")
def mark_all_read(user: models.User = Depends(security.get_current_user), db: Session = Depends(get_db)):
    _notification_query(db, user).filter(models.Notification.is_read.is_(False)).update({"is_read": True, "read_at": datetime.utcnow()}, synchronize_session=False)
    db.commit()
    return {"message": "All notifications marked as read"}


@router.delete("/{notification_id}")
def delete_notification(notification_id: int, user: models.User = Depends(security.get_current_user), db: Session = Depends(get_db)):
    notification = _notification_query(db, user).filter(models.Notification.id == notification_id).first()
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")
    db.delete(notification)
    db.commit()
    return {"message": "Notification deleted"}
