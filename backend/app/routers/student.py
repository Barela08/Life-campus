from datetime import date, datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from ..database import get_db
from .. import models, schemas, security, attendance_service
from ..email_service import send_leave_notification

router = APIRouter(prefix="/api/student", tags=["student"])


@router.get("/dashboard")
def student_dashboard(user: models.User = Depends(security.require_roles("student")),
                      db: Session = Depends(get_db)):
    student = db.query(models.Student).filter(models.Student.user_id == user.id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student profile not found")

    records = db.query(models.AttendanceRecord).filter(models.AttendanceRecord.student_id == student.id).all()
    total = len(records)
    present = len([r for r in records if r.status == "present"])
    absent = len([r for r in records if r.status == "absent"])
    late = len([r for r in records if r.status == "late"])
    percentage = round(present / total * 100, 2) if total else 0.0

    # Subject-wise
    from collections import defaultdict
    subj_map = defaultdict(lambda: {"total": 0, "present": 0, "absent": 0})
    for r in records:
        key = r.subject or "General"
        subj_map[key]["total"] += 1
        if r.status == "present":
            subj_map[key]["present"] += 1
        elif r.status == "absent":
            subj_map[key]["absent"] += 1
    subjects = [{"name": k, **v, "percentage": round(v["present"] / v["total"] * 100, 2) if v["total"] else 0}
                for k, v in subj_map.items()]

    # Recent history
    recent = sorted(records, key=lambda r: (r.date, r.time), reverse=True)[:10]
    history = [{"date": str(r.date), "time": r.time, "subject": r.subject, "status": r.status} for r in recent]

    return {
        "student_id": student.student_id,
        "full_name": student.full_name,
        "total": total, "present": present, "absent": absent, "late": late,
        "percentage": percentage,
        "subjects": subjects,
        "history": history,
    }


@router.get("/attendance")
def student_attendance(user: models.User = Depends(security.require_roles("student")),
                       db: Session = Depends(get_db)):
    student = db.query(models.Student).filter(models.Student.user_id == user.id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student profile not found")
    records = db.query(models.AttendanceRecord).filter(models.AttendanceRecord.student_id == student.id).order_by(
        models.AttendanceRecord.date.desc()).limit(200).all()
    return [{"id": r.id, "date": str(r.date), "time": r.time, "subject": r.subject,
             "class_name": r.class_name, "status": r.status, "confidence": r.confidence,
             "method": r.method} for r in records]


@router.get("/monthly")
def student_monthly(year: int = None, month: int = None,
                    user: models.User = Depends(security.require_roles("student")),
                    db: Session = Depends(get_db)):
    student = db.query(models.Student).filter(models.Student.user_id == user.id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student profile not found")
    if year is None:
        year = date.today().year
    if month is None:
        month = date.today().month
    records = db.query(models.AttendanceRecord).filter(
        models.AttendanceRecord.student_id == student.id,
        func.strftime("%m", models.AttendanceRecord.date) == f"{month:02d}",
        func.strftime("%Y", models.AttendanceRecord.date) == str(year),
    ).all()
    present = len([r for r in records if r.status == "present"])
    total = len(records)
    return {
        "year": year, "month": month,
        "present": present, "absent": total - present,
        "percentage": round(present / total * 100, 2) if total else 0.0,
        "records": [{"date": str(r.date), "subject": r.subject, "status": r.status} for r in records],
    }


@router.get("/profile")
def student_profile(user: models.User = Depends(security.require_roles("student")),
                    db: Session = Depends(get_db)):
    student = db.query(models.Student).filter(models.Student.user_id == user.id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student profile not found")
    embeddings = db.query(models.FaceEmbedding).filter(models.FaceEmbedding.student_id == student.id).all()
    return {
        "id": student.id, "student_id": student.student_id, "full_name": student.full_name,
        "roll_number": student.roll_number, "email": student.email, "phone": student.phone,
        "department": student.department.name if student.department else "",
        "course": student.course.name if student.course else "",
        "semester": student.semester.name if student.semester else "",
        "class_name": student.class_.name if student.class_ else "",
        "profile_photo": student.profile_photo, "face_status": student.face_status,
        "registered_angles": [e.angle for e in embeddings],
    }


@router.get("/notifications", response_model=list[schemas.NotificationOut])
def student_notifications(user: models.User = Depends(security.require_roles("student")),
                          db: Session = Depends(get_db)):
    return db.query(models.Notification).filter(models.Notification.user_id == user.id).order_by(
        models.Notification.created_at.desc()).limit(50).all()


@router.post("/notifications/{nid}/read")
def mark_read(nid: int, user: models.User = Depends(security.require_roles("student")),
              db: Session = Depends(get_db)):
    n = db.query(models.Notification).filter(models.Notification.id == nid,
                                             models.Notification.user_id == user.id).first()
    if n:
        n.is_read = True
        db.commit()
    return {"message": "marked"}
