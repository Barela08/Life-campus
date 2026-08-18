from app.database import SessionLocal
from app import models, schemas
from app.routers.admin import create_class

db = SessionLocal()
try:
    course = db.query(models.Course).first()
    if not course:
        dept = db.query(models.Department).first()
        if not dept:
            dept = models.Department(name="CS Dept", code="CS")
            db.add(dept); db.commit(); db.refresh(dept)
        course = models.Course(name="B.Tech CS", code="BT-CS", department_id=dept.id)
        db.add(course); db.commit(); db.refresh(course)
    
    req = schemas.ClassCreate(name="B.Tech IT Test", course_id=course.id, section="Section A")
    res = create_class(req, db, models.User(role="admin"))
    print("SUCCESS: Class created with ID", res.id, "Name:", res.name, "Code:", res.code, "Section:", res.section)
except Exception as e:
    import traceback
    traceback.print_exc()
