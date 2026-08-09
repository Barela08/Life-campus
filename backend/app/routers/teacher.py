from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..database import get_db
from .. import models, security, schemas

router = APIRouter(prefix="/api/teacher", tags=["teacher"])


@router.get("/notifications", response_model=list[schemas.NotificationOut])
def teacher_notifications(user: models.User = Depends(security.require_roles("teacher")),
                          db: Session = Depends(get_db)):
    return db.query(models.Notification).filter(models.Notification.user_id == user.id).order_by(
        models.Notification.created_at.desc()).limit(50).all()


@router.get("/departments")
def teacher_departments(user: models.User = Depends(security.require_roles("teacher")),
                        db: Session = Depends(get_db)):
    depts = db.query(models.Department).all()
    return [{"id": d.id, "name": d.name, "code": d.code} for d in depts]


@router.get("/classes")
def teacher_classes(user: models.User = Depends(security.require_roles("teacher")),
                    db: Session = Depends(get_db)):
    classes = db.query(models.Class).all()
    return [{"id": c.id, "name": c.name, "code": c.code,
             "course_id": c.course_id, "semester_id": c.semester_id} for c in classes]


@router.get("/sections")
def teacher_sections(user: models.User = Depends(security.require_roles("teacher")),
                     db: Session = Depends(get_db)):
    # Distinct sections across students
    sections = db.query(models.Student.section).filter(models.Student.section != "").distinct().all()
    return [s[0] for s in sections]


@router.get("/dashboard")
def teacher_dashboard(user: models.User = Depends(security.require_roles("teacher")),
                      db: Session = Depends(get_db)):
    teacher = db.query(models.Teacher).filter(models.Teacher.user_id == user.id).first()
    if not teacher:
        raise HTTPException(status_code=404, detail="Teacher profile not found")

    sessions = db.query(models.AttendanceSession).filter(models.AttendanceSession.teacher_id == teacher.id).all()
    total_sessions = len(sessions)
    active_sessions = len([s for s in sessions if s.status == "active"])

    records = db.query(models.AttendanceRecord).filter(
        models.AttendanceRecord.session_id.in_([s.id for s in sessions])).all() if sessions else []
    present = len([r for r in records if r.status == "present"])
    absent = len([r for r in records if r.status == "absent"])

    return {
        "teacher_id": teacher.teacher_id, "full_name": teacher.full_name,
        "total_sessions": total_sessions, "active_sessions": active_sessions,
        "present": present, "absent": absent,
    }


@router.get("/sessions")
def teacher_sessions(user: models.User = Depends(security.require_roles("teacher")),
                     db: Session = Depends(get_db)):
    teacher = db.query(models.Teacher).filter(models.Teacher.user_id == user.id).first()
    if not teacher:
        raise HTTPException(status_code=404, detail="Teacher profile not found")
    sessions = db.query(models.AttendanceSession).filter(
        models.AttendanceSession.teacher_id == teacher.id).order_by(
        models.AttendanceSession.started_at.desc()).limit(50).all()
    return [{"id": s.id, "subject": s.subject.name if s.subject else "",
             "class": s.class_.name if s.class_ else "", "status": s.status,
             "started_at": str(s.started_at)} for s in sessions]


@router.get("/students")
def teacher_students(user: models.User = Depends(security.require_roles("teacher")),
                     db: Session = Depends(get_db)):
    teacher = db.query(models.Teacher).filter(models.Teacher.user_id == user.id).first()
    if not teacher:
        raise HTTPException(status_code=404, detail="Teacher profile not found")
    students = db.query(models.Student).filter(models.Student.department_id == teacher.department_id).all()
    return [{"id": s.id, "student_id": s.student_id, "full_name": s.full_name,
             "roll_number": s.roll_number, "email": s.email, "face_status": s.face_status} for s in students]


@router.get("/reports")
def teacher_reports(user: models.User = Depends(security.require_roles("teacher")),
                    db: Session = Depends(get_db)):
    teacher = db.query(models.Teacher).filter(models.Teacher.user_id == user.id).first()
    if not teacher:
        raise HTTPException(status_code=404, detail="Teacher profile not found")
    sessions = db.query(models.AttendanceSession).filter(models.AttendanceSession.teacher_id == teacher.id).all()
    session_ids = [s.id for s in sessions]
    records = db.query(models.AttendanceRecord).filter(
        models.AttendanceRecord.session_id.in_(session_ids)).all() if session_ids else []
    return [{"id": r.id, "student_name": r.student_name, "subject": r.subject,
             "class_name": r.class_name, "status": r.status, "date": str(r.date),
             "time": r.time, "method": r.method} for r in records]
