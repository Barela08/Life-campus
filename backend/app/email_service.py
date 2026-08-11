import time
import html
import smtplib
from datetime import datetime
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Optional, Dict, Any, Tuple

from sqlalchemy.orm import Session

from .config import settings
from . import models


# ============================================================
# SAFE HELPERS
# ============================================================

def _safe(value: Any) -> str:
    """Safely escape dynamic values before putting them into HTML."""
    if value is None:
        return "-"
    return html.escape(str(value))


def _setting(name: str, default: Any = None) -> Any:
    """Read a setting safely even if the setting does not exist."""
    return getattr(settings, name, default)


# ============================================================
# SMTP SEND
# ============================================================

def _send(
    to_email: str,
    subject: str,
    html_body: str,
    retries: int = 2,
) -> Tuple[bool, str]:

    if not to_email:
        return False, "Recipient email is empty"

    if not _setting("EMAIL_ENABLED", False):
        return False, "Email disabled (EMAIL_ENABLED=false)"

    smtp_username = _setting("SMTP_USERNAME", "")
    smtp_password = _setting("SMTP_PASSWORD", "")

    if not smtp_username or not smtp_password:
        return False, (
            "SMTP credentials not configured "
            "(SMTP_USERNAME / SMTP_PASSWORD)"
        )

    smtp_host = _setting("SMTP_HOST", "smtp.gmail.com")
    smtp_port = int(_setting("SMTP_PORT", 587))
    smtp_tls = bool(_setting("SMTP_USE_TLS", True))

    from_addr = (
        _setting("EMAIL_FROM", None)
        or _setting("SMTP_FROM_EMAIL", None)
        or smtp_username
    )

    from_name = _setting(
        "SMTP_FROM_NAME",
        "LifeOS Smart Campus",
    )

    last_error = ""

    for attempt in range(max(1, retries)):

        try:
            msg = MIMEMultipart("alternative")

            if from_name:
                msg["From"] = f"{from_name} <{from_addr}>"
            else:
                msg["From"] = from_addr

            msg["To"] = to_email
            msg["Subject"] = subject

            msg.attach(
                MIMEText(
                    html_body,
                    "html",
                    "utf-8",
                )
            )

            with smtplib.SMTP(
                smtp_host,
                smtp_port,
                timeout=15,
            ) as server:

                server.ehlo()

                if smtp_tls:
                    server.starttls()
                    server.ehlo()

                server.login(
                    smtp_username,
                    smtp_password,
                )

                server.sendmail(
                    from_addr,
                    [to_email],
                    msg.as_string(),
                )

            return True, ""

        except Exception as exc:

            last_error = str(exc)

            if attempt < retries - 1:
                time.sleep(1.0)

    return False, last_error or "Unknown SMTP error"


def send_email(to_email: str, subject: str, html_body: str, retries: int = 2) -> Tuple[bool, str]:
    """The single SMTP gateway used by every backend email workflow."""
    return _send(to_email, subject, html_body, retries)


def send_notification_email(
    to_email: str,
    recipient_name: str,
    title: str,
    message: str,
    notification_type: str,
    sender_name: str,
    sent_at: datetime,
) -> Tuple[bool, str]:
    """Send one private, professional notification email to one recipient."""
    subject = f"[LifeOS Smart Campus] {title}"
    html_body = f"""
    <div style="font-family:Arial,sans-serif;color:#1f2937;max-width:640px;margin:auto;padding:24px">
      <h2 style="color:#047857;margin-top:0">LifeOS Smart Campus</h2>
      <p>Hello {_safe(recipient_name)},</p>
      <p>You have received a new notification from LifeOS Smart Campus.</p>
      <div style="border:1px solid #d1d5db;border-radius:10px;padding:18px;background:#f9fafb">
        <p><strong>Title:</strong> {_safe(title)}</p>
        <p style="white-space:pre-wrap"><strong>Message:</strong><br>{_safe(message)}</p>
        <p><strong>Type:</strong> {_safe(notification_type.title())}</p>
        <p><strong>Sent by:</strong> {_safe(sender_name)}</p>
        <p><strong>Date:</strong> {_safe(sent_at.strftime('%d %B %Y, %I:%M %p'))}</p>
      </div>
      <p>Please log in to LifeOS Smart Campus for more details.</p>
      <p>Regards,<br>LifeOS Smart Campus</p>
    </div>"""
    return _send(to_email, subject, html_body)


# ============================================================
# EMAIL LOG
# ============================================================

def log_email(
    db: Session,
    to_email: str,
    subject: str,
    body_type: str,
    status: str,
    error: str = "",
    student_id: Optional[int] = None,
    attendance_id: Optional[int] = None,
):
    """
    Save email status.

    IMPORTANT:
    Email logging must never break attendance processing.
    """

    try:

        email_log = models.EmailLog(
            student_id=student_id,
            attendance_id=attendance_id,
            recipient_email=to_email,
            to_email=to_email,
            subject=subject,
            body_type=body_type,
            status=status,
            error_message=error,
            error=error,
            sent_at=(
                datetime.utcnow()
                if status == "sent"
                else None
            ),
        )

        db.add(email_log)
        db.commit()

        return True

    except Exception:

        try:
            db.rollback()
        except Exception:
            pass

        return False


# ============================================================
# GENERIC HTML
# ============================================================

def _basic_html(
    title: str,
    greeting: str,
    message: str,
    rows: Optional[Dict[str, Any]] = None,
):

    rows = rows or {}

    row_html = ""

    for label, value in rows.items():

        row_html += (
            "<tr>"
            "<td style='padding:10px;"
            "border-bottom:1px solid #f3f4f6;"
            "color:#6b7280;width:42%'>"
            f"{_safe(label)}"
            "</td>"
            "<td style='padding:10px;"
            "border-bottom:1px solid #f3f4f6;"
            "font-weight:600;color:#111827'>"
            f"{_safe(value)}"
            "</td>"
            "</tr>"
        )

    table = ""

    if row_html:
        table = (
            "<table style='width:100%;"
            "border-collapse:collapse;"
            "font-size:14px'>"
            f"{row_html}"
            "</table>"
        )

    return f"""
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport"
      content="width=device-width,initial-scale=1">
</head>

<body style="margin:0;padding:20px;background:#f8fafc">

<div style="
font-family:Segoe UI,Arial,sans-serif;
max-width:640px;
margin:auto;
background:#ffffff;
border:1px solid #e5e7eb;
border-radius:16px;
overflow:hidden;
">

<div style="
background:linear-gradient(135deg,#2563eb,#059669);
padding:24px;
color:#ffffff;
text-align:center;
">

<h2 style="margin:0;font-size:22px">
{_safe(title)}
</h2>

<p style="
margin:6px 0 0;
opacity:.9;
font-size:13px;
">
LifeOS Smart Campus
</p>

</div>

<div style="padding:28px">

<p style="
margin:0 0 16px;
color:#374151;
font-size:15px;
">

Hello
<b style="color:#111827">
{_safe(greeting)}
</b>,

</p>

<p style="
margin:0 0 20px;
color:#6b7280;
font-size:14px;
">

{_safe(message)}

</p>

{table}

<p style="
margin-top:24px;
color:#9ca3af;
font-size:12px;
text-align:center;
">

This is an automated notification from
<b>LifeOS Smart Campus</b>.

</p>

</div>
</div>

</body>
</html>
"""


def build_basic_email(
    title: str,
    greeting: str,
    message: str,
    rows: Optional[Dict[str, Any]] = None,
) -> str:
    return _basic_html(title, greeting, message, rows)


def _safe_delivery_error(error: object) -> str:
    text = str(error or "").strip()
    for secret in (
        _setting("SMTP_PASSWORD", ""),
        _setting("SMTP_USERNAME", ""),
        _setting("SMTP_FROM_EMAIL", ""),
    ):
        if secret:
            text = text.replace(secret, "[redacted]")
    return (text or "Email delivery failed")[:1000]


def _login_url() -> str:
    return (
        _setting("APP_LOGIN_URL", None)
        or _setting("FRONTEND_LOGIN_URL", None)
        or _setting("FRONTEND_URL", None)
        or "http://localhost:5173/login"
    )


def send_welcome_student_email(
    db: Session,
    to_email: str,
    full_name: str,
    temp_password: str,
    rows: Dict[str, Any],
) -> Tuple[bool, str]:
    subject = "Welcome to LifeOS Smart Campus - Your Student Account"
    body_rows = {
        **rows,
        "Login Email": to_email,
        "Temporary Password": temp_password,
        "Login": _login_url(),
    }
    html_body = _basic_html(
        "Your Student Account Is Ready",
        full_name,
        "Your LifeOS Smart Campus account has been created. Please log in and change your temporary password immediately.",
        body_rows,
    )
    ok, error = _send(to_email, subject, html_body)
    safe_error = "" if ok else _safe_delivery_error(error)
    log_email(db, to_email, subject, "welcome_student", "sent" if ok else "failed", safe_error)
    return ok, safe_error


def send_welcome_staff_email(
    db: Session,
    to_email: str,
    full_name: str,
    temp_password: str,
    rows: Dict[str, Any],
) -> Tuple[bool, str]:
    subject = "Welcome to LifeOS Smart Campus - Your Staff Account"
    body_rows = {
        **rows,
        "Login Email": to_email,
        "Temporary Password": temp_password,
        "Login": _login_url(),
    }
    html_body = _basic_html(
        "Your Staff Account Is Ready",
        full_name,
        "Your LifeOS Smart Campus staff account has been created. Please log in and change your temporary password immediately.",
        body_rows,
    )
    ok, error = _send(to_email, subject, html_body)
    safe_error = "" if ok else _safe_delivery_error(error)
    log_email(db, to_email, subject, "welcome_staff", "sent" if ok else "failed", safe_error)
    return ok, safe_error


# ============================================================
# ACCOUNT CREATED
# ============================================================

def send_account_created(
    db: Session,
    to_email: str,
    full_name: str,
    role: str,
    username: str,
):

    subject = (
        f"LifeOS Smart Campus "
        f"{role.capitalize()} Account Created"
    )

    html_body = _basic_html(
        "Account Created Successfully",
        full_name,
        "Your LifeOS Smart Campus account has been created successfully.",
        {
            "Role": role.capitalize(),
            "Username": username,
            "Created At": datetime.now().strftime(
                "%d %B %Y, %I:%M %p"
            ),
        },
    )

    ok, error = _send(
        to_email,
        subject,
        html_body,
    )

    log_email(
        db,
        to_email,
        subject,
        f"{role}_account_created",
        "sent" if ok else "failed",
        error,
    )

    return ok, error


# ============================================================
# PROFILE UPDATED
# ============================================================

def send_profile_updated(
    db: Session,
    to_email: str,
    full_name: str,
    role: str,
    changed_fields: list[str],
):

    subject = "LifeOS Smart Campus Profile Updated"

    html_body = _basic_html(
        "Profile Updated Successfully",
        full_name,
        "Your LifeOS Smart Campus profile information was updated successfully.",
        {
            "Role": role.capitalize(),
            "Updated Fields": (
                ", ".join(changed_fields)
                if changed_fields
                else "Profile information"
            ),
            "Updated At": datetime.now().strftime(
                "%d %B %Y, %I:%M %p"
            ),
        },
    )

    ok, error = _send(
        to_email,
        subject,
        html_body,
    )

    log_email(
        db,
        to_email,
        subject,
        f"{role}_profile_updated",
        "sent" if ok else "failed",
        error,
    )

    return ok, error


# ============================================================
# ADMIN DATA CHANGED
# ============================================================

def send_admin_data_changed(
    db: Session,
    to_email: str,
    admin_name: str,
    action: str,
    entity: str,
    name: str,
):

    subject = (
        f"LifeOS Smart Campus "
        f"{entity} {action}"
    )

    html_body = _basic_html(
        f"{entity} {action}",
        admin_name,
        (
            f"A LifeOS Smart Campus "
            f"{entity.lower()} record was "
            f"{action.lower()} successfully."
        ),
        {
            "Entity": entity,
            "Record": name,
            "Action": action,
            "Time": datetime.now().strftime(
                "%d %B %Y, %I:%M %p"
            ),
        },
    )

    ok, error = _send(
        to_email,
        subject,
        html_body,
    )

    log_email(
        db,
        to_email,
        subject,
        "admin_data_changed",
        "sent" if ok else "failed",
        error,
    )

    return ok, error


# ============================================================
# ATTENDANCE UPDATED
# ============================================================

def send_attendance_updated(
    db: Session,
    to_email: str,
    student_name: str,
    status: str,
    date_str: str,
    time_str: str,
    teacher: str,
    attendance_id: Optional[int] = None,
    student_id: Optional[int] = None,
):

    subject = "LifeOS Smart Campus Attendance Updated"

    html_body = _basic_html(
        "Attendance Updated",
        student_name,
        "Your attendance record was updated successfully.",
        {
            "Student": student_name,
            "Status": status.upper(),
            "Teacher": teacher,
            "Date": date_str,
            "Time": time_str,
        },
    )

    ok, error = _send(
        to_email,
        subject,
        html_body,
    )

    log_email(
        db,
        to_email,
        subject,
        "attendance_updated",
        "sent" if ok else "failed",
        error,
        student_id=student_id,
        attendance_id=attendance_id,
    )

    return ok, error


# ============================================================
# SMTP TEST
# ============================================================

def test_smtp_connection() -> tuple[bool, str]:

    username = _setting("SMTP_USERNAME", "")
    password = _setting("SMTP_PASSWORD", "")

    if not username or not password:
        return (
            False,
            "SMTP credentials not configured",
        )

    try:

        host = _setting(
            "SMTP_HOST",
            "smtp.gmail.com",
        )

        port = int(
            _setting(
                "SMTP_PORT",
                587,
            )
        )

        use_tls = bool(
            _setting(
                "SMTP_USE_TLS",
                True,
            )
        )

        with smtplib.SMTP(
            host,
            port,
            timeout=15,
        ) as server:

            server.ehlo()

            if use_tls:
                server.starttls()
                server.ehlo()

            server.login(
                username,
                password,
            )

        return (
            True,
            "SMTP connection successful",
        )

    except Exception as exc:

        return (
            False,
            f"SMTP connection failed: {exc}",
        )


# ============================================================
# ATTENDANCE EMAIL HTML
# ============================================================

def _attendance_html(
    student_name,
    roll_number,
    dept,
    course,
    semester,
    cls,
    section,
    subject,
    teacher,
    date_str,
    time_str,
    status,
    confidence,
    overall_pct,
    monthly_pct,
):

    confidence_percent = (
        float(confidence or 0) * 100
    )

    overall = float(
        overall_pct or 0
    )

    monthly = float(
        monthly_pct or 0
    )

    data = [
        ("Student Name", student_name),
        ("Roll Number", roll_number),
        ("Department", dept),
        ("Course", course),
        ("Semester", semester),
        ("Class", cls),
        ("Section", section),
        ("Subject", subject),
        ("Teacher", teacher),
        ("Date", date_str),
        ("Time", time_str),
        ("Attendance Status", status or "Present"),
        (
            "Face Match Confidence",
            f"{confidence_percent:.0f}%",
        ),
        (
            "Current Attendance",
            f"{overall:.1f}%",
        ),
        (
            "Monthly Attendance",
            f"{monthly:.1f}%",
        ),
    ]

    rows = ""

    for label, value in data:

        rows += f"""
<tr>
<td style="
padding:10px;
border-bottom:1px solid #f3f4f6;
color:#6b7280;
width:45%;
">
{_safe(label)}
</td>

<td style="
padding:10px;
border-bottom:1px solid #f3f4f6;
font-weight:600;
color:#111827;
">
{_safe(value)}
</td>
</tr>
"""

    return f"""
<!DOCTYPE html>
<html>

<head>
<meta charset="UTF-8">

<meta name="viewport"
      content="width=device-width,initial-scale=1">

<title>Attendance Marked</title>
</head>

<body style="
margin:0;
padding:20px;
background:#f8fafc;
">

<div style="
font-family:Segoe UI,Arial,sans-serif;
max-width:640px;
margin:auto;
background:#ffffff;
border:1px solid #e5e7eb;
border-radius:18px;
overflow:hidden;
box-shadow:0 10px 30px rgba(0,0,0,.08);
">

<div style="
background:linear-gradient(
135deg,
#4f46e5,
#7c3aed
);
padding:28px;
color:#fff;
text-align:center;
">

<div style="
font-size:38px;
margin-bottom:8px;
">
✓
</div>

<h2 style="
margin:0;
font-size:24px;
">
Attendance Marked Successfully
</h2>

<p style="
margin:8px 0 0;
opacity:.9;
font-size:13px;
">
LifeOS Smart Campus
</p>

</div>

<div style="padding:28px">

<p style="
margin:0 0 16px;
font-size:16px;
color:#374151;
">

Hello
<b style="color:#111827">
{_safe(student_name)}
</b>,

</p>

<p style="
color:#6b7280;
font-size:14px;
line-height:1.6;
">

Your face was successfully recognized and your attendance
has been marked as <b style="color:#059669">PRESENT</b>.

</p>

<table style="
width:100%;
border-collapse:collapse;
font-size:14px;
margin-top:20px;
">

{rows}

</table>

<div style="
margin-top:24px;
padding:16px;
background:#f0fdf4;
border:1px solid #bbf7d0;
border-radius:12px;
color:#166534;
font-size:13px;
">

<b>✓ Attendance recorded successfully.</b>

<br>

Keep attending consistently and maintain your attendance.

</div>

<p style="
margin-top:26px;
color:#9ca3af;
font-size:12px;
text-align:center;
">

This is an automated notification from
<b>LifeOS Smart Campus</b>.
Please do not reply to this email.

</p>

</div>
</div>

</body>
</html>
"""


# ============================================================
# ATTENDANCE MARKED
# ============================================================

def send_attendance_marked(
    db: Session,
    to_email: str,
    student_name: str,
    roll_number: str,
    dept: str,
    course: str,
    semester: str,
    cls: str,
    section: str,
    subject: str,
    teacher: str,
    date_str: str,
    time_str: str,
    confidence: float,
    overall_pct: float,
    monthly_pct: float,
    student_id: Optional[int] = None,
    attendance_id: Optional[int] = None,
):

    subject_line = (
        "Attendance Marked Successfully "
        "– LifeOS Smart Campus"
    )

    # --------------------------------------------------------
    # DUPLICATE EMAIL PROTECTION
    # --------------------------------------------------------

    if attendance_id is not None:

        try:

            existing = (
                db.query(models.EmailLog)
                .filter(
                    models.EmailLog.attendance_id
                    == attendance_id,

                    models.EmailLog.body_type
                    == "attendance_marked",

                    models.EmailLog.to_email
                    == to_email,
                )
                .first()
            )

            if existing:

                return (
                    existing.status == "sent",
                    existing.error_message
                    or existing.error
                    or "Email already processed",
                )

        except Exception:
            # Email logging problem must never
            # break attendance.
            try:
                db.rollback()
            except Exception:
                pass

    # --------------------------------------------------------
    # CREATE EMAIL
    # --------------------------------------------------------

    html_body = _attendance_html(
        student_name,
        roll_number,
        dept,
        course,
        semester,
        cls,
        section,
        subject,
        teacher,
        date_str,
        time_str,
        "Present",
        confidence,
        overall_pct,
        monthly_pct,
    )

    # --------------------------------------------------------
    # SEND
    # --------------------------------------------------------

    ok, error = _send(
        to_email,
        subject_line,
        html_body,
        retries=2,
    )

    # --------------------------------------------------------
    # LOG
    # --------------------------------------------------------

    log_email(
        db,
        to_email,
        subject_line,
        "attendance_marked",
        "sent" if ok else "failed",
        error,
        student_id=student_id,
        attendance_id=attendance_id,
    )

    return ok, error


# ============================================================
# ATTENDANCE MISSED
# ============================================================

def send_attendance_missed(
    db: Session,
    to_email: str,
    student_name: str,
    subject: str,
    cls: str,
):

    subject_line = (
        f"Attendance Missed - {student_name}"
    )

    html_body = _basic_html(
        "⚠️ Attendance Missed",
        student_name,
        (
            f"You were marked absent for "
            f"{subject} ({cls})."
        ),
        {
            "Student": student_name,
            "Subject": subject,
            "Class": cls,
            "Status": "Absent",
        },
    )

    ok, error = _send(
        to_email,
        subject_line,
        html_body,
    )

    log_email(
        db,
        to_email,
        subject_line,
        "attendance_missed",
        "sent" if ok else "failed",
        error,
    )

    return ok, error


# ============================================================
# LOW ATTENDANCE
# ============================================================

def send_low_attendance(
    db: Session,
    to_email: str,
    student_name: str,
    percentage: float,
):

    subject_line = (
        f"Low Attendance Alert - {student_name}"
    )

    html_body = _basic_html(
        "📉 Low Attendance Alert",
        student_name,
        (
            "Your attendance percentage is below "
            "the required threshold."
        ),
        {
            "Student": student_name,
            "Attendance": f"{percentage:.1f}%",
            "Status": "Low Attendance",
        },
    )

    ok, error = _send(
        to_email,
        subject_line,
        html_body,
    )

    log_email(
        db,
        to_email,
        subject_line,
        "low_attendance",
        "sent" if ok else "failed",
        error,
    )

    return ok, error


# ============================================================
# MONTHLY REPORT
# ============================================================

def send_monthly_report(
    db: Session,
    to_email: str,
    student_name: str,
    month: str,
    percentage: float,
):

    subject_line = (
        f"Monthly Attendance Report - {month}"
    )

    html_body = _basic_html(
        "📊 Monthly Attendance Report",
        student_name,
        (
            f"Your attendance report for "
            f"{month} is ready."
        ),
        {
            "Student": student_name,
            "Month": month,
            "Attendance": f"{percentage:.1f}%",
        },
    )

    ok, error = _send(
        to_email,
        subject_line,
        html_body,
    )

    log_email(
        db,
        to_email,
        subject_line,
        "monthly_report",
        "sent" if ok else "failed",
        error,
    )

    return ok, error


# ============================================================
# PASSWORD CHANGED
# ============================================================

def send_password_changed(
    db: Session,
    to_email: str,
    full_name: str,
):

    subject_line = (
        "Your LifeOS Smart Campus "
        "password was changed successfully."
    )

    html_body = _basic_html(
        "🔐 Password Changed",
        full_name,
        (
            "Your password has been changed successfully."
        ),
        {
            "Account": full_name,
            "Changed At": datetime.now().strftime(
                "%d %B %Y, %I:%M %p"
            ),
        },
    )

    ok, error = _send(
        to_email,
        subject_line,
        html_body,
    )

    log_email(
        db,
        to_email,
        subject_line,
        "password_changed",
        "sent" if ok else "failed",
        error,
    )

    return ok, error


# ============================================================
# LEAVE NOTIFICATION
# ============================================================

def send_leave_notification(
    db: Session,
    to_email: str,
    full_name: str,
    status: str,
):

    status_clean = str(status).capitalize()

    subject_line = (
        f"Leave {status_clean}"
    )

    html_body = _basic_html(
        f"📝 Leave {status_clean}",
        full_name,
        (
            f"Your leave request has been "
            f"{status_clean.lower()}."
        ),
        {
            "Student": full_name,
            "Leave Status": status_clean,
        },
    )

    ok, error = _send(
        to_email,
        subject_line,
        html_body,
    )

    log_email(
        db,
        to_email,
        subject_line,
        f"leave_{status}",
        "sent" if ok else "failed",
        error,
    )

    return ok, error


def send_new_leave_request_email(db: Session, to_email: str, reviewer_name: str, applicant_name: str,
                                 applicant_role: str, from_date: object, to_date: object, reason: str) -> Tuple[bool, str]:
    """Notify an administrator after the leave request has committed successfully."""
    subject = "LifeOS Smart Campus - New Leave Request"
    body = _basic_html("New Leave Request", reviewer_name, "A leave request requires your review.", {
        "Applicant": applicant_name, "Role": applicant_role.title(), "Start Date": from_date,
        "End Date": to_date, "Reason": reason, "Current Status": "Pending",
    })
    ok, error = send_email(to_email, subject, body)
    log_email(db, to_email, subject, "leave_submitted", "sent" if ok else "failed", error)
    return ok, error


def send_leave_decision_email(db: Session, to_email: str, applicant_name: str, status: str, from_date: object,
                              to_date: object, reason: str, reviewer_name: str, note: str = "") -> Tuple[bool, str]:
    status_title = status.capitalize()
    subject = f"LifeOS Smart Campus - Leave {status_title}"
    rows = {"Name": applicant_name, "Leave dates": f"{from_date} to {to_date}", "Reason": reason,
            f"{status_title} by": reviewer_name, "Status": status_title}
    if note:
        rows["Rejection reason" if status == "rejected" else "Review note"] = note
    body = _basic_html(f"Leave {status_title}", applicant_name, f"Your leave request has been {status}.", rows)
    ok, error = send_email(to_email, subject, body)
    log_email(db, to_email, subject, f"leave_{status}", "sent" if ok else "failed", error)
    return ok, error
