from datetime import datetime, date
from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, Date, ForeignKey, Text, Table, JSON
from sqlalchemy.orm import relationship
from .database import Base


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    full_name = Column(String, nullable=False)
    phone = Column(String, default="")
    hashed_password = Column(String, nullable=False)
    role = Column(String, default="student")  # admin, teacher, student
    is_active = Column(Boolean, default=True)
    must_change_password = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    last_login = Column(DateTime, nullable=True)

    student = relationship("Student", back_populates="user", uselist=False, cascade="all,delete-orphan")
    teacher = relationship("Teacher", back_populates="user", uselist=False, cascade="all,delete-orphan")


class Department(Base):
    __tablename__ = "departments"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False)
    code = Column(String, unique=True, nullable=False)
    description = Column(Text, default="")
    created_at = Column(DateTime, default=datetime.utcnow)

    courses = relationship("Course", back_populates="department", cascade="all,delete-orphan")
    subjects = relationship("Subject", back_populates="department")


class Course(Base):
    __tablename__ = "courses"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    code = Column(String, unique=True, nullable=False)
    duration = Column(String, default="")
    department_id = Column(Integer, ForeignKey("departments.id"))
    created_at = Column(DateTime, default=datetime.utcnow)

    department = relationship("Department", back_populates="courses")
    classes = relationship("Class", back_populates="course", cascade="all,delete-orphan")


class Semester(Base):
    __tablename__ = "semesters"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)  # e.g. "Semester 1"
    code = Column(String, unique=True, nullable=False)
    order = Column(Integer, default=1)
    created_at = Column(DateTime, default=datetime.utcnow)


class Class(Base):
    __tablename__ = "classes"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    code = Column(String, unique=True, nullable=False)
    course_id = Column(Integer, ForeignKey("courses.id"))
    semester_id = Column(Integer, ForeignKey("semesters.id"))
    created_at = Column(DateTime, default=datetime.utcnow)

    course = relationship("Course", back_populates="classes")
    semester = relationship("Semester")


class Subject(Base):
    __tablename__ = "subjects"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    code = Column(String, unique=True, nullable=False)
    department_id = Column(Integer, ForeignKey("departments.id"))
    created_at = Column(DateTime, default=datetime.utcnow)

    department = relationship("Department", back_populates="subjects")


class Student(Base):
    __tablename__ = "students"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True)
    student_id = Column(String, unique=True, nullable=False, index=True)
    full_name = Column(String, nullable=False)
    roll_number = Column(String, nullable=False)
    section = Column(String, default="")
    department_id = Column(Integer, ForeignKey("departments.id"))
    course_id = Column(Integer, ForeignKey("courses.id"))
    semester_id = Column(Integer, ForeignKey("semesters.id"))
    class_id = Column(Integer, ForeignKey("classes.id"))
    email = Column(String, unique=True, index=True, nullable=False)
    phone = Column(String, default="")
    parent_email = Column(String, nullable=True)
    profile_photo = Column(String, default="")
    face_status = Column(String, default="pending")  # not_registered, pending, approved
    face_registered_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="student")
    department = relationship("Department")
    course = relationship("Course")
    semester = relationship("Semester")
    class_ = relationship("Class")
    face_embeddings = relationship("FaceEmbedding", back_populates="student", cascade="all,delete-orphan")
    attendance_records = relationship("AttendanceRecord", back_populates="student")


class Teacher(Base):
    __tablename__ = "teachers"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True)
    teacher_id = Column(String, unique=True, nullable=False, index=True)
    full_name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    phone = Column(String, default="")
    department_id = Column(Integer, ForeignKey("departments.id"))
    subject_id = Column(Integer, ForeignKey("subjects.id"), nullable=True)
    class_id = Column(Integer, ForeignKey("classes.id"), nullable=True)
    section = Column(String, default="")
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="teacher")
    department = relationship("Department")
    subject = relationship("Subject")
    class_ = relationship("Class")
    sessions = relationship("AttendanceSession", back_populates="teacher")


class FaceEmbedding(Base):
    __tablename__ = "face_embeddings"
    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id"), index=True)
    embedding = Column(Text, nullable=False)   # encrypted JSON list of 128-d vector
    angle = Column(String, default="front")    # front, left, right, up, down, smile, normal
    snapshot_path = Column(String, default="")
    created_at = Column(DateTime, default=datetime.utcnow)

    student = relationship("Student", back_populates="face_embeddings")


class AttendanceSession(Base):
    __tablename__ = "attendance_sessions"
    id = Column(Integer, primary_key=True, index=True)
    teacher_id = Column(Integer, ForeignKey("teachers.id"), index=True)
    department_id = Column(Integer, ForeignKey("departments.id"))
    subject_id = Column(Integer, ForeignKey("subjects.id"), nullable=True)
    class_id = Column(Integer, ForeignKey("classes.id"))
    section = Column(String, default="")
    camera_id = Column(String, default="default")
    status = Column(String, default="active")  # active, closed
    started_at = Column(DateTime, default=datetime.utcnow)
    ended_at = Column(DateTime, nullable=True)

    teacher = relationship("Teacher", back_populates="sessions")
    department = relationship("Department")
    subject = relationship("Subject")
    class_ = relationship("Class")
    records = relationship("AttendanceRecord", back_populates="session")


class AttendanceRecord(Base):
    __tablename__ = "attendance_records"
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("attendance_sessions.id"), index=True)
    student_id = Column(Integer, ForeignKey("students.id"), index=True)
    student_name = Column(String, default="")
    subject = Column(String, default="")
    class_name = Column(String, default="")
    teacher = Column(String, default="")
    status = Column(String, default="present")  # present, absent, late
    date = Column(Date, default=date.today, index=True)
    time = Column(String, default="")
    confidence = Column(Float, default=0.0)
    camera_id = Column(String, default="")
    method = Column(String, default="face")  # face, manual
    created_at = Column(DateTime, default=datetime.utcnow)

    session = relationship("AttendanceSession", back_populates="records")
    student = relationship("Student", back_populates="attendance_records")


class UnknownFaceLog(Base):
    __tablename__ = "unknown_face_logs"
    id = Column(Integer, primary_key=True, index=True)
    snapshot_path = Column(String, default="")
    confidence = Column(Float, default=0.0)
    camera_id = Column(String, default="")
    session_id = Column(Integer, nullable=True)
    department_name = Column(String, default="")
    course_name = Column(String, default="")
    semester_name = Column(String, default="")
    class_name = Column(String, default="")
    subject_name = Column(String, default="")
    teacher_name = Column(String, default="")
    reason = Column(String, default="Unrecognized face")
    status = Column(String, default="Unrecognized")
    detected_at = Column(DateTime, default=datetime.utcnow)
    notified = Column(Boolean, default=False)


class AuditLog(Base):
    __tablename__ = "audit_logs"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=True)
    action = Column(String, default="")
    detail = Column(Text, default="")
    ip = Column(String, default="")
    created_at = Column(DateTime, default=datetime.utcnow)


class Notification(Base):
    __tablename__ = "notifications"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    sender_user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    sender_name = Column(String, default="")
    sender_role = Column(String, default="system")
    title = Column(String, default="")
    message = Column(Text, default="")
    type = Column(String, default="info")  # info, success, warning, danger
    priority = Column(String, default="normal")
    is_read = Column(Boolean, default=False)
    read_at = Column(DateTime, nullable=True)
    email_requested = Column(Boolean, default=False)
    email_status = Column(String, default="not_requested")
    email_error = Column(Text, default="")
    related_request_id = Column(Integer, ForeignKey("approval_requests.id"), nullable=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class ApprovalRequest(Base):
    __tablename__ = "approval_requests"
    id = Column(Integer, primary_key=True, index=True)
    requester_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    requester_role = Column(String, nullable=False, index=True)
    target_user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    request_type = Column(String, nullable=False, default="profile_change", index=True)
    requested_changes = Column(JSON, nullable=False)
    old_values = Column(JSON, nullable=False, default=dict)
    changed_fields = Column(JSON, nullable=False, default=list)
    reason = Column(Text, default="")
    status = Column(String, nullable=False, default="pending", index=True)
    reviewed_by = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    reviewed_at = Column(DateTime, nullable=True)
    rejection_reason = Column(Text, default="")
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class EmailLog(Base):
    __tablename__ = "email_logs"
    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, nullable=True, index=True)
    attendance_id = Column(Integer, nullable=True, index=True)
    recipient_email = Column(String, default="")
    to_email = Column(String, default="")
    subject = Column(String, default="")
    body_type = Column(String, default="")
    status = Column(String, default="pending")  # pending, sent, failed
    error_message = Column(Text, default="")
    error = Column(Text, default="")
    sent_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class EmailDeliveryFailureLog(Base):
    __tablename__ = "email_delivery_failure_logs"
    id = Column(Integer, primary_key=True, index=True)
    to_email = Column(String, default="")
    subject = Column(String, default="")
    body_type = Column(String, default="")
    error = Column(Text, default="")
    attendance_record_id = Column(Integer, nullable=True)
    retried = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class SystemConfig(Base):
    __tablename__ = "system_config"
    id = Column(Integer, primary_key=True, index=True)
    key = Column(String, unique=True, index=True, nullable=False)
    value = Column(Text, default="")
    description = Column(Text, default="")
    is_secret = Column(Boolean, default=False)
    updated_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class LeaveRequest(Base):
    __tablename__ = "leave_requests"
    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id"))
    subject_id = Column(Integer, ForeignKey("subjects.id"))
    reason = Column(Text, default="")
    date = Column(Date, nullable=True)
    status = Column(String, default="pending")  # pending, approved, rejected
    applicant_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    applicant_role = Column(String, default="student", index=True)
    leave_type = Column(String, default="general")
    from_date = Column(Date, nullable=True)
    to_date = Column(Date, nullable=True)
    attachment_url = Column(String, default="")
    reviewed_by = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    reviewed_at = Column(DateTime, nullable=True)
    rejection_reason = Column(Text, default="")
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)


class PasswordResetToken(Base):
    __tablename__ = "password_reset_tokens"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    token = Column(String, unique=True, index=True, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    used = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    otp_hash = Column(String, default="")
    attempt_count = Column(Integer, default=0)
    verified_at = Column(DateTime, nullable=True)


class Role(Base):
    __tablename__ = "roles"
    id = Column(Integer, primary_key=True)
    name = Column(String, unique=True, nullable=False, index=True)
    description = Column(Text, default="")
    created_at = Column(DateTime, default=datetime.utcnow)


class Permission(Base):
    __tablename__ = "permissions"
    id = Column(Integer, primary_key=True)
    code = Column(String, unique=True, nullable=False, index=True)
    description = Column(Text, default="")


class RolePermission(Base):
    __tablename__ = "role_permissions"
    role_id = Column(Integer, ForeignKey("roles.id", ondelete="CASCADE"), primary_key=True)
    permission_id = Column(Integer, ForeignKey("permissions.id", ondelete="CASCADE"), primary_key=True)


class UserRole(Base):
    __tablename__ = "user_roles"
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    role_id = Column(Integer, ForeignKey("roles.id", ondelete="CASCADE"), primary_key=True)


class StaffProfile(Base):
    __tablename__ = "staff_profiles"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=True)
    subject_id = Column(Integer, ForeignKey("subjects.id"), nullable=True)
    class_id = Column(Integer, ForeignKey("classes.id"), nullable=True)
    section = Column(String, default="")
    status = Column(String, default="active")
    created_at = Column(DateTime, default=datetime.utcnow)
