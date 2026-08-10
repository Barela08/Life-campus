import smtplib
import time
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from sqlalchemy.orm import Session

from .config import settings
from . import models


def _send(to_email: str, subject: str, html_body: str, retries: int = 3) -> tuple[bool, str]:
    if not settings.EMAIL_ENABLED or not settings.SMTP_USERNAME:
        # Log disabled mode
        return False, "Email disabled (EMAIL_ENABLED=false or SMTP_USERNAME not set)"
    last_err = ""
    for attempt in range(retries):
        try:
            msg = MIMEMultipart("alternative")
            from_addr = settings.EMAIL_FROM or settings.SMTP_USERNAME
            from_name = getattr(settings, "SMTP_FROM_NAME", "LifeOS Smart Campus")
            msg["From"] = f"{from_name} <{from_addr}>" if from_name else from_addr
            msg["To"] = to_email
            msg["Subject"] = subject
            msg.attach(MIMEText(html_body, "html"))
            with smtplib.SMTP(getattr(settings, "SMTP_HOST", "smtp.gmail.com"),
                              getattr(settings, "SMTP_PORT", 587), timeout=15) as server:
                if settings.SMTP_USE_TLS:
                    server.starttls()
                server.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
                server.sendmail(settings.SMTP_USERNAME, [to_email], msg.as_string())
            return True, ""
        except Exception as e:
            last_err = str(e)
            if attempt < retries - 1:
                time.sleep(1.5 * (attempt + 1))
    return False, last_err


def log_email(db: Session, to_email: str, subject: str, body_type: str, status: str, error: str = ""):
    db.add(models.EmailLog(to_email=to_email, subject=subject, body_type=body_type, status=status, error=error))
    db.commit()


def test_smtp_connection() -> tuple[bool, str]:
    """Test SMTP connectivity by connecting and authenticating (no email sent)."""
    if not settings.SMTP_USERNAME or not settings.SMTP_PASSWORD:
        return False, "SMTP credentials not configured (SMTP_USERNAME / SMTP_PASSWORD)"
    try:
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=15) as server:
            if settings.SMTP_USE_TLS:
                server.starttls()
            server.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
        return True, "SMTP connection successful"
    except Exception as e:
        return False, f"SMTP connection failed: {e}"


def _attendance_html(student_name, roll_number, dept, course, semester, cls, section, subject,
                     teacher, date_str, time_str, status, confidence, overall_pct, monthly_pct):
    return f"""
    <div style="font-family:Segoe UI,Arial,sans-serif;max-width:640px;margin:auto;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden;box-shadow:0 10px 30px rgba(0,0,0,0.08)">
      <div style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:24px;color:#fff;text-align:center">
        <h2 style="margin:0;font-size:22px">✅ Attendance Marked Successfully</h2>
        <p style="margin:6px 0 0;opacity:0.9;font-size:13px">LifeOS Smart Campus</p>
      </div>
      <div style="padding:28px">
        <p style="margin:0 0 16px;color:#374151;font-size:15px">Hello <b style="color:#111827">{student_name}</b>,</p>
        <p style="margin:0 0 20px;color:#6b7280;font-size:14px">Your attendance has been recorded successfully. Here are your details:</p>
        <table style="width:100%;border-collapse:collapse;font-size:14px">
          <tr><td style="padding:10px;border-bottom:1px solid #f3f4f6;color:#6b7280;width:45%">Student Name</td><td style="padding:10px;border-bottom:1px solid #f3f4f6;font-weight:600;color:#111827">{student_name}</td></tr>
          <tr><td style="padding:10px;border-bottom:1px solid #f3f4f6;color:#6b7280">Roll Number</td><td style="padding:10px;border-bottom:1px solid #f3f4f6;font-weight:600;color:#111827">{roll_number or '-'}</td></tr>
          <tr><td style="padding:10px;border-bottom:1px solid #f3f4f6;color:#6b7280">Department</td><td style="padding:10px;border-bottom:1px solid #f3f4f6;font-weight:600;color:#111827">{dept or '-'}</td></tr>
          <tr><td style="padding:10px;border-bottom:1px solid #f3f4f6;color:#6b7280">Course</td><td style="padding:10px;border-bottom:1px solid #f3f4f6;font-weight:600;color:#111827">{course or '-'}</td></tr>
          <tr><td style="padding:10px;border-bottom:1px solid #f3f4f6;color:#6b7280">Semester</td><td style="padding:10px;border-bottom:1px solid #f3f4f6;font-weight:600;color:#111827">{semester or '-'}</td></tr>
          <tr><td style="padding:10px;border-bottom:1px solid #f3f4f6;color:#6b7280">Class</td><td style="padding:10px;border-bottom:1px solid #f3f4f6;font-weight:600;color:#111827">{cls or '-'}</td></tr>
          <tr><td style="padding:10px;border-bottom:1px solid #f3f4f6;color:#6b7280">Section</td><td style="padding:10px;border-bottom:1px solid #f3f4f6;font-weight:600;color:#111827">{section or '-'}</td></tr>
          <tr><td style="padding:10px;border-bottom:1px solid #f3f4f6;color:#6b7280">Subject</td><td style="padding:10px;border-bottom:1px solid #f3f4f6;font-weight:600;color:#111827">{subject or '-'}</td></tr>
          <tr><td style="padding:10px;border-bottom:1px solid #f3f4f6;color:#6b7280">Teacher</td><td style="padding:10px;border-bottom:1px solid #f3f4f6;font-weight:600;color:#111827">{teacher or '-'}</td></tr>
          <tr><td style="padding:10px;border-bottom:1px solid #f3f4f6;color:#6b7280">Date</td><td style="padding:10px;border-bottom:1px solid #f3f4f6;font-weight:600;color:#111827">{date_str or '-'}</td></tr>
          <tr><td style="padding:10px;border-bottom:1px solid #f3f4f6;color:#6b7280">Time</td><td style="padding:10px;border-bottom:1px solid #f3f4f6;font-weight:600;color:#111827">{time_str or '-'}</td></tr>
          <tr><td style="padding:10px;border-bottom:1px solid #f3f4f6;color:#6b7280">Attendance Status</td><td style="padding:10px;border-bottom:1px solid #f3f4f6;font-weight:600;color:#059669">{status or 'Present'}</td></tr>
          <tr><td style="padding:10px;border-bottom:1px solid #f3f4f6;color:#6b7280">Face Match Confidence</td><td style="padding:10px;border-bottom:1px solid #f3f4f6;font-weight:600;color:#111827">{(confidence * 100) if confidence else 0:.0f}%</td></tr>
          <tr><td style="padding:10px;border-bottom:1px solid #f3f4f6;color:#6b7280">Current Attendance</td><td style="padding:10px;border-bottom:1px solid #f3f4f6;font-weight:600;color:#111827">{overall_pct:.1f}%</td></tr>
          <tr><td style="padding:10px;color:#6b7280">Monthly Attendance</td><td style="padding:10px;font-weight:600;color:#111827">{monthly_pct:.1f}%</td></tr>
        </table>
        <div style="margin-top:24px;padding:14px 18px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;color:#166534;font-size:13px">
          🎉 Great job! Keep attending consistently.
        </div>
        <p style="margin-top:24px;color:#9ca3af;font-size:12px;text-align:center">This is an automated notification from <b>LifeOS Smart Campus</b>. Please do not reply to this email.</p>
      </div>
    </div>
    """


def send_attendance_marked(db: Session, to_email: str, student_name: str, roll_number: str,
                           dept: str, course: str, semester: str, cls: str, section: str, subject: str,
                           teacher: str, date_str: str, time_str: str, confidence: float,
                           overall_pct: float, monthly_pct: float):
    subject_line = f"Attendance Marked Successfully - {student_name}"
    html = _attendance_html(student_name, roll_number, dept, course, semester, cls, section, subject,
                            teacher, date_str, time_str, "Present", confidence, overall_pct, monthly_pct)
    ok, err = _send(to_email, subject_line, html)
    log_email(db, to_email, subject_line, "attendance_marked", "sent" if ok else "failed", err)
    return ok, err


def send_attendance_missed(db: Session, to_email: str, student_name: str, subject: str, cls: str):
    subject_line = f"Attendance Missed - {student_name}"
    html = f"""
    <div style="font-family:Segoe UI,Arial,sans-serif;max-width:600px;margin:auto;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden">
      <div style="background:linear-gradient(135deg,#f59e0b,#ef4444);padding:20px;color:#fff">
        <h2 style="margin:0">⚠️ Attendance Missed</h2>
      </div>
      <div style="padding:24px">
        <p>Hello <b>{student_name}</b>,</p>
        <p>You were marked <b>absent</b> for <b>{subject}</b> ({cls}).</p>
        <p style="color:#6b7280;font-size:13px">If this is an error, please contact your teacher.</p>
      </div>
    </div>
    """
    ok, err = _send(to_email, subject_line, html)
    log_email(db, to_email, subject_line, "attendance_missed", "sent" if ok else "failed", err)
    return ok, err


def send_low_attendance(db: Session, to_email: str, student_name: str, percentage: float):
    subject_line = f"Low Attendance Alert - {student_name}"
    html = f"""
    <div style="font-family:Segoe UI,Arial,sans-serif;max-width:600px;margin:auto;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden">
      <div style="background:linear-gradient(135deg,#ef4444,#dc2626);padding:20px;color:#fff">
        <h2 style="margin:0">📉 Low Attendance Alert</h2>
      </div>
      <div style="padding:24px">
        <p>Hello <b>{student_name}</b>,</p>
        <p>Your attendance percentage is <b>{percentage:.1f}%</b>, which is below the required threshold.</p>
        <p style="color:#6b7280;font-size:13px">Please improve your attendance to avoid any academic consequences.</p>
      </div>
    </div>
    """
    ok, err = _send(to_email, subject_line, html)
    log_email(db, to_email, subject_line, "low_attendance", "sent" if ok else "failed", err)
    return ok, err


def send_monthly_report(db: Session, to_email: str, student_name: str, month: str, percentage: float):
    subject_line = f"Monthly Attendance Report - {month}"
    html = f"""
    <div style="font-family:Segoe UI,Arial,sans-serif;max-width:600px;margin:auto;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden">
      <div style="background:linear-gradient(135deg,#10b981,#059669);padding:20px;color:#fff">
        <h2 style="margin:0">📊 Monthly Attendance Report</h2>
      </div>
      <div style="padding:24px">
        <p>Hello <b>{student_name}</b>,</p>
        <p>Your attendance for <b>{month}</b> is <b>{percentage:.1f}%</b>.</p>
      </div>
    </div>
    """
    ok, err = _send(to_email, subject_line, html)
    log_email(db, to_email, subject_line, "monthly_report", "sent" if ok else "failed", err)
    return ok, err


def send_password_changed(db: Session, to_email: str, full_name: str):
    subject_line = "Password Changed"
    html = f"""
    <div style="font-family:Segoe UI,Arial,sans-serif;max-width:600px;margin:auto;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden">
      <div style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:20px;color:#fff">
        <h2 style="margin:0">🔐 Password Changed</h2>
      </div>
      <div style="padding:24px">
        <p>Hello <b>{full_name}</b>,</p>
        <p>Your password has been changed successfully.</p>
        <p style="color:#6b7280;font-size:13px">If you did not perform this action, contact your administrator immediately.</p>
      </div>
    </div>
    """
    ok, err = _send(to_email, subject_line, html)
    log_email(db, to_email, subject_line, "password_changed", "sent" if ok else "failed", err)
    return ok, err


def send_leave_notification(db: Session, to_email: str, full_name: str, status: str):
    subject_line = f"Leave {status.capitalize()}"
    html = f"""
    <div style="font-family:Segoe UI,Arial,sans-serif;max-width:600px;margin:auto;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden">
      <div style="background:linear-gradient(135deg,#06b6d4,#3b82f6);padding:20px;color:#fff">
        <h2 style="margin:0">📝 Leave {status.capitalize()}</h2>
      </div>
      <div style="padding:24px">
        <p>Hello <b>{full_name}</b>,</p>
        <p>Your leave request has been <b>{status}</b>.</p>
      </div>
    </div>
    """
    ok, err = _send(to_email, subject_line, html)
    log_email(db, to_email, subject_line, f"leave_{status}", "sent" if ok else "failed", err)
    return ok, err