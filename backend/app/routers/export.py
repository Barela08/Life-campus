import csv
import io
from datetime import date
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from ..database import get_db
from .. import models, security

router = APIRouter(prefix="/api/export", tags=["export"])


def _get_records(db: Session, record_date, student_id, class_id, subject_id=None):
    q = db.query(models.AttendanceRecord)
    if record_date:
        q = q.filter(models.AttendanceRecord.date == record_date)
    if student_id:
        q = q.filter(models.AttendanceRecord.student_id == student_id)
    if class_id:
        q = q.filter(models.AttendanceRecord.session_id.in_(
            db.query(models.AttendanceSession.id).filter(models.AttendanceSession.class_id == class_id)))
    if subject_id:
        q = q.filter(models.AttendanceRecord.session_id.in_(
            db.query(models.AttendanceSession.id).filter(models.AttendanceSession.subject_id == subject_id)))
    return q.all()


def _rows(records):
    return [["ID", "Student", "Subject", "Class", "Teacher", "Status", "Date", "Time", "Confidence", "Method"]] + [
        [r.id, r.student_name, r.subject, r.class_name, r.teacher, r.status, str(r.date), r.time, r.confidence, r.method]
        for r in records
    ]


@router.get("/csv")
def export_csv(record_date: date = None, student_id: int = None, class_id: int = None,
               subject_id: int = None, user: models.User = Depends(security.get_current_user),
               db: Session = Depends(get_db)):
    records = _get_records(db, record_date, student_id, class_id, subject_id)
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerows(_rows(records))
    buf.seek(0)
    filename = f"attendance_{date.today()}.csv"
    return StreamingResponse(iter([buf.getvalue()]), media_type="text/csv",
                             headers={"Content-Disposition": f"attachment; filename={filename}"})


@router.get("/excel")
def export_excel(record_date: date = None, student_id: int = None, class_id: int = None,
                 subject_id: int = None, user: models.User = Depends(security.get_current_user),
                 db: Session = Depends(get_db)):
    from openpyxl import Workbook
    records = _get_records(db, record_date, student_id, class_id, subject_id)
    wb = Workbook()
    ws = wb.active
    ws.title = "Attendance"
    for row in _rows(records):
        ws.append(row)
    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    filename = f"attendance_{date.today()}.xlsx"
    return StreamingResponse(iter([buf.getvalue()]),
                             media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                             headers={"Content-Disposition": f"attachment; filename={filename}"})


@router.get("/pdf")
def export_pdf(record_date: date = None, student_id: int = None, class_id: int = None,
               subject_id: int = None, user: models.User = Depends(security.get_current_user),
               db: Session = Depends(get_db)):
    from reportlab.lib.pagesizes import letter, landscape
    from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
    from reportlab.lib import colors
    from reportlab.lib.styles import getSampleStyleSheet
    records = _get_records(db, record_date, student_id, class_id, subject_id)
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=landscape(letter))
    styles = getSampleStyleSheet()
    elements = [Paragraph("Attendance Report - LifeOS Smart Campus", styles["Title"]), Spacer(1, 12)]
    data = _rows(records)
    table = Table(data)
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#6366f1")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f3f4f6")]),
    ]))
    elements.append(table)
    doc.build(elements)
    buf.seek(0)
    filename = f"attendance_{date.today()}.pdf"
    return StreamingResponse(iter([buf.getvalue()]), media_type="application/pdf",
                             headers={"Content-Disposition": f"attachment; filename={filename}"})
