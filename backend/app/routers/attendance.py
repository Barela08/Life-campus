from datetime import date, datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..database import get_db
from .. import models, schemas, security, attendance_service
from ..email_service import send_attendance_missed

router = APIRouter(prefix="/api/attendance", tags=["attendance"])


# ---- Public metadata for the Attendance terminal (no auth needed) ----
@router.get("/meta/departments")
def meta_departments(db: Session = Depends(get_db)):
    depts = db.query(models.Department).all()
    return [{"id": d.id, "name": d.name, "code": d.code} for d in depts]


@router.get("/meta/classes")
def meta_classes(department_id: int = None, db: Session = Depends(get_db)):
    q = db.query(models.Class).join(models.Course).filter(models.Course.department_id == department_id) if department_id else db.query(models.Class)
    classes = q.all()
    return [{"id": c.id, "name": c.name, "code": c.code} for c in classes]


@router.get("/meta/sections")
def meta_sections(department_id: int = None, class_id: int = None, db: Session = Depends(get_db)):
    q = db.query(models.Student.section).filter(models.Student.section != "")
    if department_id:
        q = q.filter(models.Student.department_id == department_id)
    if class_id:
        q = q.filter(models.Student.class_id == class_id)
    sections = q.distinct().all()
    return [s[0] for s in sections]


@router.post("/start")
def start_session(req: schemas.StartSessionRequest,
                  user: models.User = Depends(security.require_roles("teacher", "admin")),
                  db: Session = Depends(get_db)):
    teacher = None
    if user.role == "teacher":
        teacher = db.query(models.Teacher).filter(models.Teacher.user_id == user.id).first()
        if not teacher:
            raise HTTPException(status_code=404, detail="Teacher profile not found")
    elif user.role == "admin":
        teacher = db.query(models.Teacher).first()
        if not teacher:
            raise HTTPException(status_code=400, detail="Create a teacher first")

    dept = db.query(models.Department).get(req.department_id)
    cls = db.query(models.Class).get(req.class_id)
    if not dept or not cls:
        raise HTTPException(status_code=404, detail="Department or Class not found")
    subject_id = req.subject_id
    if user.role == "teacher" and teacher.subject_id:
        if subject_id and subject_id != teacher.subject_id:
            raise HTTPException(status_code=403, detail="You may only take attendance for your assigned subject")
        subject_id = teacher.subject_id
    if subject_id:
        subject = db.get(models.Subject, subject_id)
        if not subject or subject.department_id != req.department_id:
            raise HTTPException(status_code=422, detail="Subject does not belong to the selected department")

    session = models.AttendanceSession(
        teacher_id=teacher.id, department_id=req.department_id,
        subject_id=subject_id, class_id=req.class_id, section=req.section,
        camera_id=req.camera_id, status="active",
    )
    db.add(session); db.commit(); db.refresh(session)
    return {"session_id": session.id, "status": "active", "started_at": str(session.started_at)}


@router.post("/stop/{session_id}")
def stop_session(session_id: int,
                 user: models.User = Depends(security.require_roles("teacher", "admin")),
                 db: Session = Depends(get_db)):
    session = db.query(models.AttendanceSession).get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if user.role == "teacher" and (not session.teacher or session.teacher.user_id != user.id):
        raise HTTPException(status_code=403, detail="You may only stop your own attendance session")
    if session.status == "closed":
        return {"message": "Session already closed"}
    session.status = "closed"
    session.ended_at = datetime.utcnow()
    db.commit()
    # Mark absent for enrolled students not present
    present_ids = [r.student_id for r in db.query(models.AttendanceRecord).filter(
        models.AttendanceRecord.session_id == session_id).all()]
    attendance_service.bulk_mark_absent(db, session, present_ids)
    return {"message": "Session closed", "session_id": session_id}


@router.get("/session/{session_id}")
def get_session(session_id: int, user: models.User = Depends(security.require_roles("teacher", "admin")), db: Session = Depends(get_db)):
    session = db.query(models.AttendanceSession).get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if user.role == "teacher" and (not session.teacher or session.teacher.user_id != user.id):
        raise HTTPException(status_code=403, detail="You may only record attendance for your own session")
    records = db.query(models.AttendanceRecord).filter(models.AttendanceRecord.session_id == session_id).all()
    return {
        "session_id": session.id,
        "status": session.status,
        "subject": session.subject.name if session.subject else "",
        "class": session.class_.name if session.class_ else "",
        "teacher": session.teacher.full_name if session.teacher else "",
        "started_at": str(session.started_at),
        "records": [{"id": r.id, "student_name": r.student_name, "status": r.status,
                     "time": r.time, "confidence": r.confidence} for r in records],
    }


@router.post("/manual")
def manual_attendance(req: schemas.ManualAttendanceRequest,
                      user: models.User = Depends(security.require_roles("teacher", "admin")),
                      db: Session = Depends(get_db)):
    session = db.query(models.AttendanceSession).get(req.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    student = db.query(models.Student).get(req.student_id)
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    if user.role == "teacher" and (not session.teacher or session.teacher.user_id != user.id):
        raise HTTPException(status_code=403, detail="You may only record attendance for your own session")
    if attendance_service.is_duplicate(db, session.id, student.id):
        raise HTTPException(status_code=400, detail="Attendance already recorded")
    now = datetime.now()
    record = models.AttendanceRecord(
        session_id=session.id, student_id=student.id, student_name=student.full_name,
        subject=session.subject.name if session.subject else "",
        class_name=session.class_.name if session.class_ else "",
        teacher=session.teacher.full_name if session.teacher else "",
        status=req.status, date=now.date(), time=now.strftime("%H:%M:%S"),
        confidence=1.0, camera_id="manual", method="manual",
    )
    db.add(record); db.commit()
    return {"message": "Manual attendance recorded", "record_id": record.id}


@router.get("/records")
def attendance_records(date: date = None, student_id: int = None, class_id: int = None,
                       subject_id: int = None, db: Session = Depends(get_db)):
    q = db.query(models.AttendanceRecord)
    if date:
        q = q.filter(models.AttendanceRecord.date == date)
    if student_id:
        q = q.filter(models.AttendanceRecord.student_id == student_id)
    if class_id:
        q = q.filter(models.AttendanceRecord.session_id.in_(
            db.query(models.AttendanceSession.id).filter(models.AttendanceSession.class_id == class_id)))
    if subject_id:
        q = q.filter(models.AttendanceRecord.session_id.in_(
            db.query(models.AttendanceSession.id).filter(models.AttendanceSession.subject_id == subject_id)))
    records = q.order_by(models.AttendanceRecord.created_at.desc()).limit(200).all()
    return [{"id": r.id, "student_name": r.student_name, "subject": r.subject, "class_name": r.class_name,
             "status": r.status, "date": str(r.date), "time": r.time, "confidence": r.confidence,
             "method": r.method, "teacher": r.teacher} for r in records]


@router.put("/records/{record_id}")
def update_attendance_record(record_id: int, req: schemas.AttendanceRecordUpdate,
                             user: models.User = Depends(security.require_roles("teacher", "admin")),
                             db: Session = Depends(get_db)):
    if req.status not in {"present", "absent", "late"}:
        raise HTTPException(status_code=400, detail="Status must be present, absent, or late")
    record = db.query(models.AttendanceRecord).get(record_id)
    if not record:
        raise HTTPException(status_code=404, detail="Attendance record not found")
    if user.role == "teacher":
        teacher = db.query(models.Teacher).filter(models.Teacher.user_id == user.id).first()
        if not teacher or not record.session or record.session.teacher_id != teacher.id:
            raise HTTPException(status_code=403, detail="Not allowed to edit this attendance record")
    
    old_status = record.status
    record.status = req.status
    
    # Audit log
    db.add(models.AuditLog(
        user_id=user.id,
        action="attendance_corrected",
        detail=f"Attendance for {record.student_name} on {record.date} changed from {old_status} to {req.status} by {user.full_name}"
    ))
    db.commit()
    db.refresh(record)
    
    # Recalculate percentage for student
    pct = attendance_service.compute_student_percentage(db, record.student_id)
    
    return {
        "message": "Attendance updated successfully.",
        "record": {
            "id": record.id,
            "student_name": record.student_name,
            "status": record.status,
            "date": str(record.date),
            "time": record.time,
            "method": record.method,
            "student_percentage": pct,
        }
    }



@router.get("/sessions")
def list_sessions(db: Session = Depends(get_db)):
    sessions = db.query(models.AttendanceSession).order_by(models.AttendanceSession.started_at.desc()).limit(50).all()
    return [{"id": s.id, "teacher": s.teacher.full_name if s.teacher else "",
             "subject": s.subject.name if s.subject else "",
             "class": s.class_.name if s.class_ else "",
             "status": s.status, "started_at": str(s.started_at)} for s in sessions]


@router.get("/overview")
def overview(db: Session = Depends(get_db)):
    return attendance_service.get_attendance_overview(db)


@router.get("/student/{student_id}/percentage")
def student_percentage(student_id: int, subject_id: int = None, db: Session = Depends(get_db)):
    return {"percentage": attendance_service.compute_student_percentage(db, student_id, subject_id)}
