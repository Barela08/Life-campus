"""Reset PostgreSQL sequences to match max existing IDs after data migration.

When data is migrated with explicit IDs, PostgreSQL sequences are not advanced,
causing "duplicate key value violates unique constraint" on new inserts.
Run: python fix_sequences.py
"""
import os
import sys
from pathlib import Path

from dotenv import load_dotenv
load_dotenv(Path(__file__).resolve().parent / ".env")

from sqlalchemy import create_engine, text

DST_URL = os.getenv("DATABASE_URL", "")
if not DST_URL:
    print("ERROR: DATABASE_URL not set")
    sys.exit(1)

engine = create_engine(DST_URL, pool_pre_ping=True)
conn = engine.connect()

# Get all tables with an 'id' column
tables = conn.execute(text("""
    SELECT table_name FROM information_schema.columns
    WHERE column_name = 'id' AND table_schema = 'public'
    ORDER BY table_name
""")).fetchall()

for (table,) in tables:
    try:
        # Get max id
        max_id = conn.execute(text(f'SELECT COALESCE(MAX(id), 0) FROM "{table}"')).scalar()
        # Reset the sequence to max_id + 1
        conn.execute(text(f'SELECT setval(pg_get_serial_sequence(\'{table}\', \'id\'), {max_id + 1}, false)'))
        print(f"OK {table}: sequence set to {max_id + 1}")
    except Exception as e:
        print(f"SKIP {table}: {e}")

conn.commit()
conn.close()
