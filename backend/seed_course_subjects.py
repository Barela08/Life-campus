import sqlite3

conn = sqlite3.connect('data/lifeos.db')
cursor = conn.cursor()

# Clear duplicate test subjects or fallback subjects if needed
new_subjects = [
    # (id, name, code, department_id, course_id)
    (1, 'Data Structures', 'DS-101', 1, 1),
    (2, 'Object Oriented Programming', 'OOP-102', 1, 1),
    (3, 'Analog Electronics', 'AE-201', 2, 4),
    (4, 'Microprocessors & Signals', 'MPS-202', 2, 4),
    (5, 'Web Technologies & Cloud', 'WTC-301', 1, 5),
    (6, 'Database Management Systems', 'DBMS-302', 1, 5),
]

for s in new_subjects:
    cursor.execute("""
        INSERT OR REPLACE INTO subjects (id, name, code, department_id, course_id, created_at)
        VALUES (?, ?, ?, ?, ?, DATETIME('now'))
    """, s)

conn.commit()

subs = cursor.execute("SELECT id, name, code, department_id, course_id FROM subjects").fetchall()
print("[OK] SEEDED EXACT COURSE SUBJECTS:")
for row in subs:
    print(" ", row)

conn.close()
