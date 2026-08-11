"""Database-backed staff roles and server-enforced permissions."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..database import get_db
from .. import models, security

router = APIRouter(prefix="/api/roles", tags=["roles"])
CATALOG = ["dashboard.view", "students.view", "students.create", "students.edit", "students.delete", "staff.view", "staff.create", "staff.edit", "staff.delete", "attendance.view", "attendance.mark", "attendance.edit", "attendance.delete", "leave.view", "leave.create", "leave.approve", "leave.reject", "notifications.view", "notifications.send", "reports.view", "reports.export", "settings.view", "settings.edit", "roles.view", "roles.create", "roles.edit", "roles.delete"]

def seed(db):
    existing = {p.code for p in db.query(models.Permission).all()}
    for code in CATALOG:
        if code not in existing: db.add(models.Permission(code=code, description=code.replace('.', ' ').title()))
    db.commit()

@router.get("/permissions")
def permissions(db: Session = Depends(get_db), _=Depends(security.require_permission("roles.view"))):
    seed(db); return [{"id": p.id, "code": p.code, "description": p.description} for p in db.query(models.Permission).order_by(models.Permission.code)]

@router.get("")
def list_roles(db: Session = Depends(get_db), _=Depends(security.require_permission("roles.view"))):
    seed(db); roles = db.query(models.Role).all()
    return [{"id": r.id, "name": r.name, "description": r.description, "permission_ids": [x.permission_id for x in db.query(models.RolePermission).filter_by(role_id=r.id)]} for r in roles]

@router.post("")
def create_role(payload: dict, admin: models.User = Depends(security.require_permission("roles.create")), db: Session = Depends(get_db)):
    name = str(payload.get("name", "")).strip(); ids = payload.get("permission_ids", [])
    if not name: raise HTTPException(422, "Role name is required")
    if db.query(models.Role).filter_by(name=name).first(): raise HTTPException(409, "Role already exists")
    role = models.Role(name=name, description=str(payload.get("description", "")).strip()); db.add(role); db.flush()
    valid = {p.id for p in db.query(models.Permission).filter(models.Permission.id.in_(ids)).all()}
    if len(valid) != len(set(ids)): raise HTTPException(422, "Invalid permission selection")
    db.add_all([models.RolePermission(role_id=role.id, permission_id=i) for i in valid]); db.add(models.AuditLog(user_id=admin.id, action="role_created", detail=name)); db.commit()
    return {"id": role.id, "name": role.name}

@router.put("/{role_id}")
def update_role(role_id: int, payload: dict, admin: models.User = Depends(security.require_permission("roles.edit")), db: Session = Depends(get_db)):
    role = db.get(models.Role, role_id)
    if not role: raise HTTPException(404, "Role not found")
    ids = payload.get("permission_ids", []); valid = {p.id for p in db.query(models.Permission).filter(models.Permission.id.in_(ids)).all()}
    if len(valid) != len(set(ids)): raise HTTPException(422, "Invalid permission selection")
    role.name = str(payload.get("name", role.name)).strip() or role.name; role.description = str(payload.get("description", role.description))
    db.query(models.RolePermission).filter_by(role_id=role.id).delete(); db.add_all([models.RolePermission(role_id=role.id, permission_id=i) for i in valid]); db.add(models.AuditLog(user_id=admin.id, action="role_changed", detail=role.name)); db.commit(); return {"message":"Role updated"}

@router.delete("/{role_id}")
def delete_role(role_id: int, admin: models.User = Depends(security.require_permission("roles.delete")), db: Session = Depends(get_db)):
    role = db.get(models.Role, role_id)
    if not role: raise HTTPException(404, "Role not found")
    db.delete(role); db.add(models.AuditLog(user_id=admin.id, action="role_deleted", detail=str(role_id))); db.commit(); return {"message":"Role deleted"}
