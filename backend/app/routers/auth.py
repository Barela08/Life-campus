import secrets
import logging
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from ..database import get_db
from .. import models, schemas, security
from ..email_service import send_password_changed, send_email

router = APIRouter(prefix="/api/auth", tags=["auth"])
logger = logging.getLogger("lifeos.auth.otp")


@router.post("/login", response_model=schemas.TokenResponse)
def login(req: schemas.LoginRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.username == req.username).first()
    if not user or not security.verify_password(req.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid username or password")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account disabled")
    user.last_login = datetime.utcnow()
    db.commit()
    access = security.create_access_token(user.username, user.role)
    refresh = security.create_refresh_token(user.username, user.role)
    return schemas.TokenResponse(
        access_token=access, refresh_token=refresh, role=user.role,
        user_id=user.id, full_name=user.full_name,
        must_change_password=user.must_change_password,
    )


@router.post("/refresh")
def refresh(request: Request, db: Session = Depends(get_db)):
    body = request.headers.get("authorization", "")
    token = body.replace("Bearer ", "") if body else ""
    payload = security.decode_token(token)
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Invalid refresh token")
    user = db.query(models.User).filter(models.User.username == payload.get("sub")).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return {"access_token": security.create_access_token(user.username, user.role)}


@router.post("/change-password")
def change_password(req: schemas.ChangePasswordRequest,
                    user: models.User = Depends(security.get_current_user),
                    db: Session = Depends(get_db)):
    if not security.verify_password(req.old_password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Old password is incorrect")
    user.hashed_password = security.hash_password(req.new_password)
    user.must_change_password = False
    db.commit()
    send_password_changed(db, user.email, user.full_name)
    return {"message": "Password changed successfully"}


@router.post("/forgot-password")
def forgot_password(req: schemas.ForgotPasswordRequest, db: Session = Depends(get_db)):
    logger.info("[OTP] request received")
    try:
        logger.info("[OTP] user lookup")
        user = db.query(models.User).filter(models.User.email == str(req.email).strip().lower()).first()
        if not user:
            return {"message": "If the email exists, an OTP has been sent"}
        recent = db.query(models.PasswordResetToken).filter(models.PasswordResetToken.user_id == user.id, models.PasswordResetToken.created_at > datetime.utcnow() - timedelta(seconds=30)).first()
        if recent: raise HTTPException(status_code=429, detail="Please wait before requesting another OTP")
        logger.info("[OTP] generated")
        otp = f"{secrets.randbelow(1000000):06d}"
        db.query(models.PasswordResetToken).filter(models.PasswordResetToken.user_id == user.id, models.PasswordResetToken.used == False).update({"used": True})
        # A reset token exists before verification to satisfy the database's unique
        # constraint, but is never returned until its OTP has been verified.
        db.add(models.PasswordResetToken(user_id=user.id, token=secrets.token_urlsafe(32), otp_hash=security.hash_password(otp), expires_at=datetime.utcnow() + timedelta(minutes=5)))
        db.commit(); logger.info("[OTP] record saved")
        logger.info("[OTP] email sending started")
        ok, error = send_email(user.email, "LifeOS Smart Campus - Password Reset OTP", f"<p>Hello {user.full_name},</p><p>We received a request to reset your password.</p><p>Your OTP is <b>{otp}</b>.</p><p>This OTP expires in 5 minutes. If you did not request this, ignore this email.</p><p>Regards,<br>LifeOS Smart Campus</p>")
        if not ok:
            db.query(models.PasswordResetToken).filter(models.PasswordResetToken.user_id == user.id, models.PasswordResetToken.used == False).update({"used": True})
            db.commit()
            logger.error("[OTP] email delivery failed: %s", error)
            raise HTTPException(status_code=503, detail="Unable to send OTP email. Please try again later.")
        logger.info("[OTP] email sent successfully")
        return {"message": "If the email exists, an OTP has been sent"}
    except HTTPException:
        raise
    except Exception:
        db.rollback()
        logger.exception("[OTP] request failed")
        raise HTTPException(status_code=500, detail="Unable to process the password reset request.")

@router.post("/verify-reset-otp")
def verify_reset_otp(req: schemas.VerifyResetOtpRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == req.email).first()
    row = db.query(models.PasswordResetToken).filter(models.PasswordResetToken.user_id == (user.id if user else -1), models.PasswordResetToken.used == False).order_by(models.PasswordResetToken.created_at.desc()).first()
    if not row or row.expires_at < datetime.utcnow(): raise HTTPException(status_code=400, detail="OTP expired. Please request a new OTP.")
    if row.attempt_count >= 5: row.used = True; db.commit(); raise HTTPException(status_code=429, detail="Too many attempts. Please request a new OTP.")
    if not security.verify_password(req.otp, row.otp_hash): row.attempt_count += 1; db.commit(); raise HTTPException(status_code=400, detail="Invalid OTP")
    row.verified_at = datetime.utcnow(); db.commit()
    return {"reset_token": row.token, "message": "OTP verified successfully"}


@router.post("/reset-password")
def reset_password(req: schemas.OtpResetPasswordRequest, db: Session = Depends(get_db)):
    if req.new_password != req.confirm_password:
        raise HTTPException(status_code=422, detail="Passwords do not match")
    prt = db.query(models.PasswordResetToken).filter(
        models.PasswordResetToken.token == req.reset_token,
        models.PasswordResetToken.used == False,
        models.PasswordResetToken.verified_at != None,
    ).first()
    if not prt or prt.expires_at < datetime.utcnow():
        raise HTTPException(status_code=400, detail="Invalid or expired token")
    user = db.query(models.User).filter(models.User.id == prt.user_id).first()
    user.hashed_password = security.hash_password(req.new_password)
    user.must_change_password = False
    prt.used = True
    db.commit()
    send_password_changed(db, user.email, user.full_name)
    return {"message": "Password reset successfully"}


@router.get("/me")
def me(user: models.User = Depends(security.get_current_user)):
    # Prefer student/teacher full_name if available (they can be updated independently)
    full_name = user.full_name
    phone = user.phone or ""
    department_id = None
    if user.role == "student" and user.student:
        full_name = user.student.full_name or full_name
        phone = user.student.phone or phone
    if user.role == "teacher" and user.teacher:
        full_name = user.teacher.full_name or full_name
        phone = user.teacher.phone or phone
        department_id = user.teacher.department_id
    
    data = {"id": user.id, "username": user.username, "email": user.email,
            "full_name": full_name, "role": user.role, "phone": phone}
    if user.role == "student" and user.student:
        data["student_id"] = user.student.student_id
    if user.role == "teacher" and user.teacher:
        data["teacher_id"] = user.teacher.teacher_id
        data["department_id"] = department_id
    return data


@router.patch("/me")
def update_me(req: schemas.ProfileUpdateRequest,
              user: models.User = Depends(security.get_current_user),
              db: Session = Depends(get_db)):
    """Submit a sensitive profile change for the appropriate reviewer."""
    if user.role == "admin":
        changes = req.dict(exclude_none=True, include={"full_name", "email", "phone"})
        if not changes:
            raise HTTPException(status_code=400, detail="No profile changes were provided")
        if "email" in changes:
            email = str(changes["email"]).strip().lower()
            if db.query(models.User).filter(models.User.email == email, models.User.id != user.id).first():
                raise HTTPException(status_code=409, detail="Email is already registered.")
            changes["email"] = email
            user.username = email if user.username == user.email else user.username
        if "full_name" in changes:
            user.full_name = str(changes["full_name"]).strip()
        if "phone" in changes:
            user.phone = str(changes["phone"]).strip()
        if "email" in changes:
            user.email = changes["email"]
        db.add(models.AuditLog(user_id=user.id, action="admin_profile_updated", detail="self"))
        db.commit()
        return {"id": user.id, "username": user.username, "email": user.email, "full_name": user.full_name, "role": user.role, "phone": user.phone or ""}

    if user.role not in {"student", "teacher", "staff"}:
        raise HTTPException(status_code=403, detail="Profile changes for this role are not supported here")
    changes = req.dict(exclude_none=True)
    reason = changes.pop("reason", "")
    if not changes:
        raise HTTPException(status_code=400, detail="No profile changes were provided")
    from .approvals import create_profile_request
    return create_profile_request(schemas.ApprovalRequestCreate(requested_changes=changes, reason=reason), user, db)
    """Legacy direct-update implementation intentionally removed: changes require approval."""
    '''
    if req.full_name is not None:
        user.full_name = req.full_name
        # Keep teacher/student full_name in sync
        if user.teacher:
            user.teacher.full_name = req.full_name
        if user.student:
            user.student.full_name = req.full_name
    if req.email is not None:
        # Prevent duplicate email
        other = db.query(models.User).filter(models.User.email == req.email, models.User.id != user.id).first()
        if other:
            raise HTTPException(status_code=400, detail="Email already in use")
        user.email = str(req.email)
        if user.teacher:
            user.teacher.email = str(req.email)
        if user.student:
            user.student.email = str(req.email)
    # Phone is stored on teacher/student profile
    if req.phone is not None:
        user.phone = req.phone
        if user.teacher:
            user.teacher.phone = req.phone
        if user.student:
            user.student.phone = req.phone
    db.commit()
    db.refresh(user)
    return {"message": "Profile updated successfully", "full_name": user.full_name, "email": user.email, "phone": user.phone or ""}
    '''


@router.get("/branding")
def get_public_branding(db: Session = Depends(get_db)):
    """Public endpoint to retrieve application name, logo, and maintenance mode status."""
    from ..config import settings
    configs = db.query(models.SystemConfig).filter(
        models.SystemConfig.key.in_(["system_name", "system_logo", "maintenance_mode",
                                     "face_match_threshold"])
    ).all()
    cfg = {c.key: c.value for c in configs}
    res = {
        "system_name": cfg.get("system_name") or settings.APP_NAME,
        "system_logo": cfg.get("system_logo") or "",
        "maintenance_mode": cfg.get("maintenance_mode") or "false",
        "face_match_threshold": cfg.get("face_match_threshold") or str(settings.FACE_MATCH_THRESHOLD),
    }
    return res


