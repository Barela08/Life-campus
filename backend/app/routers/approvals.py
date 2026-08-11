"""Server-authorized profile change requests and admin reviews."""
from __future__ import annotations

import json
import logging
from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..database import get_db
from .. import models, notification_service, schemas, security

logger = logging.getLogger("lifeos.approvals")
router = APIRouter(prefix="/api/approvals", tags=["approvals"])

USER_SYNC_FIELDS = {"full_name", "email", "phone"}
ID_FIELDS = {"department_id", "course_id", "semester_id", "class_id", "subject_id"}

ALLOWED_CHANGES = {
    "student": {
        "full_name",
        "email",
        "phone",
        "parent_email",
        "profile_photo",
        "roll_number",
        "section",
        "department_id",
        "course_id",
        "semester_id",
        "class_id",
    },
    "teacher": {
        "full_name",
        "email",
        "phone",
        "department_id",
        "subject_id",
        "class_id",
        "section",
    },
    "staff": {
        "full_name",
        "email",
        "phone",
        "department_id",
        "subject_id",
        "class_id",
        "section",
    },
}

RELATED_MODELS = {
    "department_id": models.Department,
    "course_id": models.Course,
    "semester_id": models.Semester,
    "class_id": models.Class,
    "subject_id": models.Subject,
}


def _profile(user: models.User, db: Session):
    if user.role == "student":
        return user.student or db.query(models.Student).filter(models.Student.user_id == user.id).first()
    if user.role == "teacher":
        return user.teacher or db.query(models.Teacher).filter(models.Teacher.user_id == user.id).first()
    if user.role == "staff":
        return db.query(models.StaffProfile).filter(models.StaffProfile.user_id == user.id).first()
    return None


def _profile_value(user: models.User, db: Session, field: str) -> Any:
    profile = _profile(user, db)
    if profile is not None and hasattr(profile, field):
        return getattr(profile, field)
    if hasattr(user, field):
        return getattr(user, field)
    return None


def _normalize_string(value: Any, *, nullable: bool = False) -> str | None:
    if value is None:
        return None if nullable else ""
    value = str(value).strip()
    if nullable and value == "":
        return None
    return value


def _validate_email(value: Any, field: str) -> str | None:
    email = _normalize_string(value, nullable=field != "email")
    if email is None:
        return None
    email = email.lower()
    if "@" not in email or "." not in email.rsplit("@", 1)[-1]:
        raise HTTPException(status_code=422, detail=f"{field.replace('_', ' ').title()} is not a valid email address")
    return email


def _normalize_change(db: Session, role: str, field: str, value: Any) -> Any:
    if field == "email" or field == "parent_email":
        return _validate_email(value, field)
    if field in ID_FIELDS:
        if value in (None, ""):
            if role == "student" and field != "subject_id":
                raise HTTPException(status_code=422, detail=f"{field.replace('_', ' ').title()} is required")
            return None
        try:
            parsed = int(value)
        except (TypeError, ValueError):
            raise HTTPException(status_code=422, detail=f"{field.replace('_', ' ').title()} must be a valid ID")
        if not db.get(RELATED_MODELS[field], parsed):
            raise HTTPException(status_code=422, detail=f"{field.replace('_', ' ').title()} was not found")
        return parsed
    return _normalize_string(value, nullable=field in {"profile_photo"})


def _same_value(old: Any, new: Any) -> bool:
    if old is None and new in ("", None):
        return True
    return old == new


def _ensure_unique_email(db: Session, user: models.User, email: str):
    if db.query(models.User).filter(models.User.email == email, models.User.id != user.id).first():
        raise HTTPException(status_code=409, detail="Email is already registered.")
    if db.query(models.Student).filter(models.Student.email == email, models.Student.user_id != user.id).first():
        raise HTTPException(status_code=409, detail="Email is already registered.")
    if db.query(models.Teacher).filter(models.Teacher.email == email, models.Teacher.user_id != user.id).first():
        raise HTTPException(status_code=409, detail="Email is already registered.")


def _identifier(user: models.User, db: Session) -> str:
    profile = _profile(user, db)
    if isinstance(profile, models.Student):
        return profile.student_id
    if isinstance(profile, models.Teacher):
        return profile.teacher_id
    return user.username


def _display_role(role: str) -> str:
    return "teacher/staff" if role in {"teacher", "staff"} else role


def _format_changes(changes: dict, old_values: dict) -> str:
    lines = []
    for field, new_value in changes.items():
        label = field.replace("_", " ").title()
        old_value = old_values.get(field, "")
        lines.append(f"{label}: {old_value or '-'} -> {new_value or '-'}")
    return "\n".join(lines)


def _serialize(req: models.ApprovalRequest, db: Session):
    requester = db.get(models.User, req.requester_id)
    target = db.get(models.User, req.target_user_id)
    reviewer = db.get(models.User, req.reviewed_by) if req.reviewed_by else None
    changes = req.requested_changes or {}
    old_values = req.old_values or {}
    changed_fields = req.changed_fields or list(changes.keys())
    target_email = _profile_value(target, db, "email") if target else ""
    target_identifier = _identifier(target, db) if target else ""
    student = target.student if target and target.role == "student" else None
    teacher = target.teacher if target and target.role == "teacher" else None
    return {
        "id": req.id,
        "requester_id": req.requester_id,
        "requester_role": req.requester_role,
        "target_user_id": req.target_user_id,
        "request_type": req.request_type,
        "requested_changes": changes,
        "new_values": changes,
        "old_values": old_values,
        "changed_fields": changed_fields,
        "reason": req.reason or "",
        "status": req.status,
        "reviewed_by": req.reviewed_by,
        "reviewer_name": reviewer.full_name if reviewer else None,
        "rejection_reason": req.rejection_reason or "",
        "submitted_at": req.created_at.isoformat() if req.created_at else None,
        "reviewed_at": req.reviewed_at.isoformat() if req.reviewed_at else None,
        "created_at": req.created_at.isoformat() if req.created_at else None,
        "requester_name": requester.full_name if requester else "Unknown",
        "requester_email": target_email,
        "requester_identifier": target_identifier,
        "student_id": student.student_id if student else None,
        "teacher_id": teacher.teacher_id if teacher else None,
        "roll_number": student.roll_number if student else None,
        "class_name": student.class_.name if student and student.class_ else teacher.class_.name if teacher and teacher.class_ else None,
        "section": _profile_value(target, db, "section") if target else None,
    }


def _audit_detail(**data) -> str:
    return json.dumps(data, default=str, separators=(",", ":"))


def create_profile_request(req: schemas.ApprovalRequestCreate, user: models.User, db: Session):
    if user.role not in ALLOWED_CHANGES:
        raise HTTPException(status_code=403, detail="You are not authorized to create this request.")
    if not _profile(user, db):
        raise HTTPException(status_code=404, detail=f"{user.role.title()} profile not found.")
    pending = (
        db.query(models.ApprovalRequest)
        .filter(
            models.ApprovalRequest.requester_id == user.id,
            models.ApprovalRequest.request_type == "profile_change",
            models.ApprovalRequest.status == "pending",
        )
        .first()
    )
    if pending:
        raise HTTPException(status_code=409, detail="Profile change request is already pending.")

    raw_changes = req.requested_changes or {}
    blocked = sorted(set(raw_changes) - ALLOWED_CHANGES[user.role])
    if blocked:
        raise HTTPException(status_code=403, detail=f"These fields cannot be changed here: {', '.join(blocked)}")

    normalized = {
        field: _normalize_change(db, user.role, field, value)
        for field, value in raw_changes.items()
    }
    if "email" in normalized and normalized["email"]:
        _ensure_unique_email(db, user, normalized["email"])

    old_values = {field: _profile_value(user, db, field) for field in normalized}
    changes = {
        field: value
        for field, value in normalized.items()
        if not _same_value(old_values.get(field), value)
    }
    old_values = {field: old_values.get(field) for field in changes}
    if not changes:
        raise HTTPException(status_code=400, detail="No changes were detected.")

    request = models.ApprovalRequest(
        requester_id=user.id,
        requester_role=user.role,
        target_user_id=user.id,
        request_type="profile_change",
        requested_changes=changes,
        old_values=old_values,
        changed_fields=list(changes.keys()),
        reason=(req.reason or "").strip(),
        status="pending",
    )
    db.add(request)
    db.add(
        models.AuditLog(
            user_id=user.id,
            action=f"{user.role}_profile_change_requested",
            detail=_audit_detail(target_id=user.id, changed_fields=list(changes.keys()), reason=request.reason),
        )
    )
    db.commit()
    db.refresh(request)

    submitted_at = request.created_at.strftime("%Y-%m-%d %H:%M") if request.created_at else str(datetime.utcnow())
    change_summary = _format_changes(changes, old_values)
    admin_message = (
        f"{user.full_name} ({_display_role(user.role)}, ID: {_identifier(user, db)}) submitted a profile change request.\n\n"
        f"Request ID: {request.id}\nRequest date: {submitted_at}\nReason: {request.reason or '-'}\n\nRequested changes:\n{change_summary}"
    )
    notification_service.notify_admins(
        db,
        title=f"{user.role.title() if user.role != 'staff' else 'Staff'} Profile Change Request",
        message=admin_message,
        notification_type="warning",
        priority="important",
        sender=user,
        send_email=True,
        related_request_id=request.id,
        body_type="profile_change_request",
    )
    notification_service.notify_user(
        db,
        user.id,
        title="Profile change request submitted",
        message=f"Your profile change request #{request.id} is pending admin review.",
        notification_type="info",
        priority="normal",
        sender=None,
        send_email=True,
        related_request_id=request.id,
        body_type="profile_change_submitted",
    )
    return {"message": "Profile change request submitted successfully.", "request": _serialize(request, db)}


@router.get("/profile/options")
def profile_options(
    user: models.User = Depends(security.require_roles("student", "teacher", "staff")),
    db: Session = Depends(get_db),
):
    return {
        "role": user.role,
        "editable_fields": sorted(ALLOWED_CHANGES[user.role]),
        "departments": [{"id": row.id, "name": row.name} for row in db.query(models.Department).order_by(models.Department.name).all()],
        "courses": [{"id": row.id, "name": row.name, "department_id": row.department_id} for row in db.query(models.Course).order_by(models.Course.name).all()],
        "semesters": [{"id": row.id, "name": row.name, "order": row.order} for row in db.query(models.Semester).order_by(models.Semester.order).all()],
        "classes": [{"id": row.id, "name": row.name, "course_id": row.course_id, "semester_id": row.semester_id} for row in db.query(models.Class).order_by(models.Class.name).all()],
        "subjects": [{"id": row.id, "name": row.name, "department_id": row.department_id} for row in db.query(models.Subject).order_by(models.Subject.name).all()],
    }


@router.post("/profile", status_code=201)
def submit_profile_request(
    req: schemas.ApprovalRequestCreate,
    user: models.User = Depends(security.require_roles("student", "teacher", "staff")),
    db: Session = Depends(get_db),
):
    return create_profile_request(req, user, db)


@router.get("/mine")
def my_requests(
    user: models.User = Depends(security.require_roles("student", "teacher", "staff")),
    db: Session = Depends(get_db),
):
    rows = (
        db.query(models.ApprovalRequest)
        .filter(models.ApprovalRequest.requester_id == user.id)
        .order_by(models.ApprovalRequest.created_at.desc())
        .all()
    )
    return [_serialize(row, db) for row in rows]


@router.get("/review")
def review_queue(
    status: str | None = Query(default=None),
    requester_role: str | None = Query(default=None),
    search: str | None = Query(default=None),
    user: models.User = Depends(security.require_roles("admin")),
    db: Session = Depends(get_db),
):
    query = db.query(models.ApprovalRequest).filter(models.ApprovalRequest.request_type == "profile_change")
    if status:
        clean_status = status.lower()
        if clean_status not in {"pending", "approved", "rejected"}:
            raise HTTPException(status_code=422, detail="Invalid request status.")
        query = query.filter(models.ApprovalRequest.status == clean_status)
    if requester_role:
        clean_role = requester_role.lower()
        if clean_role == "teacher_staff":
            query = query.filter(models.ApprovalRequest.requester_role.in_(["teacher", "staff"]))
        elif clean_role in {"student", "teacher", "staff"}:
            query = query.filter(models.ApprovalRequest.requester_role == clean_role)
        else:
            raise HTTPException(status_code=422, detail="Invalid requester role.")

    serialized = [_serialize(row, db) for row in query.order_by(models.ApprovalRequest.created_at.desc()).all()]
    needle = (search or "").strip().lower()
    if needle:
        serialized = [
            row for row in serialized
            if needle in " ".join(
                str(row.get(key) or "").lower()
                for key in ("requester_name", "requester_email", "requester_identifier", "student_id", "teacher_id", "roll_number")
            )
        ]
    return serialized


def _apply_changes(target: models.User, db: Session, changes: dict):
    profile = _profile(target, db)
    if not profile:
        raise HTTPException(status_code=404, detail=f"{target.role.title()} profile not found.")
    for key, value in changes.items():
        if key in USER_SYNC_FIELDS:
            setattr(target, key, value or "")
        if hasattr(profile, key):
            setattr(profile, key, value)


@router.post("/{request_id}/review")
def review_request(
    request_id: int,
    payload: schemas.ApprovalReviewRequest,
    user: models.User = Depends(security.require_roles("admin")),
    db: Session = Depends(get_db),
):
    request = db.query(models.ApprovalRequest).filter(models.ApprovalRequest.id == request_id).with_for_update().first()
    if not request:
        raise HTTPException(status_code=404, detail="Request not found.")
    if request.requester_id == user.id:
        raise HTTPException(status_code=403, detail="You do not have permission to approve this request.")
    if request.status != "pending":
        raise HTTPException(status_code=409, detail="Request has already been reviewed.")
    if payload.action == "reject" and not (payload.rejection_reason or "").strip():
        raise HTTPException(status_code=422, detail="A rejection reason is required.")

    target = db.get(models.User, request.target_user_id)
    if not target:
        raise HTTPException(status_code=404, detail="Target user not found.")

    try:
        changes = request.requested_changes or {}
        if payload.action == "approve":
            if "email" in changes:
                _ensure_unique_email(db, target, str(changes["email"]).lower())
            _apply_changes(target, db, changes)
            request.status = "approved"
            title = "Profile change request approved"
            kind = "success"
            message = f"Your profile change request #{request.id} was approved."
        else:
            request.status = "rejected"
            request.rejection_reason = payload.rejection_reason.strip()
            title = "Profile change request rejected"
            kind = "danger"
            message = f"Your profile change request #{request.id} was rejected: {request.rejection_reason}"

        request.reviewed_by = user.id
        request.reviewed_at = datetime.utcnow()
        db.add(
            models.AuditLog(
                user_id=user.id,
                action=f"profile_change_{request.status}",
                detail=_audit_detail(
                    request_id=request.id,
                    target_id=target.id,
                    changed_fields=request.changed_fields or list(changes.keys()),
                    rejection_reason=request.rejection_reason or "",
                ),
            )
        )
        db.commit()
    except HTTPException:
        db.rollback()
        raise
    except Exception:
        db.rollback()
        logger.exception("Unable to review approval request %s", request_id)
        raise HTTPException(status_code=500, detail="Unable to save profile request review.")

    notification_service.notify_user(
        db,
        target.id,
        title=title,
        message=message,
        notification_type=kind,
        priority="important",
        sender=user,
        send_email=True,
        related_request_id=request.id,
        body_type=f"profile_change_{request.status}",
    )
    db.refresh(request)
    return {"message": f"Request {request.status} successfully.", "request": _serialize(request, db)}
