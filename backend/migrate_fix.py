"""Fix remaining migration: insert students, faces, attendance with corrected FK mappings."""
import os
import sys
from pathlib import Path

from dotenv import load_dotenv
load_dotenv(Path(__file__).resolve().parent / ".env")

from sqlalchemy import create_engine, text

SRC_DB = Path(__file__).resolve().parent / "data" / "lifeos.db"
SRC_URL = f"sqlite:///{SRC_DB}"
DST_URL = os.getenv("DATABASE_URL", "")
if not DST_URL:
    print("ERROR: DATABASE_URL not set")
    sys.exit(1)

src = create_engine(SRC_URL).connect()
dst = create_engine(DST_URL).connect()

# Map old semester_id -> new semester_id (Supabase has 1,3,4)
# SQLite had 1,2,3. Supabase has 1,3,4 (id=2 was skipped as duplicate)
# So: old 1 -> new 1, old 2 -> new 3, old 3 -> new 4
SEMESTER_MAP = {1: 1, 2: 3, 3: 4}

# Map old class_id -> new class_id (check if needed)
# First check what classes exist in Supabase
classes = dst.execute(text("SELECT id, name FROM classes")).fetchall()
print("Supabase classes:", classes)
class_map = {c[0]: c[0] for c in classes}  # assume same IDs for now

# Check courses
courses = dst.execute(text("SELECT id, name FROM courses")).fetchall()
print("Supabase courses:", courses)
course_map = {c[0]: c[0] for c in courses}

# Check departments
depts = dst.execute(text("SELECT id, name FROM departments")).fetchall()
print("Supabase departments:", depts)
dept_map = {d[0]: d[0] for d in depts}

# Check subjects
subjects = dst.execute(text("SELECT id, name FROM subjects")).fetchall()
print("Supabase subjects:", subjects)
subject_map = {s[0]: s[0] for s in subjects}

# Check teachers
teachers = dst.execute(text("SELECT id, teacher_id FROM teachers")).fetchall()
print("Supabase teachers:", teachers)
teacher_map = {t[0]: t[0] for t in teachers}

# Check users
users = dst.execute(text("SELECT id, username FROM users")).fetchall()
print("Supabase users:", users)
user_map = {u[0]: u[0] for u in users}

# ---- Migrate students ----
print("\n=== Migrating students ===")
student_rows = src.execute(text("SELECT * FROM students")).fetchall()
student_cols = [r[1] for r in src.execute(text("PRAGMA table_info(students)")).fetchall()]
existing_student_ids = set(r[0] for r in dst.execute(text("SELECT id FROM students")))

for row in student_rows:
    data = dict(zip(student_cols, row))
    if data["id"] in existing_student_ids:
        print(f"  SKIP student id={data['id']} (exists)")
        continue
    # Map FKs
    data["semester_id"] = SEMESTER_MAP.get(data.get("semester_id"), data.get("semester_id"))
    data["class_id"] = class_map.get(data.get("class_id"), data.get("class_id"))
    data["course_id"] = course_map.get(data.get("course_id"), data.get("course_id"))
    data["department_id"] = dept_map.get(data.get("department_id"), data.get("department_id"))
    data["user_id"] = user_map.get(data.get("user_id"), data.get("user_id"))
    # Boolean conversion
    for bc in ("is_active", "must_change_password", "is_read", "retried", "used", "notified"):
        if bc in data and data[bc] is not None:
            data[bc] = bool(data[bc])
    cols = [c for c in student_cols if c in [r[0] for r in dst.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name='students'"))]]
    col_list = ", ".join(f'"{c}"' for c in cols)
    placeholders = ", ".join(f":{c}" for c in cols)
    insert_data = {c: data.get(c) for c in cols}
    try:
        dst.execute(text(f'INSERT INTO "students" ({col_list}) VALUES ({placeholders})'), insert_data)
        print(f"  OK student id={data['id']} ({data['full_name']})")
    except Exception as e:
        print(f"  ERROR student id={data['id']}: {e}")
        dst.rollback()
dst.commit()

# ---- Migrate face_embeddings ----
print("\n=== Migrating face_embeddings ===")
fe_rows = src.execute(text("SELECT * FROM face_embeddings")).fetchall()
fe_cols = [r[1] for r in src.execute(text("PRAGMA table_info(face_embeddings)")).fetchall()]
existing_fe_ids = set(r[0] for r in dst.execute(text("SELECT id FROM face_embeddings")))

for row in fe_rows:
    data = dict(zip(fe_cols, row))
    if data["id"] in existing_fe_ids:
        print(f"  SKIP face_embedding id={data['id']} (exists)")
        continue
    cols = [c for c in fe_cols if c in [r[0] for r in dst.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name='face_embeddings'"))]]
    col_list = ", ".join(f'"{c}"' for c in cols)
    placeholders = ", ".join(f":{c}" for c in cols)
    insert_data = {c: data.get(c) for c in cols}
    try:
        dst.execute(text(f'INSERT INTO "face_embeddings" ({col_list}) VALUES ({placeholders})'), insert_data)
        print(f"  OK face_embedding id={data['id']}")
    except Exception as e:
        print(f"  ERROR face_embedding id={data['id']}: {e}")
        dst.rollback()
dst.commit()

# ---- Migrate attendance_records ----
print("\n=== Migrating attendance_records ===")
ar_rows = src.execute(text("SELECT * FROM attendance_records")).fetchall()
ar_cols = [r[1] for r in src.execute(text("PRAGMA table_info(attendance_records)")).fetchall()]
existing_ar_ids = set(r[0] for r in dst.execute(text("SELECT id FROM attendance_records")))

for row in ar_rows:
    data = dict(zip(ar_cols, row))
    if data["id"] in existing_ar_ids:
        print(f"  SKIP attendance_record id={data['id']} (exists)")
        continue
    cols = [c for c in ar_cols if c in [r[0] for r in dst.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name='attendance_records'"))]]
    col_list = ", ".join(f'"{c}"' for c in cols)
    placeholders = ", ".join(f":{c}" for c in cols)
    insert_data = {c: data.get(c) for c in cols}
    try:
        dst.execute(text(f'INSERT INTO "attendance_records" ({col_list}) VALUES ({placeholders})'), insert_data)
        print(f"  OK attendance_record id={data['id']}")
    except Exception as e:
        print(f"  ERROR attendance_record id={data['id']}: {e}")
        dst.rollback()
dst.commit()

src.close()
dst.close()
print("\nFix migration complete!")