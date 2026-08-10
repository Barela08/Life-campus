 # Life Campus — Fix Plan

## Steps

- [x] Step 1: Analyze codebase
- [x] Step 2: Improve shared camera service (`camera.ts`) — added `onLive` callback, `isLive()`, `startLiveMonitor()`, `stopLiveMonitor()`, `getVideo()`
- [x] Step 3: Refactor Attendance.tsx — use shared camera, accurate LIVE status, overlays, cooldowns, request-lock
- [x] Step 4: Refactor StudentFace.tsx — use shared camera service
- [x] Step 5: Update backend/.env.example with SMTP placeholders
- [x] Step 6: Run TypeScript checks (`tsc --noEmit` EXITCODE=0)
- [x] Step 7: Start backend + frontend
- [x] Step 8: Test camera, registration, recognition, attendance, email
- [x] Step 9: Fix any runtime issues
- [x] Step 10: Final verification

## What was fixed

### Shared camera service (`frontend/src/lib/camera.ts`)
- Added `onLive` callback + `isLive()` (accurate LIVE detection: `stream.active && video.readyState>=2 && videoWidth>0`)
- Added `startLiveMonitor()` / `stopLiveMonitor()` / `getVideo()` helpers
- **CRITICAL BUG FIX**: `attachVideo()` now restarts FPS monitoring when the video element mounts AFTER the stream was created. Previously, FPS monitoring started with a `null` videoRef, so `isLive()` always returned `false` and the camera appeared stuck on "Connecting…" forever.
- Existing: start/stop/refresh/switch/reconnect, watchdog (stall detection), track-ended reconnect, permission/busy/notfound/unsupported error mapping

### Attendance terminal (`frontend/src/pages/attendance/Attendance.tsx`)
- Delegates all camera management to the shared `cameraService` (single reliable implementation)
- **Accurate `● CAMERA LIVE`** status based on the video actually rendering frames (not merely stream attached)
- **Overlay auto-dismiss** after 4.5s for success / duplicate / unknown / wrong-class — then returns to scanning
- **Wrong-class handling**: "Student belongs to another class — attendance NOT marked" (was previously treated as Present)
- **Unknown-face cooldown** (5s) so it doesn't re-trigger on every frame
- **Request-lock** (`recognLockRef`) prevents overlapping recognition requests
- Throttled scanning (1.2s interval), keeps live list, debug panel, login gate, fullscreen, low-light

### Student face registration (`frontend/src/pages/student/StudentFace.tsx`)
- Uses shared `cameraService`, shows LIVE/CONNECTING/error states, capture disabled until `live`
- **CRITICAL BUG FIX**: Sends `student.id` (DB integer) instead of `student.student_id` (string) to `/face/register`. The wrong field caused a 422 validation error and face registration always failed.
- Preserved the 7-angle flow (front/left/right/up/down/smile/normal)

### Admin face registration (`frontend/src/pages/admin/AdminFace.tsx`)
- **Fixed camera startup**: Replaced fragile `setTimeout(() => startCaptureCam(), 100)` with immediate `startCaptureCam()` call — no more timing race
- **Added real LIVE detection**: Uses `onLive` callback + `startLiveMonitor()` so capture button only enables when frames actually render
- **Added Retry Camera button** for error/denied/busy/notfound states
- **Added LIVE badge** indicator
- **Smart angle skipping**: After capturing an angle, auto-advances to the next *un-captured* angle instead of just the next index — already-registered angles are skipped
- **Proper cleanup**: Stops camera, clears callbacks, stops live monitor on unmount

### Students page (`frontend/src/pages/admin/Students.tsx`)
- **Fixed FaceRegistrationModal** to use the shared `cameraService` instead of its own `getUserMedia` implementation
- **Fixed black-screen race**: The `<video>` element is now ALWAYS rendered (not conditionally), so the stream can always be bound
- **Added LIVE detection**, proper error display, and Retry Camera button
- **Added proper cleanup** on modal close/unmount

### Teacher attendance (`frontend/src/pages/teacher/TeacherAttendance.tsx`)
- **Fixed camera handling**: Now delegates to shared `cameraService` instead of its own `getUserMedia` + manual stream management
- **Fixed black-screen race**: The `<video>` element is now ALWAYS rendered, not conditionally
- **Added LIVE detection**, proper error states, and Retry Camera button
- **Added proper cleanup** on unmount

### Backend email config (`backend/.env.example`)
- Added SMTP placeholders (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD`, `SMTP_FROM_EMAIL`, `SMTP_USE_TLS`, `EMAIL_ENABLED`) — no real credentials

## Validation
- `tsc --noEmit` → EXITCODE=0 (no TS errors)
- `vite build` → SUCCESS (2477 modules, built in 14.72s)
- Backend imports OK, all `/api/face/*` routes registered