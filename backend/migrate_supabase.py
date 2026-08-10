"""Migrate data from SQLite (lifeos.db) to Supabase PostgreSQL.

Run: python migrate_supabase.py
Reads existing SQLite data and inserts into the configured Supabase PostgreSQL database.
Skips rows that already exist (by primary key id).
"""
import os
import sys
from pathlib import Path

from dotenv import load_dotenv
load_dotenv(Path(__file__).resolve().parent / ".env")

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

# SQLite source
SRC_DB = Path(__file__).resolve().parent / "data" / "lifeos.db"
SRC_URL = f"sqlite:///{SRC_DB}"

# Supabase destination (from env)
DST_URL = os.getenv("DATABASE_URL", "")

if not DST_URL:
    print("ERROR: DATABASE_URL not set in backend/.env")
    sys.exit(1)

src_engine = create_engine(SRC_URL)
dst_engine = create_engine(DST_URL)

TABLES = [
    "users",
    "departments",
    "courses",
    "semesters",
    "classes",
    "subjects",
    "students",
    "teachers",
    "face_embeddings",
    "attendance_sessions",
    "attendance_records",
    "unknown_face_logs",
    "audit_logs",
    "notifications",
    "email_logs",
    "email_delivery_failure_logs",
    "system_config",
    "leave_requests",
    "password_reset_tokens",
]


def migrate():
    src = src_engine.connect()
    dst = dst_engine.connect()

    # Ensure destination tables exist
    from app.database import Base
    from app import models  # noqa: F401  (imports all models)
    Base.metadata.create_all(bind=dst_engine)

    for table in TABLES:
        # Check if source table exists
        has_src = src.execute(text(
            "SELECT name FROM sqlite_master WHERE type='table' AND name=:t"
        ), {"t": table}).fetchone()
        if not has_src:
            print(f"SKIP {table}: not in source")
            continue

        cols = [row[1] for row in src.execute(text(f"PRAGMA table_info({table})")).fetchall()]
        if not cols:
            print(f"SKIP {table}: no columns")
            continue

        rows = src.execute(text(f"SELECT * FROM {table}")).fetchall()
        if not rows:
            print(f"SKIP {table}: empty")
            continue

        # Check destination columns
        dst_cols = [row[0] for row in dst.execute(text(
            "SELECT column_name FROM information_schema.columns WHERE table_name=:t"
        ), {"t": table}).fetchall()]
        if not dst_cols:
            print(f"SKIP {table}: destination table not found")
            continue

        common_cols = [c for c in cols if c in dst_cols]
        if not common_cols:
            print(f"SKIP {table}: no common columns")
            continue

        col_list = ", ".join(f'"{c}"' for c in common_cols)
        placeholders = ", ".join(f":{c}" for c in common_cols)

        # Boolean columns
        bool_cols = [c for c in common_cols if c in ("is_active", "must_change_password", "is_read", "retried", "used", "notified")]

        # Existing IDs in destination
        if "id" in common_cols:
            existing_ids = set(r[0] for r in dst.execute(text(f'SELECT id FROM "{table}"')).fetchall())
        else:
            existing_ids = set()

        inserted = 0
        skipped = 0
        for row in rows:
            data = dict(zip(cols, row))
            insert_data = {c: data.get(c) for c in common_cols}

            # Skip if row already exists
            if "id" in insert_data and insert_data["id"] in existing_ids:
                skipped += 1
                continue

            # Convert 0/1 to boolean for PostgreSQL
            for bc in bool_cols:
                if bc in insert_data and insert_data[bc] is not None:
                    insert_data[bc] = bool(insert_data[bc])

            try:
                dst.execute(text(f'INSERT INTO "{table}" ({col_list}) VALUES ({placeholders})'), insert_data)
                inserted += 1
            except Exception as e:
                print(f"  ERROR inserting into {table} (id={insert_data.get('id')}): {e}")
                dst.rollback()

        dst.commit()
        print(f"OK {table}: {inserted} inserted, {skipped} skipped")

    src.close()
    dst.close()
    print("\nMigration complete!")


if __name__ == "__main__":
    migrate()