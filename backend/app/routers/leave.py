"""Leave applications with server-side ownership and reviewer-scope checks."""
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from ..database import get_db
from .. import email_service, models, notification_service, schemas, security

router = APIRouter(prefix="/api/leave", tags=["leave"])


def _applicant(row, db):
    if row.applicant_id:
        return db.get(models.User, row.applicant_id)
    student = db.get(models.Student, row.student_id) if row.student_id else None
    return student.user if student else None


def _out(row, db):
    applicant = _applicant(row, db); reviewer = db.get(models.User, row.reviewed_by) if row.reviewed_by else None
    start, end = row.from_date or row.date, row.to_date or row.date
    student = applicant.student if applicant and applicant.student else None
    return {"id": row.id, "applicant_name": applicant.full_name if applicant else "Unknown", "applicant_role": row.applicant_role or "student",
            "student_id": student.student_id if student else "", "roll_number": student.roll_number if student else "",
            "department": student.department.name if student and student.department else "", "class": student.class_.name if student and student.class_ else "", "section": student.section if student else "",
            "leave_type": row.leave_type or "general", "from_date": str(start) if start else None, "to_date": str(end) if end else None,
            "days": ((end - start).days + 1) if start and end else 0, "reason": row.reason, "status": row.status,
            "attachment_url": row.attachment_url or "", "reviewed_at": row.reviewed_at.isoformat() if row.reviewed_at else None,
            "reviewer": reviewer.full_name if reviewer else None, "rejection_reason": row.rejection_reason or "",
            "created_at": row.created_at.isoformat() if row.created_at else None}


@router.post("", status_code=201)
def apply(req: schemas.LeaveRequestCreate, user: models.User = Depends(security.require_roles("student", "teacher")), db: Session = Depends(get_db)):
    if req.to_date < req.from_date:
        raise HTTPException(status_code=422, detail="The end date must be on or after the start date")
    row = models.LeaveRequest(applicant_id=user.id, applicant_role=user.role, leave_type=req.leave_type.strip(),
                              from_date=req.from_date, to_date=req.to_date, date=req.from_date, reason=req.reason.strip(),
                              attachment_url=req.attachment_url or "", status="pending",
                              student_id=user.student.id if user.role == "student" and user.student else None)
    db.add(row); db.flush()
    # This configuration assigns all leave review to admins.  Teachers only
    # manage their own leave and never receive other users' private requests.
    if user.role == "student" and user.student:
        # Only teachers assigned to this exact student cohort see private leave.
        teachers = db.query(models.Teacher).filter(models.Teacher.department_id == user.student.department_id, models.Teacher.class_id == user.student.class_id).all()
        recipients = [t.user for t in teachers if t.user and (not t.section or t.section == user.student.section) and security.has_permission(db, t.user, "leave.view")]
    else:
        recipients = db.query(models.User).filter(models.User.role == "admin", models.User.is_active.is_(True)).all()
    db.add(models.AuditLog(user_id=user.id, action="leave_submitted", detail=f"leave_id={row.id}")); db.commit()
    # Notifications and email are intentionally sent only after the leave is durable.
    for reviewer in recipients:
        body = email_service.build_basic_email("New Leave Request", reviewer.full_name, "A leave request requires your review.", {
            "Applicant": user.full_name, "Role": user.role.title(), "Start Date": row.from_date,
            "End Date": row.to_date, "Reason": row.reason, "Current Status": "Pending",
        })
        notification_service.notify_user(
            db,
            reviewer.id,
            title="Leave request pending",
            message=f"{user.full_name} submitted a leave request.",
            notification_type="warning",
            priority="important",
            sender=user,
            send_email=True,
            email_subject="LifeOS Smart Campus - New Leave Request",
            email_html=body,
            body_type="leave_submitted",
        )
    notification_service.notify_user(
        db,
        user.id,
        title="Leave request submitted",
        message="Your leave application is pending review.",
        notification_type="info",
        priority="normal",
        sender=user,
        send_email=True,
        body_type="leave_submitted_applicant",
    )
    return {"message": "Leave request submitted successfully.", "leave": _out(row, db)}


@router.get("/mine")
@router.get("/my")
def mine(user: models.User = Depends(security.require_roles("student", "teacher")), db: Session = Depends(get_db)):
    return [_out(r, db) for r in db.query(models.LeaveRequest).filter(models.LeaveRequest.applicant_id == user.id).order_by(models.LeaveRequest.created_at.desc()).all()]


@router.post("/{leave_id}/cancel")
def cancel(leave_id: int, user: models.User = Depends(security.require_roles("student", "teacher")), db: Session = Depends(get_db)):
    row = db.get(models.LeaveRequest, leave_id)
    if not row or row.applicant_id != user.id: raise HTTPException(status_code=404, detail="Leave request not found")
    if row.status != "pending": raise HTTPException(status_code=409, detail="Only pending leave requests can be cancelled")
    row.status = "cancelled"; row.updated_at = datetime.utcnow(); db.add(models.AuditLog(user_id=user.id, action="leave_cancelled", detail=f"leave_id={row.id}")); db.commit()
    return {"message": "Leave request cancelled successfully."}


def _can_review(row, user, db):
    if row.applicant_id == user.id: return False
    if user.role == "admin": return True
    if row.applicant_role != "student" or not security.has_permission(db, user, "leave.view"):
        return False
    applicant = _applicant(row, db)
    teacher = user.teacher
    return bool(applicant and applicant.student and teacher and teacher.department_id == applicant.student.department_id and teacher.class_id == applicant.student.class_id and (not teacher.section or teacher.section == applicant.student.section))


@router.get("/review")
def review_queue(status: str | None = Query(None), role: str | None = Query(None), user: models.User = Depends(security.get_current_user), db: Session = Depends(get_db)):
    rows = db.query(models.LeaveRequest).order_by(models.LeaveRequest.created_at.desc()).all()
    return [_out(r, db) for r in rows if _can_review(r, user, db) and (not status or r.status == status) and (not role or r.applicant_role == role)]


@router.post("/{leave_id}/review")
def review(leave_id: int, req: schemas.LeaveReviewRequest, user: models.User = Depends(security.get_current_user), db: Session = Depends(get_db)):
    row = db.query(models.LeaveRequest).filter(models.LeaveRequest.id == leave_id).with_for_update().first()
    if not row: raise HTTPException(status_code=404, detail="Leave request not found")
    if row.status != "pending": raise HTTPException(status_code=409, detail="Leave request has already been reviewed.")
    if not _can_review(row, user, db): raise HTTPException(status_code=403, detail="You are not authorized to perform this action.")
    required_permission = "leave.approve" if req.action == "approve" else "leave.reject"
    if user.role != "admin" and not security.has_permission(db, user, required_permission):
        raise HTTPException(status_code=403, detail=f"Permission denied: You do not have {required_permission} permission.")
    if req.action == "reject" and not (req.rejection_reason or "").strip(): raise HTTPException(status_code=422, detail="A rejection reason is required")
    applicant = _applicant(row, db); row.status = "approved" if req.action == "approve" else "rejected"; row.reviewed_by = user.id; row.reviewed_at = datetime.utcnow(); row.rejection_reason = (req.rejection_reason or "").strip()
    db.add(models.AuditLog(user_id=user.id, action=f"leave_{row.status}", detail=f"leave_id={row.id};applicant={applicant.id}")); db.commit()
    status_title = row.status.capitalize()
    body_rows = {"Name": applicant.full_name, "Leave dates": f"{row.from_date or row.date} to {row.to_date or row.date}", "Reason": row.reason, f"{status_title} by": user.full_name, "Status": status_title}
    if row.rejection_reason:
        body_rows["Rejection reason"] = row.rejection_reason
    body = email_service.build_basic_email(f"Leave {status_title}", applicant.full_name, f"Your leave request has been {row.status}.", body_rows)
    notification_service.notify_user(
        db,
        applicant.id,
        title=f"Leave request {row.status}",
        message=("Your leave request was approved." if row.status == "approved" else f"Your leave request was rejected: {row.rejection_reason}"),
        notification_type="success" if row.status == "approved" else "danger",
        priority="important",
        sender=user,
        send_email=True,
        email_subject=f"LifeOS Smart Campus - Leave {status_title}",
        email_html=body,
        body_type=f"leave_{row.status}",
    )
    return {"message": f"Leave request {row.status} successfully.", "leave": _out(row, db)}
