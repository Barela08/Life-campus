# LifeOS Smart Campus — Project Documentation

## Project Purpose

LifeOS Smart Campus is an AI-powered Face Recognition Attendance System. It uses face recognition to automatically mark student attendance when a registered student's face is detected by a camera in the attendance terminal. It includes separate portals for Admin, Teacher, and Student, connected to a shared backend and database.

**Key Features:**
- Automated face-recognition attendance
- Multi-angle face registration (Front, Left, Right, Up, Down, Smile, Normal)
- Real-time dashboards for Admin, Teacher, and Student
- Instant email notifications on attendance
- Student report downloads (PDF / Excel / CSV)
- Supabase PostgreSQL persistent storage

---

## Architecture

```
Frontend (React + Vite)
        │  axios /api proxy (via vite.config)
        ▼
Backend (FastAPI + SQLAlchemy)
        │
        ├── Auth (JWT + RBAC: admin/teacher/student)
        ├── Attendance API
        ├── Face Registration + Recognition
        ├── Email (SMTP)
        └── Export (PDF/Excel/CSV)
        │
        ▼
Supabase PostgreSQL (persistent DB)
```

## Frontend

- **Framework:** React 18 + TypeScript + Vite
- **UI:** Tailwind CSS, lucide-react icons, recharts
- **Port:** http://localhost:5173

### Key Pages
| Route | Page |
|-------|------|
| `/` | Attendance Terminal |
| `/login` | Login |
| `/admin` | Admin Dashboard |
| `/admin/settings` | Admin Profile + Settings |
| `/teacher` | Teacher Dashboard |
| `/teacher/profile` | Teacher Profile |
| `/student` | Student Dashboard |
| `/student/download` | Download Reports |

## Backend

- **Framework:** FastAPI + SQLAlchemy ORM
- **Port:** http://localhost:8000
- **Face Engine:** `face_recognition` (dlib) with graceful fallback chain

### Key Routers
| Router | Prefix | Purpose |
|--------|--------|---------|
| auth | `/api/auth` | Login, profile, password |
| admin | `/api/admin` | Student/Teacher/Dept/Course management |
| face | `/api/face` | Face registration + matching |
| attendance | `/api/attendance` | Session start/stop, records |
| teacher | `/api/teacher` | Teacher dashboard/sessions |
| student | `/api/student` | Student dashboard/attendance |
| export | `/api/export` | Report downloads (PDF/Excel/CSV) |

## Database (Supabase PostgreSQL)

Tables: `users`, `departments`, `courses`, `semesters`, `classes`, `subjects`, `students`, `teachers`, `face_embeddings`, `attendance_sessions`, `attendance_records`, `unknown_face_logs`, `audit_logs`, `notifications`, `email_logs`, `email_delivery_failure_logs`, `system_config`, `leave_requests`, `password_reset_tokens`.

### Key Relationships
- Student → Department → Course → Semester → Class
- AttendanceRecord → Student / Session / Teacher / Class
- FaceEmbedding → Student (multiple per student per angle)

## Supabase Integration

- Connected via `DATABASE_URL` in `backend/.env`
- `pool_pre_ping=True` ensures auto-reconnect for idle Supabase connections
- Password with `@` must be URL-encoded (e.g. `BarelaNilu%402006`)
- **Sequences must be reset after data migration** — use `python fix_sequences.py`

## Authentication

- JWT (access + refresh) via `python-jose`
- Password hashing: Argon2/bcrypt via passlib
- Roles: `admin`, `teacher`, `student`
- Teacher required to start attendance sessions

## Attendance Flow

1. Teacher logs in
2. Selects Department → Class → Section
3. Clicks Start Attendance → creates session
4. Camera opens (getUserMedia)
5. Face frame captured every ~1.2s
6. Backend `/api/face/match` validates + recognizes
7. Matched student → attendance saved → email sent → dashboards update
8. Unknown/wrong-class/duplicate handled with overlays

## Face Registration

- Admin → Students → Face Registration (or Admin Face page)
- 7 angles required: Front, Left, Right, Up, Down, Smile, Normal
- Each angle stored as encrypted embedding (`face_embeddings`)
- Backend validates: exactly one face, quality, lighting, distance

## Camera

- Shared `cameraService` (`frontend/src/lib/camera.ts`)
- `isLive()` requires: stream active + video attached + readyState≥2 + videoWidth/Height>0 + not paused (FPS NOT required — was the root cause of stuck "Starting live preview")
- Handles permission denied, busy, not found, unsupported, errors
- Provides Refresh / Switch camera

## Email System

- SMTP via `backend/.env`
- After attendance successfully saved → immediate email to `student.email`
- Email failure does NOT roll back attendance
- Email logs stored in `email_logs` / `email_delivery_failure_logs`

## SMTP Configuration

```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=
SMTP_PASSWORD=
SMTP_FROM_EMAIL=
SMTP_FROM_NAME=LifeOS Smart Campus
SMTP_USE_TLS=true
EMAIL_ENABLED=true
```

## Environment Variables

### backend/.env
```
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/postgres
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SMTP_* (see above)
SECRET_KEY=
EMBEDDING_ENCRYPT_KEY=
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
```

## How to Install

### Backend
```bash
cd backend
pip install -r requirements.txt
python fix_sequences.py   # after migration
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

## How to Test
1. Open http://localhost:5173
2. Admin login (admin / 1234)
3. Add students/teachers via Admin
4. Register face via Students → Face Registration
5. Teacher login (teacher_id / 1234)
6. Start Attendance → camera → show registered face
7. Verify attendance saved + email sent + dashboards update

## Troubleshooting

### "Failed to start" on Attendance
Caused by PostgreSQL sequences not advanced after data migration.
**Fix:** `cd backend && python fix_sequences.py`

### "server closed the connection unexpectedly"
Supabase idle timeout. **Fix:** `pool_pre_ping=True` is set in `database.py`.

### Camera stuck "Starting live preview…"
Old `isLive()` required FPS>0. **Fix:** now based on real video state (videoWidth/Height, readyState, not paused).

### SMTP not sending
Check `EMAIL_ENABLED=true` and valid App Password in `backend/.env`.

### Face not matching
Register all 7 angles, ensure lighting, use a registered student of the selected class.