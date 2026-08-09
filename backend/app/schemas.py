from typing import Optional, List
from datetime import datetime, date
from pydantic import BaseModel, EmailStr, Field


# Auth
class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    role: str
    user_id: int
    full_name: str
    must_change_password: bool = False


class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str


class ForgotPasswordRequest(BaseModel):
    email: str


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str


# Generic
class MessageResponse(BaseModel):
    message: str


# Department
class DepartmentCreate(BaseModel):
    name: str
    code: str
    description: str = ""


class DepartmentUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    description: Optional[str] = None


class DepartmentOut(BaseModel):
    id: int
    name: str
    code: str
    description: str
    created_at: datetime

    class Config:
        from_attributes = True


# Course
class CourseCreate(BaseModel):
    name: str
    code: str
    duration: str = ""
    department_id: int


class CourseOut(BaseModel):
    id: int
    name: str
    code: str
    duration: str
    department_id: int
    created_at: datetime

    class Config:
        from_attributes = True


# Semester
class SemesterCreate(BaseModel):
    name: str
    code: str
    order: int = 1


class SemesterOut(BaseModel):
    id: int
    name: str
    code: str
    order: int
    created_at: datetime

    class Config:
        from_attributes = True


# Class
class ClassCreate(BaseModel):
    name: str
    code: str
    course_id: int
    semester_id: int


class ClassOut(BaseModel):
    id: int
    name: str
    code: str
    course_id: int
    semester_id: int
    created_at: datetime

    class Config:
        from_attributes = True


# Subject
class SubjectCreate(BaseModel):
    name: str
    code: str
    department_id: int


class SubjectOut(BaseModel):
    id: int
    name: str
    code: str
    department_id: int
    created_at: datetime

    class Config:
        from_attributes = True


# Student
class StudentCreate(BaseModel):
    full_name: str
    student_id: str
    roll_number: str
    section: str = ""
    department_id: int
    course_id: int
    semester_id: int
    class_id: int
    email: EmailStr
    phone: str = ""
    parent_email: Optional[EmailStr] = None
    password: str = "1234"


class StudentUpdate(BaseModel):
    full_name: Optional[str] = None
    roll_number: Optional[str] = None
    section: Optional[str] = None
    department_id: Optional[int] = None
    course_id: Optional[int] = None
    semester_id: Optional[int] = None
    class_id: Optional[int] = None
    phone: Optional[str] = None
    parent_email: Optional[EmailStr] = None


class StudentOut(BaseModel):
    id: int
    user_id: int
    student_id: str
    full_name: str
    roll_number: str
    section: str = ""
    department_id: int
    course_id: int
    semester_id: int
    class_id: int
    email: str
    phone: str
    parent_email: Optional[str]
    profile_photo: str
    face_status: str
    created_at: datetime

    class Config:
        from_attributes = True


# Teacher
class TeacherCreate(BaseModel):
    full_name: str
    teacher_id: str
    email: EmailStr
    phone: str = ""
    department_id: int
    password: str = "1234"


class TeacherOut(BaseModel):
    id: int
    user_id: int
    teacher_id: str
    full_name: str
    email: str
    phone: str
    department_id: int
    created_at: datetime

    class Config:
        from_attributes = True


# Attendance - only Department, Class, Section (no subject)
class StartSessionRequest(BaseModel):
    department_id: int
    class_id: int
    section: str = ""
    camera_id: str = "default"


class MarkAttendanceRequest(BaseModel):
    session_id: int
    student_id: int
    confidence: float = 0.0
    camera_id: str = "default"


class ManualAttendanceRequest(BaseModel):
    session_id: int
    student_id: int
    status: str = "present"


class FaceMatchRequest(BaseModel):
    session_id: int
    image_b64: str
    camera_id: str = "default"


class RegisterFaceRequest(BaseModel):
    student_id: int
    angle: str = "front"
    image_b64: str


# Reports / Queries
class AttendanceQuery(BaseModel):
    date: Optional[date] = None
    student_id: Optional[int] = None
    class_id: Optional[int] = None
    subject_id: Optional[int] = None


class NotificationOut(BaseModel):
    id: int
    title: str
    message: str
    type: str
    is_read: bool
    created_at: datetime

    class Config:
        from_attributes = True


class SystemConfigOut(BaseModel):
    key: str
    value: str = ""
    description: str = ""
    updated_at: datetime = None

    class Config:
        from_attributes = True


class SetThresholdRequest(BaseModel):
    threshold: float


class TestEmailRequest(BaseModel):
    to_email: Optional[EmailStr] = None


class EmailFailureOut(BaseModel):
    id: int
    to_email: str
    subject: str
    body_type: str
    error: str
    attendance_record_id: int = None
    retried: bool
    created_at: datetime

    class Config:
        from_attributes = True
