from datetime import date, datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, extract
from . import models


def compute_student_percentage(db: Session, student_id: int, subject_id: int = None) -> float:
    q = db.query(models.AttendanceRecord).filter(models.AttendanceRecord.student_id == student_id)
    if subject_id:
        q = q.filter(models.AttendanceRecord.session_id.in_(
            db.query(models.AttendanceSession.id).filter(models.AttendanceSession.subject_id == subject_id)
        ))
    records = q.all()
    if not records:
        return 0.0
    present = [r for r in records if r.status == "present"]
    return round(len(present) / len(records) * 100, 2)


def monthly_percentage(db: Session, student_id: int, month: int, year: int) -> float:
    records = db.query(models.AttendanceRecord).filter(
        models.AttendanceRecord.student_id == student_id,
        extract("month", models.AttendanceRecord.date) == month,
        extract("year", models.AttendanceRecord.date) == year,
    ).all()
    if not records:
        return 0.0
    present = [r for r in records if r.status == "present"]
    return round(len(present) / len(records) * 100, 2)



def is_duplicate(db: Session, session_id: int, student_id: int) -> bool:
    return db.query(models.AttendanceRecord).filter(
        models.AttendanceRecord.session_id == session_id,
        models.AttendanceRecord.student_id == student_id,
    ).first() is not None


def mark_present(db: Session, session: models.AttendanceSession, student: models.Student,
                 confidence: float, camera_id: str, method: str = "face") -> models.AttendanceRecord:
    now = datetime.now()
    record = models.AttendanceRecord(
        session_id=session.id,
        student_id=student.id,
        student_name=student.full_name,
        subject=session.subject.name if session.subject else "",
        class_name=session.class_.name if session.class_ else "",
        teacher=session.teacher.full_name if session.teacher else "",
        status="present",
        date=now.date(),
        time=now.strftime("%H:%M:%S"),
        confidence=confidence,
        camera_id=camera_id,
        method=method,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


def bulk_mark_absent(db: Session, session: models.AttendanceSession, exclude_student_ids: list):
    """After session end, mark enrolled students not present as absent."""
    enrolled = db.query(models.Student).filter(models.Student.class_id == session.class_id).all()
    now = datetime.now()
    for s in enrolled:
        if s.id in exclude_student_ids:
            continue
        if is_duplicate(db, session.id, s.id):
            continue
        db.add(models.AttendanceRecord(
            session_id=session.id,
            student_id=s.id,
            student_name=s.full_name,
            subject=session.subject.name if session.subject else "",
            class_name=session.class_.name if session.class_ else "",
            teacher=session.teacher.full_name if session.teacher else "",
            status="absent",
            date=now.date(),
            time="",
            confidence=0.0,
            camera_id=session.camera_id,
            method="auto",
        ))
    db.commit()


def get_attendance_overview(db: Session) -> dict:
    today = date.today()
    all_records_today = db.query(models.AttendanceRecord).filter(models.AttendanceRecord.date == today).all()
    present = len([r for r in all_records_today if r.status == "present"])
    absent = len([r for r in all_records_today if r.status == "absent"])
    late = len([r for r in all_records_today if r.status == "late"])
    total_students = db.query(models.Student).count()
    return {
        "date": str(today),
        "present": present,
        "absent": absent,
        "late": late,
        "total_students": total_students,
        "total_marked": present + absent + late,
    }
