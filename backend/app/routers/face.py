import base64
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional

from ..database import get_db
from .. import models, schemas, face_service, attendance_service, security, email_service
from ..config import settings

router = APIRouter(prefix="/api/face", tags=["face"])

ALLOWED_ANGLES = {"front", "left", "right", "up", "down", "smile", "normal"}


def get_config_threshold(db: Session) -> float:
    """Read the configurable face match threshold from SystemConfig (DB)."""
    row = db.query(models.SystemConfig).filter(models.SystemConfig.key == "face_match_threshold").first()
    if row:
        try:
            return float(row.value)
        except (TypeError, ValueError):
            pass
    return settings.FACE_MATCH_THRESHOLD


def _validate_registration_image(db: Session, image_b64: str) -> dict:
    """Performs image quality, face count validation. Returns dict with passed/reason."""
    # 1. Check the frame is not empty
    if not image_b64 or len(image_b64) < 100:
        return {"passed": False, "reason": "Camera frame is not ready. Please wait."}

    # 2. Face count check — exactly one face required
    try:
        n = face_service.detect_faces_count(image_b64)
    except Exception:
        return {"passed": False, "reason": "Face registration failed."}

    if n == 0:
        return {"passed": False, "reason": "No face detected."}
    if n > 1:
        return {"passed": False, "reason": "Multiple faces detected. Please keep only the student in front of the camera."}

    # 3. Image quality check (blur, lighting, distance)
    quality = face_service.check_image_quality(image_b64)
    if not quality["passed"]:
        return {"passed": False, "reason": quality["reason"]}

    return {"passed": True, "reason": "OK"}


@router.post("/register")
def register_face(req: schemas.RegisterFaceRequest,
                  user: models.User = Depends(security.get_current_user),
                  db: Session = Depends(get_db)):
    """Register a face embedding for a student at a specific angle."""
    if user.role not in ("admin", "student"):
        raise HTTPException(status_code=403, detail="Not allowed")

    # Validate angle
    if req.angle not in ALLOWED_ANGLES:
        # Backwards compatibility for "neutral"
        if req.angle == "neutral":
            req.angle = "normal"
        else:
            raise HTTPException(status_code=400, detail=f"Invalid angle. Must be one of: {', '.join(sorted(ALLOWED_ANGLES))}")

    # Find the student using the DB int id
    student = db.query(models.Student).get(req.student_id)
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    # Validate the image
    validation = _validate_registration_image(db, req.image_b64)
    if not validation["passed"]:
        raise HTTPException(status_code=400, detail=validation["reason"])

    # Generate embedding
    emb, n = face_service.extract_embedding(req.image_b64)
    if not emb:
        raise HTTPException(status_code=400, detail="No face detected.")

    # Prevent duplicate angle — replace existing if any
    existing = db.query(models.FaceEmbedding).filter(
        models.FaceEmbedding.student_id == student.id,
        models.FaceEmbedding.angle == req.angle,
    ).first()
    if existing:
        db.delete(existing)
        db.flush()

    # Save snapshot
    snapshot = face_service.save_snapshot(req.image_b64, "faces")

    # Encrypt and store embedding
    enc = face_service.encrypt_embedding(emb)
    fe = models.FaceEmbedding(student_id=student.id, embedding=enc,
                              angle=req.angle, snapshot_path=snapshot)
    db.add(fe)
    student.face_status = "pending"
    db.commit()
    db.refresh(fe)

    # Audit log
    db.add(models.AuditLog(user_id=user.id, action="face_registered",
                           detail=f"Angle '{req.angle}' registered for student {student.full_name}"))
    db.commit()

    return {"message": f"Face {req.angle} registered", "num_faces": int(n),
            "embedding_id": fe.id, "angle": req.angle, "student_id": student.id}


@router.get("/status/{student_id}")
def face_status(student_id: int, db: Session = Depends(get_db)):
    student = db.query(models.Student).get(student_id)
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    embeddings = db.query(models.FaceEmbedding).filter(models.FaceEmbedding.student_id == student_id).all()
    registered_angles = [e.angle for e in embeddings]
    required = ["front", "left", "right", "up", "down", "smile", "normal"]
    missing = [a for a in required if a not in registered_angles]
    return {
        "status": student.face_status,
        "embeddings": len(embeddings),
        "registered_angles": registered_angles,
        "missing_angles": missing,
        "complete": len(missing) == 0,
    }


@router.delete("/{student_id}/{angle}")
def delete_face_angle(student_id: int, angle: str,
                      user: models.User = Depends(security.require_roles("admin")),
                      db: Session = Depends(get_db)):
    """Delete a single face embedding for a student."""
    # Backwards compatibility
    if angle == "neutral":
        angle = "normal"
    student = db.query(models.Student).get(student_id)
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    fe = db.query(models.FaceEmbedding).filter(
        models.FaceEmbedding.student_id == student_id,
        models.FaceEmbedding.angle == angle,
    ).first()
    if not fe:
        raise HTTPException(status_code=404, detail=f"No embedding found for angle '{angle}'")
    db.delete(fe)
    # Update status
    remaining = db.query(models.FaceEmbedding).filter(models.FaceEmbedding.student_id == student_id).count()
    if remaining == 0:
        student.face_status = "not_registered"
    else:
        student.face_status = "pending"
    db.commit()
    return {"message": f"Angle '{angle}' deleted", "remaining": remaining}


@router.post("/approve/{student_id}")
def approve_face(student_id: int,
                 user: models.User = Depends(security.require_roles("admin")),
                 db: Session = Depends(get_db)):
    student = db.query(models.Student).get(student_id)
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    count = db.query(models.FaceEmbedding).filter(models.FaceEmbedding.student_id == student_id).count()
    if count == 0:
        raise HTTPException(status_code=400, detail="No face embeddings to approve")
    student.face_status = "approved"
    student.face_registered_at = datetime.utcnow()
    db.commit()
    return {"message": "Face registration approved"}


@router.post("/reset/{student_id}")
def reset_face(student_id: int,
               user: models.User = Depends(security.require_roles("admin")),
               db: Session = Depends(get_db)):
    student = db.query(models.Student).get(student_id)
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    db.query(models.FaceEmbedding).filter(models.FaceEmbedding.student_id == student_id).delete()
    student.face_status = "not_registered"
    student.face_registered_at = None
    db.commit()
    return {"message": "Face data reset"}


@router.post("/match")
def match_face(req: schemas.FaceMatchRequest,
               user: models.User = Depends(security.get_current_user),
               db: Session = Depends(get_db)):
    """Match a face frame against registered students. Only marks attendance on a genuine match."""
    session = db.query(models.AttendanceSession).get(req.session_id)
    if not session or session.status != "active":
        raise HTTPException(status_code=400, detail="No active attendance session")

    # ---- 1. Validate frame is ready ----
    if not req.image_b64 or len(req.image_b64) < 100:
        raise HTTPException(status_code=400, detail="Camera frame is not ready. Please wait.")

    # ---- 2. Filter to only students from the selected Department / Class / Section ----
    known_ids = db.query(models.FaceEmbedding.student_id).join(models.Student).filter(
        models.Student.department_id == session.department_id,
        models.Student.class_id == session.class_id,
    )
    if session.section:
        known_ids = known_ids.filter(models.Student.section == session.section)
    known_ids = [row[0] for row in known_ids.all()]

    known = db.query(models.FaceEmbedding).filter(models.FaceEmbedding.student_id.in_(known_ids)).all()
    if not known:
        db.add(models.AuditLog(user_id=user.id, action="attendance_failure",
                               detail="No registered faces for selected class/section"))
        db.commit()
        return {"matched": False, "reason": "No registered faces for selected class/section", "confidence": 0.0}

    known_list = [{"student_id": k.student_id, "embedding": face_service.decrypt_embedding(k.embedding)} for k in known]

    # ---- 3. Liveness / anti-spoof ----
    liveness = face_service.liveness_check(req.image_b64)
    if not liveness["passed"]:
        db.add(models.AuditLog(user_id=user.id, action="spoof_attempt",
                               detail=f"Liveness failed: {liveness['reason']}"))
        db.commit()
        return {"matched": False, "reason": "Liveness Verification Failed", "confidence": 0.0, "liveness": liveness}

    # ---- 4. Image quality checks ----
    quality = face_service.check_image_quality(req.image_b64)
    if not quality["passed"]:
        db.add(models.AuditLog(user_id=user.id, action="attendance_failure",
                               detail=f"Quality check failed: {quality['reason']}"))
        db.commit()
        return {"matched": False, "reason": quality["reason"], "confidence": 0.0, "liveness": liveness}

    # ---- 5. Face detection — exactly one ----
    emb, n = face_service.extract_embedding(req.image_b64)
    if not emb:
        return {"matched": False, "reason": "No face detected.", "confidence": 0.0, "liveness": liveness}
    if n > 1:
        return {"matched": False, "reason": "Multiple faces detected. Please keep only the student in front of the camera.",
                "confidence": 0.0, "liveness": liveness}

    # ---- 6. Compare against known embeddings ----
    _, score, best = face_service.match_face(req.image_b64, known_list)
    if not best:
        snapshot = face_service.save_snapshot(req.image_b64, "unknowns")
        db.add(models.UnknownFaceLog(snapshot_path=snapshot, confidence=0.0, camera_id=req.camera_id))
        db.add(models.AuditLog(user_id=user.id, action="unknown_face", detail="No matching face found"))
        db.commit()
        return {"matched": False, "reason": "Unknown face", "confidence": 0.0, "liveness": liveness}

    # ---- 7. Apply configured threshold ----
    threshold = get_config_threshold(db)
    if score < threshold:
        snapshot = face_service.save_snapshot(req.image_b64, "unknowns")
        db.add(models.UnknownFaceLog(snapshot_path=snapshot, confidence=round(score, 3), camera_id=req.camera_id))
        db.add(models.AuditLog(user_id=user.id, action="attendance_failure",
                               detail=f"Low confidence {round(score, 3)} vs threshold {threshold}"))
        db.commit()
        return {"matched": False, "reason": "Face Not Recognized", "confidence": round(score, 3),
                "threshold": threshold, "liveness": liveness}

    # ---- 8. Load student and verify class/section ----
    student = db.query(models.Student).get(best["student_id"])
    if not student or student.face_status != "approved":
        return {"matched": False, "reason": "Student face not approved", "confidence": round(score, 3), "liveness": liveness}

    # Verify student belongs to the active attendance class/section
    if student.department_id != session.department_id or student.class_id != session.class_id:
        return {"matched": True, "wrong_class": True, "student": student.full_name,
                "student_id": student.student_id,
                "message": "Student belongs to another class/section.",
                "confidence": round(score, 3), "liveness": liveness}
    if session.section and student.section != session.section:
        return {"matched": True, "wrong_class": True, "student": student.full_name,
                "student_id": student.student_id,
                "message": "Student belongs to another class/section.",
                "confidence": round(score, 3), "liveness": liveness}

    # ---- 9. Duplicate check ----
    if attendance_service.is_duplicate(db, session.id, student.id):
        return {"matched": True, "duplicate": True, "student": student.full_name,
                "student_id": student.student_id, "full_name": student.full_name,
                "roll_number": student.roll_number,
                "message": "Attendance Already Marked",
                "confidence": round(score, 3), "threshold": threshold, "liveness": liveness}

    # ---- 10. Mark attendance ----
    record = attendance_service.mark_present(db, session, student, score, req.camera_id)

    # ---- 11. Send attendance email (only AFTER successful DB insert) ----
    now = datetime.now()
    dept = student.department.name if student.department else ""
    course = student.course.name if student.course else ""
    sem = student.semester.name if student.semester else ""
    cls = session.class_.name if session.class_ else ""
    teacher = session.teacher.full_name if session.teacher else ""
    overall_pct = attendance_service.compute_student_percentage(db, student.id)
    monthly_pct = attendance_service.monthly_percentage(db, student.id, now.month, now.year)

    attendance_email_sent = False
    attendance_email_error = ""
    recipients = {student.email} if student.email else set()

    for rcpt in recipients:
        ok, err = email_service.send_attendance_marked(
            db, rcpt, student.full_name, student.roll_number, dept, course,
            sem, cls, session.section, session.subject.name if session.subject else "",
            teacher, now.strftime("%Y-%m-%d"), now.strftime("%H:%M:%S"),
            score, overall_pct, monthly_pct, student_id=student.id, attendance_id=record.id,
        )
        attendance_email_sent = attendance_email_sent or ok
        if err:
            attendance_email_error = err
        # If email fails, log it as a delivery failure (attendance is NOT rolled back)
        if not ok:
            db.add(models.EmailDeliveryFailureLog(
                to_email=rcpt, subject="Attendance Marked Successfully – LifeOS Smart Campus",
                body_type="attendance_marked", error=err, attendance_record_id=record.id,
            ))

    # Low attendance warning (< 75%)
    if overall_pct < 75.0:
        for rcpt in recipients:
            ok, err = email_service.send_low_attendance(db, rcpt, student.full_name, overall_pct)
            if not ok:
                db.add(models.EmailDeliveryFailureLog(
                    to_email=rcpt, subject=f"Low Attendance Alert - {student.full_name}",
                    body_type="low_attendance", error=err, attendance_record_id=record.id,
                ))
        if student.user_id:
            db.add(models.Notification(user_id=student.user_id, title="Low Attendance Warning",
                                       message=f"Your attendance is {overall_pct:.1f}% (below 75%)",
                                       type="danger"))

    # Notification to student user
    if student.user_id:
        db.add(models.Notification(user_id=student.user_id, title="Attendance Marked",
                                   message=f"Present for {session.subject.name if session.subject else 'class'}",
                                   type="success"))
    # Audit log
    db.add(models.AuditLog(user_id=user.id, action="attendance_success",
                           detail=f"{student.full_name} marked present for {session.subject.name if session.subject else 'class'} ({cls})"))
    db.commit()

    return {
        "matched": True, "duplicate": False, "student": student.full_name,
        "student_id": student.student_id, "full_name": student.full_name,
        "roll_number": student.roll_number, "department": dept,
        "class": cls, "section": session.section, "teacher": teacher,
        "date": now.strftime("%Y-%m-%d"), "time": now.strftime("%H:%M:%S"),
        "confidence": round(score, 3), "threshold": threshold,
        "status": record.status, "overall_percentage": overall_pct,
        "monthly_percentage": monthly_pct, "liveness": liveness,
        "email_sent": attendance_email_sent,
        "email_error": attendance_email_error,
    }


@router.get("/config/threshold")
def get_threshold(user: models.User = Depends(security.require_roles("admin")),
                  db: Session = Depends(get_db)):
    value = get_config_threshold(db)
    return {"threshold": value, "engine": face_service.get_engine()}


@router.post("/config/threshold")
def set_threshold(req: schemas.SetThresholdRequest,
                  user: models.User = Depends(security.require_roles("admin")),
                  db: Session = Depends(get_db)):
    if req.threshold <= 0 or req.threshold >= 1:
        raise HTTPException(status_code=400, detail="Threshold must be between 0 and 1")
    row = db.query(models.SystemConfig).filter(models.SystemConfig.key == "face_match_threshold").first()
    if row:
        row.value = str(req.threshold)
        row.description = "Face match similarity threshold (0-1). Higher = stricter match."
    else:
        db.add(models.SystemConfig(key="face_match_threshold", value=str(req.threshold),
                                   description="Face match similarity threshold (0-1). Higher = stricter match."))
    db.commit()
    return {"threshold": req.threshold, "message": "Face match threshold updated"}


@router.get("/registrations/{student_id}/status")
def registration_status(student_id: int,
                        user: models.User = Depends(security.get_current_user),
                        db: Session = Depends(get_db)):
    """Get detailed registration status for a student."""
    return face_status(student_id, db)
