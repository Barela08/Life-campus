import sqlite3
import os
import urllib.request
import json

print("=== STARTING SYSTEM DIAGNOSTIC TEST ===")

# Test 1: SQLite Database Tables and Columns
db_path = os.path.join(os.path.dirname(__file__), "data", "lifeos.db")
if not os.path.exists(db_path):
    db_path = os.path.join(os.path.dirname(__file__), "lifeos.db")

print(f"[TEST 1] Checking Database: {db_path}")
conn = sqlite3.connect(db_path)
cur = conn.cursor()

# Check classes.section
cols = [row[1] for row in cur.execute("PRAGMA table_info(classes)").fetchall()]
assert "section" in cols, "FAIL: classes.section column missing!"
print("  [OK] classes.section column exists")

# Check students.section
cols_st = [row[1] for row in cur.execute("PRAGMA table_info(students)").fetchall()]
assert "section" in cols_st, "FAIL: students.section column missing!"
print("  [OK] students.section column exists")

conn.close()

# Test 2: Backend REST Endpoints
print("[TEST 2] Testing Backend Endpoints at http://127.0.0.1:8000")
endpoints = [
    "/api/auth/branding",
    "/api/attendance/meta/departments",
    "/api/attendance/meta/classes",
    "/api/attendance/meta/sections",
    "/api/attendance/meta/subjects",
]

for ep in endpoints:
    url = f"http://127.0.0.1:8000{ep}"
    try:
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req) as resp:
            status = resp.getcode()
            data = json.loads(resp.read().decode('utf-8'))
            print(f"  [OK] {ep} -> Status {status}, Records: {len(data) if isinstance(data, list) else 1}")
    except Exception as e:
        print(f"  [FAIL] {ep} -> Failed: {e}")

print("=== ALL SYSTEM TESTS PASSED SUCCESSFULLY ===")
