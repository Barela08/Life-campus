# LifeOS Smart Campus - Implementation TODO

## Backend ✅
- [x] Enhance `email_service.py` - professional HTML template for attendance_marked (student + parent email, roll no, dept, course, semester, class, subject, teacher, date, time, status, current %, monthly %), retry logic
- [x] Add low attendance (75%) warning email + notification in `face.py`
- [x] Add AuditLog entries for attendance success/failure/unknown/spoof in `face.py`
- [x] Rewrite `face.py` cleanly with enriched match response (full student/session details)

## Frontend ✅
- [x] Update `App.tsx` - `/` renders Attendance module as default landing page, `/attendance` also works; `*` redirects to `/`
- [x] Rewrite `Attendance.tsx` camera system - robust getUserMedia, permission/busy/notfound handling, camera switching, auto-reconnect, loading state, never-freeze watchdog, low-light detection, fullscreen, login gate for non-teacher
- [x] Add multi-angle face registration capture (front/left/right/up/down/smile/neutral) to `AdminFace.tsx`
- [x] Add live attendance showing student details, confidence, time in `Attendance.tsx`
- [x] Add scanline/pulse-ring animations to `tailwind.config.js`

## Section Flow (Department → Class → Section) ✅
- [x] `section` field in Student model, StudentCreate/Update/Out schemas
- [x] `create_student` in admin.py now persists `section` on student creation
- [x] Student update (PUT) persists `section` via exclude_unset
- [x] Admin Students.tsx: interface + form field + save payload include `section`
- [x] StartSessionRequest = {department_id, class_id, section, camera_id} (no subject)
- [x] TeacherAttendance.tsx: Department → Class → Section dropdown flow
- [x] face.py `/match` filters known faces by session department/class/section
- [x] teacher.py `/sections`, attendance.py `/meta/sections` return distinct sections
- [x] DB migration confirms students.section & attendance_sessions.section columns exist

## Camera Root-Cause Fix (Black Screen) ✅
- [x] Replaced strict `facingMode:'environment'` + `{exact: deviceId}` constraints (cause of `OverconstrainedError`/`NotReadableError`) with permissive `ideal` constraints + `facingMode:'user'`
- [x] Added automatic fallback retry with minimal constraints if the primary `getUserMedia` call is rejected
- [x] Keeping the video-attach race fix (stream re-attached once `<video>` mounts) and never-freeze watchdog

## Verification
- [x] Backend restarted (uvicorn port 8000) - health 200, face_engine face_recognition
- [x] Frontend running (vite port 5173) - `/` and `/attendance` return 200
- [x] TypeScript check EXIT=0 after section changes (TSC_EXIT=0)
- [x] Admin login (admin/1234) returns 200 with JWT
- [x] Admin dashboard returns 200 with real data (2 students, 2 teachers, 3 depts, 2 classes, 2 subjects)
- [x] Audit logs endpoint returns 200
- [x] TypeScript check EXIT=0 (no errors)
- [x] Python syntax check PASSES (face.py, email_service.py)
- [x] No runtime errors in backend.err.log / frontend.err.log
- [x] `npm run build` succeeds (vite production build, BUILD EXIT CODE: 0)
- [x] Backend app imports OK; face engine = `face_recognition` (graceful fallback, insightface not installed)
- [x] E2E face match with no registered faces -> returns "No registered faces for selected class/section" (guard works)
- [x] FULL E2E pipeline: register face -> approve -> match -> **John Doe matched, confidence 1.0, present marked**
- [x] Duplicate prevention E2E: second match -> **"Attendance Already Recorded"** (duplicate=True)
- [x] Session stop -> marks present/absent, returns 200
- [x] Frontend proxy to backend verified (5173 `/api/attendance/meta/departments` -> 3 departments)
