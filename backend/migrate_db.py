"""One-time DB migration: add missing columns to existing tables."""
import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "data", "lifeos.db")

conn = sqlite3.connect(DB_PATH)
cur = conn.cursor()

# Check and add missing columns to students
cols = [row[1] for row in cur.execute("PRAGMA table_info(students)").fetchall()]
if "section" not in cols:
    cur.execute('ALTER TABLE students ADD COLUMN section VARCHAR DEFAULT ""')
    print("Added students.section column")
else:
    print("students.section already exists")

# Check and add missing columns to attendance_sessions
cols = [row[1] for row in cur.execute("PRAGMA table_info(attendance_sessions)").fetchall()]
if "department_id" not in cols:
    cur.execute("ALTER TABLE attendance_sessions ADD COLUMN department_id INTEGER")
    print("Added attendance_sessions.department_id column")
else:
    print("attendance_sessions.department_id already exists")

if "section" not in cols:
    cur.execute('ALTER TABLE attendance_sessions ADD COLUMN section VARCHAR DEFAULT ""')
    print("Added attendance_sessions.section column")
else:
    print("attendance_sessions.section already exists")

conn.commit()
conn.close()
print("Migration complete")