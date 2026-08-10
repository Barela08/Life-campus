"""Migrate remaining dependent tables (students, attendance, faces) to Supabase.

Run AFTER migrate_supabase.py once base tables (users/teachers/depts/courses/classes/subjects) exist.
"""
import os
import sys
from pathlib import Path

from dotenv import load_dotenv
load_dotenv(Path(__file__).resolve().parent / ".env")

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

SRC_DB = Path(__file__).resolve().parent / "data" / "lifeos.db"
SRC_URL = f"sqlite:///{SRC_DB}"
DST_URL = os.getenv("DATABASE_URL", "")
if not DST_URL:
    print("ERROR: DATABASE_URL not set")
    sys.exit(1)

src_engine = create_engine(SRC_URL)
dst_engine = create_engine(DST_URL)

TABLES = [
    "students",
    "face_embeddings",
    "attendance_sessions",
    "attendance_records",
    "unknown_face_logs",
    "notifications",
    "email_logs",
    "email_delivery_failure_logs",
]

# Boolean columns that need 0/1 -> true/false
BOOL_COLS = {"is_active", "must_change_password", "is_read", "retried", "used", "notified"}


def migrate():
    src = src_engine.connect()
    dst = dst_engine.connect()

    for table in TABLES:
        has_src = src.execute(text("SELECT name FROM sqlite_master WHERE type='table' AND name=:t"), {"t": table}).fetchone()
        if not has_src:
            print(f"SKIP {table}: not in source")
            continue

        cols = [row[1] for row in src.execute(text(f"PRAGMA table_info({table})")).fetchall()]
        rows = src.execute(text(f"SELECT * FROM {table}")).fetchall()
        if not rows:
            print(f"SKIP {table}: empty source")
            continue

        # Destination columns
        dst_cols = [row[0] for row in dst.execute(text(
            "SELECT column_name FROM information_schema.columns WHERE table_name=:t"), {"t": table}).fetchall()]
        if not dst_cols:
            print(f"SKIP {table}: destination table not found")
            continue

        common = [c for c in cols if c in dst_cols]
        col_list = ", ".join(f'"{c}"' for c in common)
        placeholders = ", ".join(f":{c}" for c in common)

        # Existing IDs in destination
        existing_ids = set()
        if "id" in common:
            existing_ids = set(r[0] for r in dst.execute(text(f'SELECT id FROM "{table}"')))

        inserted = 0
        for row in rows:
            data = dict(zip(cols, row))
            insert_data = {c: data.get(c) for c in common}
            if "id" in insert_data and insert_data["id"] in existing_ids:
                continue
            for bc in BOOL_COLS:
                if bc in insert_data and insert_data[bc] is not None:
                    insert_data[bc] = bool(insert_data[bc])
            try:
                dst.execute(text(f'INSERT INTO "{table}" ({col_list}) VALUES ({placeholders})'), insert_data)
                inserted += 1
            except Exception as e:
                print(f"  ERROR {table} id={insert_data.get('id')}: {e}")
                dst.rollback()
        dst.commit()
        print(f"OK {table}: {inserted} inserted")

    src.close()
    dst.close()
    print("\nRemaining migration complete!")


if __name__ == "__main__":
    migrate()