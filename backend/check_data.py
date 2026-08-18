from app.database import SessionLocal
from app import models

db = SessionLocal()
print("--- DEPARTMENTS ---")
for d in db.query(models.Department).all():
    print(f"ID: {d.id}, Name: {d.name}, Code: {d.code}")

print("\n--- COURSES ---")
for c in db.query(models.Course).all():
    print(f"ID: {c.id}, Name: {c.name}, Code: {c.code}, DeptID: {c.department_id}")

print("\n--- CLASSES ---")
for cl in db.query(models.Class).all():
    print(f"ID: {cl.id}, Name: {cl.name}, Code: {cl.code}, Section: '{cl.section}', CourseID: {cl.course_id}")

print("\n--- SUBJECTS ---")
for s in db.query(models.Subject).all():
    print(f"ID: {s.id}, Name: {s.name}, Code: {s.code}, DeptID: {s.department_id}")

print("\n--- SEMESTERS ---")
for se in db.query(models.Semester).all():
    print(f"ID: {se.id}, Name: {se.name}, Code: {se.code}")
