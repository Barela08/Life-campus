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
- Preserved the 7-angle flow (front/left/right/up/down/smile/normal)

### Backend email config (`backend/.env.example`)
- Added SMTP placeholders (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD`, `SMTP_FROM_EMAIL`, `SMTP_USE_TLS`, `EMAIL_ENABLED`) — no real credentials

## Validation
- `npx tsc --noEmit` → EXITCODE=0 (no TS errors)
- `npm run build` → EXIT=0 (production build, 2477 modules)
- Backend imports OK, all `/api/face/*` routes registered
- Backend server on :8000 healthy (`face_engine: face_recognition`)
- Frontend dev server on :5173 (proxy to backend returns real DB data)
- Admin login + department metadata verified via API
