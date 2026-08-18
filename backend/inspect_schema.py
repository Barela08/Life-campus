import sqlite3

conn = sqlite3.connect('data/lifeos.db')
cols = [c[1] for c in conn.execute('PRAGMA table_info(subjects)').fetchall()]
print("SUBJECTS COLUMNS:", cols)

courses = conn.execute("SELECT id, name, department_id FROM courses").fetchall()
print("COURSES:", courses)

classes = conn.execute("SELECT id, name, course_id FROM classes").fetchall()
print("CLASSES:", classes)

subjects = conn.execute("SELECT id, name, department_id FROM subjects").fetchall()
print("SUBJECTS:", subjects)
