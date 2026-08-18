import sqlite3

conn = sqlite3.connect('data/lifeos.db')
cursor = conn.cursor()

# Check if course_id column exists
cols = [c[1] for c in cursor.execute("PRAGMA table_info(subjects)").fetchall()]
if "course_id" not in cols:
    cursor.execute("ALTER TABLE subjects ADD COLUMN course_id INTEGER REFERENCES courses(id)")
    print("[OK] Added course_id column to subjects table")

# Link existing subjects to Course 1 (B.Tech CSE) if null
cursor.execute("UPDATE subjects SET course_id = 1 WHERE course_id IS NULL")
conn.commit()

subjects = cursor.execute("SELECT id, name, code, department_id, course_id FROM subjects").fetchall()
print("[OK] Updated Subjects:", subjects)
conn.close()
