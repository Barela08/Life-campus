import sqlite3
import os

db_path = os.path.join(os.path.dirname(__file__), "..", "lifeos.db")
if os.path.exists(db_path):
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    cols = [c[1] for c in cursor.execute("PRAGMA table_info(classes)").fetchall()]
    if "section" not in cols:
        cursor.execute("ALTER TABLE classes ADD COLUMN section VARCHAR DEFAULT ''")
        conn.commit()
        print("[DB Migration] Added 'section' column to 'classes' table.")
    conn.close()
