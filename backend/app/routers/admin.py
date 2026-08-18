import json
import os
import secrets
import string
from datetime import date, datetime
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from ..database import get_db
from .. import models, schemas, security, email_service, notification_service
from ..runtime_config import SMTP_KEYS, encrypt
from ..config import settings
from ..attendance_service import get_attendance_overview, compute_student_percentage

router = APIRouter(prefix="/api/admin", tags=["admin"])
admin_only = Depends(security.require_roles("admin"))


def _commit_or_400(db: Session, message: str = "Database operation failed"):
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        detail = str(getattr(exc, "orig", exc))
        raise HTTPException(status_code=409, detail=f"{message}: {detail}")


def _update_fields(obj, data: dict):
    for field, value in data.items():
        if value == "":
            value = None if field.endswith("_email") else value
        setattr(obj, field, value)


def _temporary_password(length: int = 14) -> str:
    alphabet = string.ascii_letters + string.digits + "!@#$%?"
    required = [
        secrets.choice(string.ascii_lowercase),
        secrets.choice(string.ascii_uppercase),
        secrets.choice(string.digits),
        secrets.choice("!@#$%?"),
    ]
    required.extend(secrets.choice(alphabet) for _ in range(max(0, length - len(required))))
    secrets.SystemRandom().shuffle(required)
    return "".join(required)


def _safe_email_status(ok: bool, error: str = "") -> dict:
    return {"success": ok, "status": "sent" if ok else "failed", "error": error or ""}


def _name(db: Session, model, row_id):
    if not row_id:
        return "-"
    row = db.get(model, row_id)
    if row and getattr(row, "name", None):
        return row.name
    if model.__name__ == "Semester":
        return f"Semester {row_id}"
    return "-"


def _optional_int(value):
    if value in (None, ""):
        return None
    return int(value)


def _student_payload(s: models.Student) -> dict:
    return {
        "id": s.id,
        "user_id": s.user_id,
        "student_id": s.student_id,
        "full_name": s.full_name,
        "roll_number": s.roll_number,
        "section": s.section or "",
        "department_id": s.department_id,
        "course_id": s.course_id,
        "semester_id": s.semester_id,
        "class_id": s.class_id,
        "email": s.email,
        "phone": s.phone or "",
        "parent_email": s.parent_email,
        "profile_photo": s.profile_photo or "",
        "face_status": s.face_status,
        "created_at": s.created_at,
    }


def _teacher_payload(t: models.Teacher) -> dict:
    return {
        "id": t.id,
        "user_id": t.user_id,
        "teacher_id": t.teacher_id,
        "full_name": t.full_name,
        "email": t.email,
        "phone": t.phone or "",
        "department_id": t.department_id,
        "subject_id": t.subject_id,
        "class_id": t.class_id,
        "section": t.section or "",
        "created_at": t.created_at,
    }


def _audit(db: Session, actor_id: int, action: str, **metadata):
    db.add(models.AuditLog(user_id=actor_id, action=action, detail=json.dumps(metadata, default=str, separators=(",", ":"))))


def _send_student_welcome(db: Session, student: models.Student, temp_password: str, admin: models.User) -> dict:
    rows = {
        "Name": student.full_name,
        "Student ID": student.student_id,
        "Roll Number": student.roll_number,
        "Department": _name(db, models.Department, student.department_id),
        "Class": _name(db, models.Class, student.class_id),
        "Semester": _name(db, models.Semester, student.semester_id),
        "Section": student.section or "-",
    }
    ok, error = email_service.send_welcome_student_email(db, student.email, student.full_name, temp_password, rows)
    status = _safe_email_status(ok, error)
    _audit(db, admin.id, "welcome_email_sent" if ok else "welcome_email_failed", target_id=student.user_id, role="student", email=student.email, error=error)
    db.commit()
    notification_service.notify_user(
        db,
        student.user_id,
        title="Student account created",
        message="Your LifeOS Smart Campus student account has been created. Please check your email for login details.",
        notification_type="success" if ok else "warning",
        priority="important",
        sender=admin,
        send_email=False,
        email_status_override=status["status"],
        email_error_override=status["error"],
        body_type="welcome_student",
    )
    return status


def _send_staff_welcome(db: Session, user: models.User, temp_password: str, admin: models.User, rows: dict) -> dict:
    ok, error = email_service.send_welcome_staff_email(db, user.email, user.full_name, temp_password, rows)
    status = _safe_email_status(ok, error)
    _audit(db, admin.id, "welcome_email_sent" if ok else "welcome_email_failed", target_id=user.id, role=user.role, email=user.email, error=error)
    db.commit()
    notification_service.notify_user(
        db,
        user.id,
        title="Staff account created" if user.role == "staff" else "Teacher account created",
        message="Your LifeOS Smart Campus account has been created. Please check your email for login details.",
        notification_type="success" if ok else "warning",
        priority="important",
        sender=admin,
        send_email=False,
        email_status_override=status["status"],
        email_error_override=status["error"],
        body_type="welcome_staff",
    )
    return status

@router.get("/leave-requests")
def admin_leave_requests(db: Session = Depends(get_db), _=admin_only):
    from .leave import _out
    return [_out(row, db) for row in db.query(models.LeaveRequest).order_by(models.LeaveRequest.created_at.desc()).all()]


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
    db.delete(d); _commit_or_400(db, "Cannot delete this department because related records exist")
    return {"message": "Department deleted"}


@router.put("/departments/{dept_id}", response_model=schemas.DepartmentOut)
def update_department(dept_id: int, req: schemas.DepartmentUpdate, db: Session = Depends(get_db), _=admin_only):
    d = db.query(models.Department).get(dept_id)
    if not d:
        raise HTTPException(status_code=404, detail="Department not found")
    _update_fields(d, req.dict(exclude_unset=True))
    _commit_or_400(db, "Department update failed")
    db.refresh(d)
    return d


import re

def _slug_code(name: str) -> str:
    cleaned = re.sub(r'[^A-Za-z0-9]+', '-', name or "").strip('-').upper()
    return cleaned or f"ITEM-{int(datetime.utcnow().timestamp()) % 10000}"


# ---------- Courses ----------
@router.post("/courses", response_model=schemas.CourseOut)
def create_course(req: schemas.CourseCreate, db: Session = Depends(get_db), _=admin_only):
    code = req.code.strip() if req.code and req.code.strip() else _slug_code(req.name)
    if db.query(models.Course).filter(models.Course.code == code).first():
        code = f"{code}-{int(datetime.utcnow().timestamp()) % 10000}"
    c = models.Course(name=req.name, code=code, duration=req.duration, department_id=req.department_id)
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
    db.delete(c); _commit_or_400(db, "Cannot delete this course because related records exist")
    return {"message": "Course deleted"}


@router.put("/courses/{course_id}", response_model=schemas.CourseOut)
def update_course(course_id: int, req: schemas.CourseUpdate, db: Session = Depends(get_db), _=admin_only):
    c = db.query(models.Course).get(course_id)
    if not c:
        raise HTTPException(status_code=404, detail="Course not found")
    _update_fields(c, req.dict(exclude_unset=True))
    _commit_or_400(db, "Course update failed")
    db.refresh(c)
    return c


# ---------- Semesters ----------
@router.post("/semesters", response_model=schemas.SemesterOut)
def create_semester(req: schemas.SemesterCreate, db: Session = Depends(get_db), _=admin_only):
    code = req.code.strip() if req.code and req.code.strip() else _slug_code(req.name)
    s = models.Semester(name=req.name, code=code, order=req.order)
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
    db.delete(s); _commit_or_400(db, "Cannot delete this semester because related records exist")
    return {"message": "Semester deleted"}


@router.put("/semesters/{sem_id}", response_model=schemas.SemesterOut)
def update_semester(sem_id: int, req: schemas.SemesterUpdate, db: Session = Depends(get_db), _=admin_only):
    s = db.query(models.Semester).get(sem_id)
    if not s:
        raise HTTPException(status_code=404, detail="Semester not found")
    _update_fields(s, req.dict(exclude_unset=True))
    _commit_or_400(db, "Semester update failed")
    db.refresh(s)
    return s


# ---------- Classes ----------
@router.post("/classes", response_model=schemas.ClassOut)
def create_class(req: schemas.ClassCreate, db: Session = Depends(get_db), _=admin_only):
    code = req.code.strip() if req.code and req.code.strip() else _slug_code(req.name)
    if db.query(models.Class).filter(models.Class.code == code).first():
        code = f"{code}-{int(datetime.utcnow().timestamp()) % 10000}"
    c = models.Class(name=req.name, code=code, course_id=req.course_id, semester_id=req.semester_id, section=req.section or "")
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
    db.delete(c); _commit_or_400(db, "Cannot delete this class because related records exist")
    return {"message": "Class deleted"}


@router.put("/classes/{class_id}", response_model=schemas.ClassOut)
def update_class(class_id: int, req: schemas.ClassUpdate, db: Session = Depends(get_db), _=admin_only):
    c = db.query(models.Class).get(class_id)
    if not c:
        raise HTTPException(status_code=404, detail="Class not found")
    _update_fields(c, req.dict(exclude_unset=True))
    _commit_or_400(db, "Class update failed")
    db.refresh(c)
    return c


# ---------- Subjects ----------
@router.post("/subjects", response_model=schemas.SubjectOut)
def create_subject(req: schemas.SubjectCreate, db: Session = Depends(get_db), _=admin_only):
    code = req.code.strip() if req.code and req.code.strip() else _slug_code(req.name)
    if db.query(models.Subject).filter(models.Subject.code == code).first():
        code = f"{code}-{int(datetime.utcnow().timestamp()) % 10000}"
    s = models.Subject(name=req.name, code=code, department_id=req.department_id)
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
    db.delete(s); _commit_or_400(db, "Cannot delete this subject because related records exist")
    return {"message": "Subject deleted"}


@router.put("/subjects/{subject_id}", response_model=schemas.SubjectOut)
def update_subject(subject_id: int, req: schemas.SubjectUpdate, db: Session = Depends(get_db), _=admin_only):
    s = db.query(models.Subject).get(subject_id)
    if not s:
        raise HTTPException(status_code=404, detail="Subject not found")
    _update_fields(s, req.dict(exclude_unset=True))
    _commit_or_400(db, "Subject update failed")
    db.refresh(s)
    return s


# ---------- Students ----------
@router.post("/students")
def create_student(req: schemas.StudentCreate, db: Session = Depends(get_db), admin: models.User = Depends(security.require_roles("admin"))):
    if db.query(models.Student).filter(models.Student.student_id == req.student_id).first():
        raise HTTPException(status_code=400, detail="Student ID already exists")
    email = str(req.email).strip().lower()
    if db.query(models.Student).filter(models.Student.email == email).first() or db.query(models.User).filter((models.User.email == email) | (models.User.username == req.student_id)).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    temp_password = _temporary_password()
    user = models.User(
        username=req.student_id, email=email, full_name=req.full_name,
        phone=req.phone, hashed_password=security.hash_password(temp_password), role="student",
        must_change_password=True,
    )
    db.add(user); db.flush()
    student = models.Student(
        user_id=user.id, student_id=req.student_id, full_name=req.full_name,
        roll_number=req.roll_number, section=req.section, department_id=req.department_id,
        course_id=req.course_id,
        semester_id=req.semester_id, class_id=req.class_id, email=email,
        phone=req.phone, parent_email=str(req.parent_email) if req.parent_email else None,
    )
    db.add(student)
    _audit(db, admin.id, "student_created", target_id=user.id, student_id=req.student_id, email=email)
    db.commit(); db.refresh(student)
    welcome = _send_student_welcome(db, student, temp_password, admin)
    notification_service.notify_admins(
        db,
        title="New student created",
        message=f"{student.full_name} ({student.student_id}) was created by {admin.full_name}. Welcome email: {welcome['status']}.",
        notification_type="success" if welcome["success"] else "warning",
        priority="normal",
        sender=admin,
        send_email=False,
    )
    return {**_student_payload(student), "welcome_email": welcome}


@router.get("/students", response_model=list[schemas.StudentOut])
def list_students(db: Session = Depends(get_db), _=admin_only):
    return db.query(models.Student).all()


@router.put("/students/{student_id}", response_model=schemas.StudentOut)
def update_student(student_id: int, req: schemas.StudentUpdate, db: Session = Depends(get_db), _=admin_only):
    s = db.query(models.Student).get(student_id)
    if not s:
        raise HTTPException(status_code=404, detail="Student not found")
    data = req.dict(exclude_unset=True)
    password = data.pop("password", None)
    if "student_id" in data:
        existing = db.query(models.Student).filter(models.Student.student_id == data["student_id"], models.Student.id != s.id).first()
        if existing:
            raise HTTPException(status_code=409, detail="Student ID already exists")
    if "email" in data:
        existing = db.query(models.Student).filter(models.Student.email == str(data["email"]), models.Student.id != s.id).first()
        if existing:
            raise HTTPException(status_code=409, detail="Email already registered")
        data["email"] = str(data["email"])
    _update_fields(s, data)
    if s.user:
        if "full_name" in data:
            s.user.full_name = s.full_name
        if "email" in data:
            s.user.email = s.email
        if "student_id" in data:
            s.user.username = s.student_id
        if password:
            if len(password) < 4:
                raise HTTPException(status_code=400, detail="Password must be at least 4 characters")
            s.user.hashed_password = security.hash_password(password)
            s.user.must_change_password = True
    _commit_or_400(db, "Student update failed")
    db.refresh(s)
    if s.email:
        email_service.send_profile_updated(db, s.email, s.full_name, "student", list(data.keys()))
    return s


@router.delete("/students/{student_id}")
def delete_student(student_id: int, db: Session = Depends(get_db), _=admin_only):
    s = db.query(models.Student).get(student_id)
    if not s:
        raise HTTPException(status_code=404, detail="Student not found")
    uid = s.user_id
    attendance_count = db.query(models.AttendanceRecord).filter(models.AttendanceRecord.student_id == s.id).count()
    if attendance_count:
        raise HTTPException(status_code=409, detail="Cannot delete this student because attendance records exist.")
    db.delete(s); _commit_or_400(db, "Student delete failed")
    u = db.query(models.User).get(uid)
    if u:
        db.delete(u); _commit_or_400(db, "Student user delete failed")
    return {"message": "Student deleted"}


@router.post("/students/{student_id}/welcome-email/retry")
def retry_student_welcome(student_id: int, admin: models.User = Depends(security.require_roles("admin")), db: Session = Depends(get_db)):
    student = db.query(models.Student).get(student_id)
    if not student or not student.user:
        raise HTTPException(status_code=404, detail="Student not found")
    temp_password = _temporary_password()
    student.user.hashed_password = security.hash_password(temp_password)
    student.user.must_change_password = True
    db.commit()
    welcome = _send_student_welcome(db, student, temp_password, admin)
    return {"message": "Welcome email retry completed.", "welcome_email": welcome}


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
@router.post("/teachers")
def create_teacher(req: schemas.TeacherCreate, db: Session = Depends(get_db), admin: models.User = Depends(security.require_roles("admin"))):
    if db.query(models.Teacher).filter(models.Teacher.teacher_id == req.teacher_id).first():
        raise HTTPException(status_code=400, detail="Teacher ID already exists")
    email = str(req.email).strip().lower()
    if db.query(models.User).filter((models.User.email == email) | (models.User.username == req.teacher_id)).first() or db.query(models.Teacher).filter(models.Teacher.email == email).first():
        raise HTTPException(status_code=409, detail="Email already registered")
    temp_password = _temporary_password()
    user = models.User(
        username=req.teacher_id, email=email, full_name=req.full_name, phone=req.phone,
        hashed_password=security.hash_password(temp_password), role="teacher",
        must_change_password=True,
    )
    db.add(user); db.flush()
    t = models.Teacher(user_id=user.id, teacher_id=req.teacher_id, full_name=req.full_name,
                       email=email, phone=req.phone, department_id=req.department_id, subject_id=req.subject_id, class_id=req.class_id, section=req.section)
    db.add(t)
    _audit(db, admin.id, "teacher_created", target_id=user.id, teacher_id=req.teacher_id, email=email)
    db.commit(); db.refresh(t)
    rows = {
        "Name": t.full_name,
        "Role": "Teacher",
        "Teacher ID": t.teacher_id,
        "Department": _name(db, models.Department, t.department_id),
        "Subject": _name(db, models.Subject, t.subject_id),
        "Class": _name(db, models.Class, t.class_id),
        "Section": t.section or "-",
    }
    welcome = _send_staff_welcome(db, user, temp_password, admin, rows)
    notification_service.notify_admins(
        db,
        title="New teacher created",
        message=f"{t.full_name} ({t.teacher_id}) was created by {admin.full_name}. Welcome email: {welcome['status']}.",
        notification_type="success" if welcome["success"] else "warning",
        priority="normal",
        sender=admin,
        send_email=False,
    )
    return {**_teacher_payload(t), "welcome_email": welcome}


@router.get("/teachers", response_model=list[schemas.TeacherOut])
def list_teachers(db: Session = Depends(get_db), _=admin_only):
    return db.query(models.Teacher).all()


@router.put("/teachers/{teacher_id}", response_model=schemas.TeacherOut)
def update_teacher(teacher_id: int, req: schemas.TeacherUpdate, db: Session = Depends(get_db), _=admin_only):
    t = db.query(models.Teacher).get(teacher_id)
    if not t:
        raise HTTPException(status_code=404, detail="Teacher not found")
    data = req.dict(exclude_unset=True)
    password = data.pop("password", None)
    if "teacher_id" in data:
        existing = db.query(models.Teacher).filter(models.Teacher.teacher_id == data["teacher_id"], models.Teacher.id != t.id).first()
        if existing:
            raise HTTPException(status_code=409, detail="Teacher ID already exists")
    if "email" in data:
        existing = db.query(models.Teacher).filter(models.Teacher.email == str(data["email"]), models.Teacher.id != t.id).first()
        if existing:
            raise HTTPException(status_code=409, detail="Email already registered")
        data["email"] = str(data["email"])
    _update_fields(t, data)
    if t.user:
        if "full_name" in data:
            t.user.full_name = t.full_name
        if "email" in data:
            t.user.email = t.email
        if "teacher_id" in data:
            t.user.username = t.teacher_id
        if password:
            if len(password) < 4:
                raise HTTPException(status_code=400, detail="Password must be at least 4 characters")
            t.user.hashed_password = security.hash_password(password)
    _commit_or_400(db, "Teacher update failed")
    db.refresh(t)
    if t.email:
        email_service.send_profile_updated(db, t.email, t.full_name, "teacher", list(data.keys()))
    return t


@router.delete("/teachers/{teacher_id}")
def delete_teacher(teacher_id: int, db: Session = Depends(get_db), _=admin_only):
    t = db.query(models.Teacher).get(teacher_id)
    if not t:
        raise HTTPException(status_code=404, detail="Teacher not found")
    uid = t.user_id
    session_count = db.query(models.AttendanceSession).filter(models.AttendanceSession.teacher_id == t.id).count()
    if session_count:
        raise HTTPException(status_code=409, detail="Cannot delete this teacher because attendance sessions exist.")
    db.delete(t); _commit_or_400(db, "Teacher delete failed")
    u = db.query(models.User).get(uid)
    if u:
        db.delete(u); _commit_or_400(db, "Teacher user delete failed")
    return {"message": "Teacher deleted"}


@router.post("/teachers/{teacher_id}/welcome-email/retry")
def retry_teacher_welcome(teacher_id: int, admin: models.User = Depends(security.require_roles("admin")), db: Session = Depends(get_db)):
    teacher = db.query(models.Teacher).get(teacher_id)
    if not teacher or not teacher.user:
        raise HTTPException(status_code=404, detail="Teacher not found")
    temp_password = _temporary_password()
    teacher.user.hashed_password = security.hash_password(temp_password)
    teacher.user.must_change_password = True
    db.commit()
    rows = {
        "Name": teacher.full_name,
        "Role": "Teacher",
        "Teacher ID": teacher.teacher_id,
        "Department": _name(db, models.Department, teacher.department_id),
        "Subject": _name(db, models.Subject, teacher.subject_id),
        "Class": _name(db, models.Class, teacher.class_id),
        "Section": teacher.section or "-",
    }
    welcome = _send_staff_welcome(db, teacher.user, temp_password, admin, rows)
    return {"message": "Welcome email retry completed.", "welcome_email": welcome}


# ---------- Staff ----------
@router.get("/staff")
def list_staff(db: Session = Depends(get_db), _=admin_only):
    rows = db.query(models.StaffProfile).all()
    result = []
    for s in rows:
        user = db.get(models.User, s.user_id)
        result.append({"id": s.id, "user_id": s.user_id, "full_name": user.full_name, "email": user.email, "phone": user.phone, "department_id": s.department_id, "subject_id": s.subject_id, "class_id": s.class_id, "section": s.section, "status": s.status, "role_ids": [x.role_id for x in db.query(models.UserRole).filter_by(user_id=s.user_id)]})
    return result

@router.post("/staff")
def create_staff(payload: dict, admin: models.User = Depends(security.require_roles("admin")), db: Session = Depends(get_db)):
    name, email = str(payload.get("full_name", "")).strip(), str(payload.get("email", "")).strip().lower()
    role_ids = list(set(payload.get("role_ids", [])))
    if not name or not email: raise HTTPException(422, "Full name and email are required")
    if db.query(models.User).filter((models.User.email == email) | (models.User.username == email)).first(): raise HTTPException(409, "Email already registered")
    valid = {r.id for r in db.query(models.Role).filter(models.Role.id.in_(role_ids)).all()}
    if len(valid) != len(role_ids): raise HTTPException(422, "Invalid role selection")
    temp_password = _temporary_password()
    user = models.User(username=email, email=email, full_name=name, phone=str(payload.get("phone", "")), hashed_password=security.hash_password(temp_password), role="staff", is_active=payload.get("status", "active") == "active", must_change_password=True)
    db.add(user); db.flush(); profile = models.StaffProfile(user_id=user.id, department_id=_optional_int(payload.get("department_id")), subject_id=_optional_int(payload.get("subject_id")), class_id=_optional_int(payload.get("class_id")), section=str(payload.get("section", "")).strip(), status=payload.get("status", "active")); db.add(profile); db.add_all([models.UserRole(user_id=user.id, role_id=i) for i in valid]); _audit(db, admin.id, "staff_created", target_id=user.id, email=email, role_ids=list(valid)); db.commit(); db.refresh(profile)
    role_names = [r.name for r in db.query(models.Role).filter(models.Role.id.in_(valid)).all()]
    rows = {
        "Name": user.full_name,
        "Role": ", ".join(role_names) if role_names else "Staff",
        "Department": _name(db, models.Department, profile.department_id),
        "Subject": _name(db, models.Subject, profile.subject_id),
        "Class": _name(db, models.Class, profile.class_id),
        "Section": profile.section or "-",
    }
    welcome = _send_staff_welcome(db, user, temp_password, admin, rows)
    notification_service.notify_admins(
        db,
        title="New staff member created",
        message=f"{user.full_name} was created by {admin.full_name}. Welcome email: {welcome['status']}.",
        notification_type="success" if welcome["success"] else "warning",
        priority="normal",
        sender=admin,
        send_email=False,
    )
    return {"id": profile.id, "user_id": user.id, "full_name": user.full_name, "email": user.email, "welcome_email": welcome}


@router.post("/staff/{staff_id}/welcome-email/retry")
def retry_staff_welcome(staff_id: int, admin: models.User = Depends(security.require_roles("admin")), db: Session = Depends(get_db)):
    profile = db.query(models.StaffProfile).get(staff_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Staff profile not found")
    user = db.get(models.User, profile.user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Staff account not found")
    temp_password = _temporary_password()
    user.hashed_password = security.hash_password(temp_password)
    user.must_change_password = True
    db.commit()
    role_ids = [row.role_id for row in db.query(models.UserRole).filter_by(user_id=user.id).all()]
    role_names = [r.name for r in db.query(models.Role).filter(models.Role.id.in_(role_ids)).all()]
    rows = {
        "Name": user.full_name,
        "Role": ", ".join(role_names) if role_names else "Staff",
        "Department": _name(db, models.Department, profile.department_id),
        "Subject": _name(db, models.Subject, profile.subject_id),
        "Class": _name(db, models.Class, profile.class_id),
        "Section": profile.section or "-",
    }
    welcome = _send_staff_welcome(db, user, temp_password, admin, rows)
    return {"message": "Welcome email retry completed.", "welcome_email": welcome}

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
    logs = db.query(models.UnknownFaceLog).order_by(models.UnknownFaceLog.detected_at.desc()).limit(100).all()
    return [{
        "id": l.id,
        "snapshot": l.snapshot_path,
        "confidence": l.confidence,
        "camera_id": l.camera_id,
        "session_id": l.session_id,
        "department": getattr(l, "department_name", "") or "",
        "course": getattr(l, "course_name", "") or "",
        "semester": getattr(l, "semester_name", "") or "",
        "class_name": getattr(l, "class_name", "") or "",
        "subject": getattr(l, "subject_name", "") or "",
        "teacher": getattr(l, "teacher_name", "") or "",
        "reason": getattr(l, "reason", "Unrecognized face") or "Unrecognized face",
        "status": getattr(l, "status", "Unrecognized") or "Unrecognized",
        "detected_at": str(l.detected_at),
        "notified": l.notified
    } for l in logs]


@router.delete("/unknowns")
def clear_all_unknowns(db: Session = Depends(get_db), _=admin_only):
    db.query(models.UnknownFaceLog).delete()
    db.commit()
    return {"message": "All unknown face logs cleared"}


@router.delete("/unknowns/{log_id}")
def delete_unknown(log_id: int, db: Session = Depends(get_db), _=admin_only):
    log = db.query(models.UnknownFaceLog).get(log_id)
    if not log:
        raise HTTPException(status_code=404, detail="Unknown face log not found")
    db.delete(log)
    db.commit()
    return {"message": "Unknown face log deleted"}


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


# ---------- System Settings & Branding ----------
@router.get("/settings")
def get_system_settings(db: Session = Depends(get_db), _=admin_only):
    configs = db.query(models.SystemConfig).all()
    res = {
        "system_name": settings.APP_NAME,
        "system_logo": "",
        "maintenance_mode": "false",
        "face_match_threshold": str(settings.FACE_MATCH_THRESHOLD),
    }
    for c in configs:
        res[c.key] = c.value
    return res


@router.post("/settings")
def save_system_settings(payload: dict, db: Session = Depends(get_db), _=admin_only):
    for key, value in payload.items():
        if value is None:
            continue
        val_str = str(value)
        row = db.query(models.SystemConfig).filter(models.SystemConfig.key == key).first()
        if row:
            row.value = val_str
        else:
            db.add(models.SystemConfig(key=key, value=val_str))
    db.commit()
    return {"message": "Settings updated successfully"}


@router.post("/settings/logo")
def upload_system_logo(file: UploadFile = File(...), db: Session = Depends(get_db), _=admin_only):
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")
    ext = os.path.splitext(file.filename)[-1].lower()
    if ext not in [".png", ".jpg", ".jpeg", ".svg", ".webp"]:
        raise HTTPException(status_code=400, detail="Invalid file type. Allowed: PNG, JPG, JPEG, SVG, WEBP")
    
    branding_dir = settings.UPLOAD_DIR / "branding"
    branding_dir.mkdir(parents=True, exist_ok=True)
    filename = f"logo_{int(datetime.utcnow().timestamp())}{ext}"
    target_path = branding_dir / filename
    
    content = file.file.read()
    if len(content) > 2 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File size exceeds 2MB limit")
        
    with open(target_path, "wb") as f:
        f.write(content)
        
    import base64
    mime_map = {".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".svg": "image/svg+xml", ".webp": "image/webp"}
    mime = mime_map.get(ext, "image/png")
    b64_str = base64.b64encode(content).decode("utf-8")
    logo_url = f"data:{mime};base64,{b64_str}"

    row = db.query(models.SystemConfig).filter(models.SystemConfig.key == "system_logo").first()
    if row:
        row.value = logo_url
    else:
        db.add(models.SystemConfig(key="system_logo", value=logo_url, description="System Logo Base64 Image"))
    db.commit()
    return {"message": "Logo uploaded successfully", "logo_url": logo_url}


# ---------- Email Test ----------
@router.get("/settings/email")
@router.get("/email/settings")
def get_email_settings(db: Session = Depends(get_db), _=admin_only):
    """Return only non-sensitive SMTP configuration to an authenticated admin."""
    return {
        "smtp_host": settings.SMTP_HOST,
        "smtp_port": settings.SMTP_PORT,
        "smtp_username": settings.SMTP_USERNAME,
        "smtp_from_email": settings.SMTP_FROM_EMAIL,
        "smtp_from_name": settings.SMTP_FROM_NAME,
        "smtp_use_tls": settings.SMTP_USE_TLS,
        "email_enabled": settings.EMAIL_ENABLED,
        "smtp_password_configured": bool(settings.SMTP_PASSWORD),
    }


@router.put("/settings/email")
@router.put("/email/settings")
def update_email_settings(payload: dict, db: Session = Depends(get_db), admin: models.User = Depends(security.require_roles("admin"))):
    """Apply SMTP settings in the backend process without ever returning a password."""
    for key, attr in SMTP_KEYS.items():
        if key not in payload or payload[key] is None:
            continue
        if key == "smtp_password" and not str(payload[key]).strip():
            continue
        if key == "smtp_port":
            try:
                value = int(payload[key])
            except (TypeError, ValueError):
                raise HTTPException(status_code=422, detail="SMTP port must be a number")
            if not 1 <= value <= 65535:
                raise HTTPException(status_code=422, detail="SMTP port is out of range")
        elif key in {"smtp_use_tls", "email_enabled"}:
            value = bool(payload[key])
        else:
            value = str(payload[key]).strip()
        setattr(settings, attr, value)
        row = db.query(models.SystemConfig).filter(models.SystemConfig.key == key).first()
        stored_value = encrypt(value) if key == "smtp_password" else str(value).lower() if isinstance(value, bool) else str(value)
        if row:
            row.value, row.is_secret, row.updated_by = stored_value, key == "smtp_password", admin.id
        else:
            db.add(models.SystemConfig(key=key, value=stored_value, description="Runtime SMTP setting", is_secret=key == "smtp_password", updated_by=admin.id))
    db.commit()
    return get_email_settings(db, admin)


@router.post("/settings/email/test")
@router.post("/email/test")
def test_email(req: schemas.TestEmailRequest,
               db: Session = Depends(get_db), _=admin_only):
    """Admin-only: test SMTP connection and optionally send a test email."""

    # 1. Test SMTP connection
    ok, msg = email_service.test_smtp_connection()
    if not ok:
        from ..system_alerts import record_system_alert
        record_system_alert("Email service unavailable", "Email service is currently unavailable. Please verify SMTP settings.")
        return {"success": False, "connection": False, "message": "Test email failed. Please verify SMTP settings."}

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
        send_ok, send_err = email_service.send_email(str(req.to_email), subject, html)
        email_service.log_email(db, str(req.to_email), subject, "test_email",
                                "sent" if send_ok else "failed", send_err)
        if not send_ok:
            return {"success": False, "connection": True, "message": "Test email failed. Please verify SMTP settings."}
        return {"success": True, "connection": True, "message": "Test email sent successfully."}

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


@router.get("/email/logs")
def list_email_logs(db: Session = Depends(get_db), _=admin_only):
    logs = db.query(models.EmailLog).order_by(models.EmailLog.created_at.desc()).limit(100).all()
    return [{
        "id": l.id,
        "student_id": getattr(l, "student_id", None),
        "attendance_id": getattr(l, "attendance_id", None),
        "recipient_email": getattr(l, "recipient_email", None) or l.to_email,
        "subject": l.subject,
        "status": l.status,
        "error_message": getattr(l, "error_message", None) or l.error,
        "sent_at": str(getattr(l, "sent_at", None) or l.created_at) if (getattr(l, "sent_at", None) or l.created_at) else None,
        "created_at": str(l.created_at),
    } for l in logs]


@router.post("/email/failures/{log_id}/retry")
def retry_email(log_id: int, db: Session = Depends(get_db), _=admin_only):
    """Retry a failed email delivery."""
    log = db.query(models.EmailDeliveryFailureLog).get(log_id)
    if not log:
        raise HTTPException(status_code=404, detail="Email failure log not found")
    ok, err = email_service.send_email(log.to_email, log.subject, f"<p>Retry of: {log.subject}</p><p>Original error: {log.error}</p>")
    if ok:
        log.retried = True
        db.commit()
        return {"success": True, "message": "Email retry successful"}
    return {"success": False, "message": f"Email retry failed: {err}"}
