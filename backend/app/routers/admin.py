import os
from datetime import date, datetime
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from ..database import get_db
from .. import models, schemas, security, email_service
from ..config import settings
from ..attendance_service import get_attendance_overview, compute_student_percentage

router = APIRouter(prefix="/api/admin", tags=["admin"])
admin_only = Depends(security.require_roles("admin"))


# ---------- Dashboard ----------
@router.get("/dashboard")
def admin_dashboard(db: Session = Depends(get_db), _=admin_only):
    overview = get_attendance_overview(db)
    students = db.query(models.Student).count()
    teachers = db.query(models.Teacher).count()
    departments = db.query(models.Department).count()
    classes = db.query(models.Class).count()
    subjects = db.query(models.Subject).count()
    unknown_alerts = db.query(models.UnknownFaceLog).count()
    pending_faces = db.query(models.Student).filter(models.Student.face_status == "pending").count()
    recent_records = db.query(models.AttendanceRecord).order_by(models.AttendanceRecord.created_at.desc()).limit(10).all()
    recent = [{
        "id": r.id, "student_name": r.student_name, "subject": r.subject,
        "status": r.status, "date": str(r.date), "time": r.time, "confidence": r.confidence,
    } for r in recent_records]
    return {
        "overview": overview,
        "counts": {"students": students, "teachers": teachers, "departments": departments,
                   "classes": classes, "subjects": subjects},
        "unknown_alerts": unknown_alerts,
        "pending_faces": pending_faces,
        "recent_attendance": recent,
    }


# ---------- Departments ----------
@router.post("/departments", response_model=schemas.DepartmentOut)
def create_department(req: schemas.DepartmentCreate, db: Session = Depends(get_db), _=admin_only):
    if db.query(models.Department).filter(models.Department.code == req.code).first():
        raise HTTPException(status_code=400, detail="Department code already exists")
    d = models.Department(name=req.name, code=req.code, description=req.description)
    db.add(d); db.commit(); db.refresh(d)
    return d


@router.get("/departments", response_model=list[schemas.DepartmentOut])
def list_departments(db: Session = Depends(get_db), _=admin_only):
    return db.query(models.Department).all()


@router.delete("/departments/{dept_id}")
def delete_department(dept_id: int, db: Session = Depends(get_db), _=admin_only):
    d = db.query(models.Department).get(dept_id)
    if not d:
        raise HTTPException(status_code=404, detail="Department not found")
    db.delete(d); db.commit()
    return {"message": "Department deleted"}


# ---------- Courses ----------
@router.post("/courses", response_model=schemas.CourseOut)
def create_course(req: schemas.CourseCreate, db: Session = Depends(get_db), _=admin_only):
    if db.query(models.Course).filter(models.Course.code == req.code).first():
        raise HTTPException(status_code=400, detail="Course code already exists")
    c = models.Course(name=req.name, code=req.code, duration=req.duration, department_id=req.department_id)
    db.add(c); db.commit(); db.refresh(c)
    return c


@router.get("/courses", response_model=list[schemas.CourseOut])
def list_courses(db: Session = Depends(get_db), _=admin_only):
    return db.query(models.Course).all()


@router.delete("/courses/{course_id}")
def delete_course(course_id: int, db: Session = Depends(get_db), _=admin_only):
    c = db.query(models.Course).get(course_id)
    if not c:
        raise HTTPException(status_code=404, detail="Course not found")
    db.delete(c); db.commit()
    return {"message": "Course deleted"}


# ---------- Semesters ----------
@router.post("/semesters", response_model=schemas.SemesterOut)
def create_semester(req: schemas.SemesterCreate, db: Session = Depends(get_db), _=admin_only):
    s = models.Semester(name=req.name, code=req.code, order=req.order)
    db.add(s); db.commit(); db.refresh(s)
    return s


@router.get("/semesters", response_model=list[schemas.SemesterOut])
def list_semesters(db: Session = Depends(get_db), _=admin_only):
    return db.query(models.Semester).all()


@router.delete("/semesters/{sem_id}")
def delete_semester(sem_id: int, db: Session = Depends(get_db), _=admin_only):
    s = db.query(models.Semester).get(sem_id)
    if not s:
        raise HTTPException(status_code=404, detail="Semester not found")
    db.delete(s); db.commit()
    return {"message": "Semester deleted"}


# ---------- Classes ----------
@router.post("/classes", response_model=schemas.ClassOut)
def create_class(req: schemas.ClassCreate, db: Session = Depends(get_db), _=admin_only):
    c = models.Class(name=req.name, code=req.code, course_id=req.course_id, semester_id=req.semester_id)
    db.add(c); db.commit(); db.refresh(c)
    return c


@router.get("/classes", response_model=list[schemas.ClassOut])
def list_classes(db: Session = Depends(get_db), _=admin_only):
    return db.query(models.Class).all()


@router.delete("/classes/{class_id}")
def delete_class(class_id: int, db: Session = Depends(get_db), _=admin_only):
    c = db.query(models.Class).get(class_id)
    if not c:
        raise HTTPException(status_code=404, detail="Class not found")
    db.delete(c); db.commit()
    return {"message": "Class deleted"}


# ---------- Subjects ----------
@router.post("/subjects", response_model=schemas.SubjectOut)
def create_subject(req: schemas.SubjectCreate, db: Session = Depends(get_db), _=admin_only):
    if db.query(models.Subject).filter(models.Subject.code == req.code).first():
        raise HTTPException(status_code=400, detail="Subject code already exists")
    s = models.Subject(name=req.name, code=req.code, department_id=req.department_id)
    db.add(s); db.commit(); db.refresh(s)
    return s


@router.get("/subjects", response_model=list[schemas.SubjectOut])
def list_subjects(db: Session = Depends(get_db), _=admin_only):
    return db.query(models.Subject).all()


@router.delete("/subjects/{subject_id}")
def delete_subject(subject_id: int, db: Session = Depends(get_db), _=admin_only):
    s = db.query(models.Subject).get(subject_id)
    if not s:
        raise HTTPException(status_code=404, detail="Subject not found")
    db.delete(s); db.commit()
    return {"message": "Subject deleted"}


# ---------- Students ----------
@router.post("/students", response_model=schemas.StudentOut)
def create_student(req: schemas.StudentCreate, db: Session = Depends(get_db), _=admin_only):
    if db.query(models.Student).filter(models.Student.student_id == req.student_id).first():
        raise HTTPException(status_code=400, detail="Student ID already exists")
    if db.query(models.Student).filter(models.Student.email == req.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    user = models.User(
        username=req.student_id, email=str(req.email), full_name=req.full_name,
        hashed_password=security.hash_password(req.password), role="student",
        must_change_password=True,
    )
    db.add(user); db.flush()
    student = models.Student(
        user_id=user.id, student_id=req.student_id, full_name=req.full_name,
        roll_number=req.roll_number, section=req.section, department_id=req.department_id,
        course_id=req.course_id,
        semester_id=req.semester_id, class_id=req.class_id, email=str(req.email),
        phone=req.phone, parent_email=str(req.parent_email) if req.parent_email else None,
    )
    db.add(student); db.commit(); db.refresh(student)
    return student


@router.get("/students", response_model=list[schemas.StudentOut])
def list_students(db: Session = Depends(get_db), _=admin_only):
    return db.query(models.Student).all()


@router.put("/students/{student_id}", response_model=schemas.StudentOut)
def update_student(student_id: int, req: schemas.StudentUpdate, db: Session = Depends(get_db), _=admin_only):
    s = db.query(models.Student).get(student_id)
    if not s:
        raise HTTPException(status_code=404, detail="Student not found")
    for field, value in req.dict(exclude_unset=True).items():
        setattr(s, field, value)
    db.commit(); db.refresh(s)
    return s


@router.delete("/students/{student_id}")
def delete_student(student_id: int, db: Session = Depends(get_db), _=admin_only):
    s = db.query(models.Student).get(student_id)
    if not s:
        raise HTTPException(status_code=404, detail="Student not found")
    uid = s.user_id
    db.delete(s); db.commit()
    u = db.query(models.User).get(uid)
    if u:
        db.delete(u); db.commit()
    return {"message": "Student deleted"}


@router.post("/students/{student_id}/photo")
def upload_student_photo(student_id: int, file: UploadFile = File(...), db: Session = Depends(get_db), _=admin_only):
    s = db.query(models.Student).get(student_id)
    if not s:
        raise HTTPException(status_code=404, detail="Student not found")
    ext = os.path.splitext(file.filename or "")[-1] or ".jpg"
    path = settings.UPLOAD_DIR / f"student_{student_id}{ext}"
    with open(path, "wb") as f:
        f.write(file.file.read())
    s.profile_photo = str(path)
    db.commit()
    return {"path": str(path)}


# ---------- Teachers ----------
@router.post("/teachers", response_model=schemas.TeacherOut)
def create_teacher(req: schemas.TeacherCreate, db: Session = Depends(get_db), _=admin_only):
    if db.query(models.Teacher).filter(models.Teacher.teacher_id == req.teacher_id).first():
        raise HTTPException(status_code=400, detail="Teacher ID already exists")
    user = models.User(
        username=req.teacher_id, email=str(req.email), full_name=req.full_name,
        hashed_password=security.hash_password(req.password), role="teacher",
        must_change_password=False,
    )
    db.add(user); db.flush()
    t = models.Teacher(user_id=user.id, teacher_id=req.teacher_id, full_name=req.full_name,
                       email=str(req.email), phone=req.phone, department_id=req.department_id)
    db.add(t); db.commit(); db.refresh(t)
    return t


@router.get("/teachers", response_model=list[schemas.TeacherOut])
def list_teachers(db: Session = Depends(get_db), _=admin_only):
    return db.query(models.Teacher).all()


@router.delete("/teachers/{teacher_id}")
def delete_teacher(teacher_id: int, db: Session = Depends(get_db), _=admin_only):
    t = db.query(models.Teacher).get(teacher_id)
    if not t:
        raise HTTPException(status_code=404, detail="Teacher not found")
    uid = t.user_id
    db.delete(t); db.commit()
    u = db.query(models.User).get(uid)
    if u:
        db.delete(u); db.commit()
    return {"message": "Teacher deleted"}


# ---------- Analytics ----------
@router.get("/analytics")
def analytics(db: Session = Depends(get_db), _=admin_only):
    students = db.query(models.Student).all()
    total_present = db.query(models.AttendanceRecord).filter(models.AttendanceRecord.status == "present").count()
    total_absent = db.query(models.AttendanceRecord).filter(models.AttendanceRecord.status == "absent").count()
    total_records = total_present + total_absent
    overall = round(total_present / total_records * 100, 2) if total_records else 0
    dept_data = []
    for dept in db.query(models.Department).all():
        dept_students = db.query(models.Student).filter(models.Student.department_id == dept.id).count()
        dept_data.append({"name": dept.name, "students": dept_students})
    # attendance trend (last 7 days)
    trend = []
    from datetime import timedelta
    for i in range(6, -1, -1):
        d = date.today() - timedelta(days=i)
        records = db.query(models.AttendanceRecord).filter(models.AttendanceRecord.date == d).all()
        present = len([r for r in records if r.status == "present"])
        absent = len([r for r in records if r.status == "absent"])
        trend.append({"date": str(d), "present": present, "absent": absent})
    return {
        "total_students": len(students),
        "total_present": total_present,
        "total_absent": total_absent,
        "overall_percentage": overall,
        "department_distribution": dept_data,
        "trend": trend,
    }


# ---------- Unknown logs ----------
@router.get("/unknowns")
def list_unknowns(db: Session = Depends(get_db), _=admin_only):
    logs = db.query(models.UnknownFaceLog).order_by(models.UnknownFaceLog.detected_at.desc()).limit(50).all()
    return [{"id": l.id, "snapshot": l.snapshot_path, "confidence": l.confidence,
             "camera_id": l.camera_id, "detected_at": str(l.detected_at), "notified": l.notified} for l in logs]


# ---------- Audit logs ----------
@router.get("/audit-logs")
def list_audit(db: Session = Depends(get_db), _=admin_only):
    logs = db.query(models.AuditLog).order_by(models.AuditLog.created_at.desc()).limit(100).all()
    return [{"id": l.id, "user_id": l.user_id, "action": l.action, "detail": l.detail,
             "ip": l.ip, "created_at": str(l.created_at)} for l in logs]


# ---------- Notifications ----------
@router.get("/notifications", response_model=list[schemas.NotificationOut])
def list_notifications(db: Session = Depends(get_db), _=admin_only):
    return db.query(models.Notification).order_by(models.Notification.created_at.desc()).limit(50).all()


@router.post("/notifications/{nid}/read")
def mark_notification_read(nid: int, db: Session = Depends(get_db), _=admin_only):
    n = db.query(models.Notification).get(nid)
    if n:
        n.is_read = True
        db.commit()
    return {"message": "marked"}


# ---------- Email Test ----------
@router.post("/email/test")
def test_email(req: schemas.TestEmailRequest,
               db: Session = Depends(get_db), _=admin_only):
    """Admin-only: test SMTP connection and optionally send a test email."""
    # 1. Test SMTP connection
    ok, msg = email_service.test_smtp_connection()
    if not ok:
        return {"success": False, "connection": False, "message": msg}

    # 2. Send test email if recipient provided
    if req.to_email:
        subject = "LifeOS Smart Campus - Test Email"
        html = """
        <div style="font-family:Segoe UI,Arial,sans-serif;max-width:600px;margin:auto;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden">
          <div style="background:linear-gradient(135deg,#10b981,#059669);padding:20px;color:#fff;text-align:center">
            <h2 style="margin:0">✅ Test Email Successful</h2>
            <p style="margin:6px 0 0;opacity:0.9;font-size:13px">LifeOS Smart Campus</p>
          </div>
          <div style="padding:24px">
            <p>Hello,</p>
            <p>This is a test email from <b>LifeOS Smart Campus</b>. If you received this, your SMTP configuration is working correctly.</p>
            <p style="color:#6b7280;font-size:13px">Sent at: <b>{time}</b></p>
          </div>
        </div>
        """.replace("{time}", str(datetime.now().strftime("%Y-%m-%d %H:%M:%S")))
        send_ok, send_err = email_service._send(str(req.to_email), subject, html)
        email_service.log_email(db, str(req.to_email), subject, "test_email",
                                "sent" if send_ok else "failed", send_err)
        if not send_ok:
            return {"success": False, "connection": True, "message": f"SMTP connected but test email failed: {send_err}"}
        return {"success": True, "connection": True, "message": "SMTP connection successful and test email sent"}

    return {"success": True, "connection": True, "message": "SMTP connection successful"}


# ---------- Email Failure Logs ----------
@router.get("/email/failures")
def list_email_failures(db: Session = Depends(get_db), _=admin_only):
    logs = db.query(models.EmailDeliveryFailureLog).order_by(
        models.EmailDeliveryFailureLog.created_at.desc()).limit(50).all()
    return [{"id": l.id, "to_email": l.to_email, "subject": l.subject,
             "body_type": l.body_type, "error": l.error,
             "attendance_record_id": l.attendance_record_id,
             "retried": l.retried, "created_at": str(l.created_at)} for l in logs]


@router.post("/email/failures/{log_id}/retry")
def retry_email(log_id: int, db: Session = Depends(get_db), _=admin_only):
    """Retry a failed email delivery."""
    log = db.query(models.EmailDeliveryFailureLog).get(log_id)
    if not log:
        raise HTTPException(status_code=404, detail="Email failure log not found")
    ok, err = email_service._send(log.to_email, log.subject, f"<p>Retry of: {log.subject}</p><p>Original error: {log.error}</p>")
    if ok:
        log.retried = True
        db.commit()
        return {"success": True, "message": "Email retry successful"}
    return {"success": False, "message": f"Email retry failed: {err}"}
