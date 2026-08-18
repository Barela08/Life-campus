import sqlite3
import os

backend_dir = os.path.dirname(__file__)
db_files = [
    os.path.join(backend_dir, "lifeos.db"),
    os.path.join(backend_dir, "data", "lifeos.db"),
]

for db_path in db_files:
    if os.path.exists(db_path):
        print(f"Migrating {db_path}...")
        conn = sqlite3.connect(db_path)
        cur = conn.cursor()
        
        # Check classes table
        try:
            cols = [row[1] for row in cur.execute("PRAGMA table_info(classes)").fetchall()]
            if "section" not in cols:
                cur.execute('ALTER TABLE classes ADD COLUMN section VARCHAR DEFAULT ""')
                conn.commit()
                print(f"  -> Added 'section' column to 'classes' table in {db_path}")
            else:
                print(f"  -> 'section' column already exists in 'classes' in {db_path}")
        except Exception as e:
            print(f"  -> Error checking classes table: {e}")
            
        conn.close()

print("Schema migration finished.")
