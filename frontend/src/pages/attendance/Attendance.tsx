import React, { useEffect, useRef, useState, useCallback } from 'react'
import api from '../../lib/api'
import { useAuth } from '../../store/auth'
import AttendanceLayout from '../../components/AttendanceLayout'
import { Badge } from '../../components/ui'
import toast from 'react-hot-toast'
import {
  Camera, Play, Square, Pause, UserCheck, Users, RefreshCw, AlertTriangle,
  Video, Wifi, ScanFace, CheckCircle2, XCircle, Loader, Monitor, LogIn,
  Maximize2, Minimize2, CameraOff, WifiOff, Signal, ChevronDown, User,
  Fingerprint, Calendar, Clock, Ban, Shield, AlertCircle, CheckCircle,
  Activity, Layers, ArrowLeft, RotateCcw, Eye, EyeOff
} from 'lucide-react'

type CameraState = 'off' | 'opening' | 'on' | 'error' | 'denied' | 'busy' | 'notfound'

function DebugRow({ label, value, good }: { label: string; value: string; good?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-gray-400">{label}</span>
      <span className={good === undefined ? 'text-gray-300' : good ? 'text-emerald-400' : 'text-amber-400'}>{value}</span>
    </div>
  )
}

export default function Attendance() {
  const { user, login: authLogin } = useAuth()
  const [departments, setDepartments] = useState<any[]>([])
  const [classes, setClasses] = useState<any[]>([])
  const [sections, setSections] = useState<string[]>([])
  const [departmentId, setDepartmentId] = useState('')
  const [classId, setClassId] = useState('')
  const [section, setSection] = useState('')
  const [sessionId, setSessionId] = useState<number | null>(null)
  const [sessionStatus, setSessionStatus] = useState('')
  const [records, setRecords] = useState<any[]>([])
  const [capturing, setCapturing] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [paused, setPaused] = useState(false)
  const [loading, setLoading] = useState(true)
  const [selectorOpen, setSelectorOpen] = useState(true)
  const [cameraState, setCameraState] = useState<CameraState>('off')
  const [cameraList, setCameraList] = useState<MediaDeviceInfo[]>([])
  const [activeCameraId, setActiveCameraId] = useState<string>('')
  const [networkStatus, setNetworkStatus] = useState<'online' | 'offline'>('online')
  const [lastRecognition, setLastRecognition] = useState<any>(null)
  const [lastUnknown, setLastUnknown] = useState<any>(null)
  const [currentTime, setCurrentTime] = useState(new Date())
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [lowLight, setLowLight] = useState(false)
  const [showLogin, setShowLogin] = useState(false)
  const [loginUser, setLoginUser] = useState({ username: '', password: '' })
  const [loginLoading, setLoginLoading] = useState(false)
  const [cameraError, setCameraError] = useState('')
  const [faceCount, setFaceCount] = useState(0)
const [cameraFps, setCameraFps] = useState(0)
  const [fpsHistory, setFpsHistory] = useState<number[]>([])
  // ---- Debug panel ----
  const [debugOpen, setDebugOpen] = useState(false)
  const [debugInfo, setDebugInfo] = useState({
    mediaDevices: false,
    permission: 'unknown',
    selectedCamera: 'N/A',
    resolution: 'N/A',
    fps: 0,
    backend: 'checking',
    recognition: 'idle',
    lastFrameSent: '-',
    lastRecognitionTime: '-',
    lastError: '-',
    videoWidth: 0,
    videoHeight: 0,
    streamActive: false,
  })

  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const cameraBoxRef = useRef<HTMLDivElement>(null)
  const scanLoopRef = useRef<number | null>(null)
  const reconnectRef = useRef<number | null>(null)
  const watchdogRef = useRef<number | null>(null)
  const lastFrameRef = useRef<number>(0)
  const frameCountRef = useRef<number>(0)
  const fpsIntervalRef = useRef<number | null>(null)
  const loginResolveRef = useRef<((value: boolean) => void) | null>(null)
  const pendingStartRef = useRef(false)

  // Clock
  useEffect(() => {
    const i = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(i)
  }, [])

  // Network status
  useEffect(() => {
    const online = () => { setNetworkStatus('online'); toast.success('Connection restored') }
    const offline = () => { setNetworkStatus('offline'); toast.error('Connection lost — will auto-sync') }
    window.addEventListener('online', online)
    window.addEventListener('offline', offline)
    return () => { window.removeEventListener('online', online); window.removeEventListener('offline', offline) }
  }, [])

  // Fullscreen listeners
  useEffect(() => {
    const onFs = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', onFs)
    return () => document.removeEventListener('fullscreenchange', onFs)
  }, [])

  // Load metadata for the selector
  const load = async () => {
    setLoading(true)
    try {
      const [d] = await Promise.all([api.get('/attendance/meta/departments')])
      setDepartments(d.data)
    } catch { toast.error('Failed to load') } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  // Load classes when department changes
  useEffect(() => {
    if (!departmentId) { setClasses([]); return }
    api.get('/attendance/meta/classes', { params: { department_id: +departmentId } })
      .then(r => setClasses(r.data))
      .catch(() => {})
  }, [departmentId])

  // Load sections when department/class changes
  useEffect(() => {
    if (!departmentId || !classId) { setSections([]); return }
    api.get('/attendance/meta/sections', { params: { department_id: +departmentId, class_id: +classId } })
      .then(r => setSections(r.data))
      .catch(() => {})
  }, [departmentId, classId])

  // ---- Camera management ----
  const stopAllTracks = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => { t.onended = null; t.stop() })
      streamRef.current = null
    }
    if (videoRef.current) videoRef.current.srcObject = null
    setCapturing(false)
    if (fpsIntervalRef.current) { clearInterval(fpsIntervalRef.current); fpsIntervalRef.current = null }
  }, [])

const attachStream = useCallback((s: MediaStream) => {
    streamRef.current = s
    setDebugInfo(d => ({
      ...d,
      permission: 'granted',
      selectedCamera: s.getVideoTracks()[0]?.label || d.selectedCamera,
      streamActive: true,
      lastError: '-',
    }))
    // Attach immediately if video is already mounted
    if (videoRef.current) {
      videoRef.current.srcObject = s
      videoRef.current.play().catch(() => {})
    }
    setCapturing(true)
    setCameraState('on')
    setCameraError('')
    lastFrameRef.current = Date.now()
    frameCountRef.current = 0
    // FPS counter
    if (fpsIntervalRef.current) clearInterval(fpsIntervalRef.current)
    fpsIntervalRef.current = window.setInterval(() => {
      setCameraFps(frameCountRef.current)
      frameCountRef.current = 0
    }, 1000)
    refreshCameras()
  }, [])

  // Ensure the stream is always attached to the video element once it mounts.
  // This fixes the race where the <video> renders AFTER attachStream stores the
  // stream (videoRef.current is null at that moment -> black screen with LED on).
  useEffect(() => {
    if (videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current
      videoRef.current.play().catch(() => {})
    }
  }, [capturing, cameraState])

  const openCamera = useCallback(async (deviceId?: string) => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraState('notfound')
      setCameraError('Camera not supported in this browser')
      toast.error('Camera not supported in this browser')
      return
    }
    stopAllTracks()
    setCameraState('opening')
    setCameraError('')
try {
      // First enumerate devices
      await refreshCameras()
      
      // ROOT-CAUSE FIX: avoid strict facingMode + {exact} deviceId which cause
      // OverconstrainedError/NotReadableError on many machines. Use ideal
      // constraints and fall back to minimal constraints if the browser rejects.
      const videoConstraints: MediaTrackConstraints = {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        facingMode: 'user',
      }
      if (deviceId) {
        videoConstraints.deviceId = deviceId
      }
      let s: MediaStream
      try {
        s = await navigator.mediaDevices.getUserMedia({ video: videoConstraints, audio: false })
      } catch (err: any) {
        const name = err?.name || ''
        if (name === 'OverconstrainedError' || name === 'NotReadableError' || name === 'NotFoundError') {
          // Fallback: minimal constraints (no facingMode, no ideal sizes)
          s = await navigator.mediaDevices.getUserMedia({
            video: deviceId ? { deviceId: { exact: deviceId } } : true,
            audio: false,
          })
        } else {
          throw err
        }
      }
      attachStream(s)
      // Monitor track ended -> reconnect
      s.getVideoTracks()[0]?.addEventListener('ended', () => {
        setCameraState('off')
        scheduleReconnect()
      })
    } catch (err: any) {
      const name = err?.name || ''
      let msg = 'Failed to open camera'
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        setCameraState('denied')
        msg = 'Camera permission denied. Allow access in browser settings and retry.'
      } else if (name === 'NotFoundError' || name === 'OverconstrainedError') {
        setCameraState('notfound')
        msg = 'No camera found. Connect a camera and retry.'
      } else if (name === 'NotReadableError' || name === 'TrackStartError') {
        setCameraState('busy')
        msg = 'Camera is busy or in use by another app. Close other apps and retry.'
      } else {
        setCameraState('error')
        msg = `Camera error: ${err.message || name || 'Unknown error'}`
      }
      setCameraError(msg)
      toast.error(msg)
    }
  }, [attachStream, stopAllTracks])

  const refreshCameras = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices()
      setCameraList(devices.filter(d => d.kind === 'videoinput'))
    } catch {}
  }

// Initial camera enumeration
  useEffect(() => {
    navigator.mediaDevices?.enumerateDevices?.()
      .then(devices => setCameraList(devices.filter(d => d.kind === 'videoinput')))
      .catch(() => {})
  }, [])

  // Debug panel: check backend connectivity + mediaDevices support
  useEffect(() => {
    setDebugInfo(d => ({ ...d, mediaDevices: !!navigator.mediaDevices?.getUserMedia }))
    api.get('/attendance/meta/departments')
      .then(() => setDebugInfo(d => ({ ...d, backend: 'online' })))
      .catch(() => setDebugInfo(d => ({ ...d, backend: 'offline' })))
  }, [])

  const scheduleReconnect = useCallback(() => {
    if (reconnectRef.current) return
    reconnectRef.current = window.setTimeout(() => {
      reconnectRef.current = null
      if (sessionId) openCamera(activeCameraId || undefined)
    }, 2000)
  }, [openCamera, sessionId, activeCameraId])

  // Watchdog: ensure stream is producing frames (never freeze)
  useEffect(() => {
    if (cameraState !== 'on') return
    watchdogRef.current = window.setInterval(() => {
      const now = Date.now()
      if (now - lastFrameRef.current > 4000) {
        setCameraState('off')
        setCameraError('Camera stream stalled — reconnecting...')
        openCamera(activeCameraId || undefined)
      }
    }, 3000)
    return () => { if (watchdogRef.current) clearInterval(watchdogRef.current) }
  }, [cameraState, openCamera, activeCameraId])

  // Update lastFrameRef on each video frame
  useEffect(() => {
    if (!videoRef.current || cameraState !== 'on') return
    const tick = () => {
      lastFrameRef.current = Date.now()
      frameCountRef.current++
      // brightness detection
      try {
        const v = videoRef.current!
        if (v.videoWidth) {
          const c = document.createElement('canvas')
          c.width = 64; c.height = 64
          const ctx = c.getContext('2d')!
          ctx.drawImage(v, 0, 0, 64, 64)
          const data = ctx.getImageData(0, 0, 64, 64).data
          let sum = 0
          for (let i = 0; i < data.length; i += 4) sum += (data[i] + data[i + 1] + data[i + 2]) / 3
          const avg = sum / (64 * 64)
          setLowLight(avg < 40)
        }
      } catch {}
      requestAnimationFrame(tick)
    }
    const raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [cameraState])

  const switchCamera = useCallback(async () => {
    await refreshCameras()
    const vids = cameraList
    if (vids.length === 0) { toast('No cameras available', { icon: '📷' }); return }
    const current = streamRef.current?.getVideoTracks()[0]?.getSettings().deviceId
    const idx = current ? vids.findIndex(d => d.deviceId === current) : -1
    const next = vids[(idx + 1) % vids.length]
    if (next) {
      setActiveCameraId(next.deviceId)
      openCamera(next.deviceId)
    } else {
      toast('Only one camera detected', { icon: '📷' })
    }
  }, [cameraList, openCamera])

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      cameraBoxRef.current?.requestFullscreen?.().catch(() => {})
    } else {
      document.exitFullscreen?.().catch(() => {})
    }
  }

  // ---- Session ----
  const startSession = async () => {
    if (!departmentId || !classId) { toast.error('Select department and class'); return }
    if (user?.role !== 'teacher') {
      // Show login popup, then auto-start after login
      pendingStartRef.current = true
      setShowLogin(true)
      return
    }
    await doStartSession()
  }

  const doStartSession = async () => {
    try {
      const res = await api.post('/attendance/start', {
        department_id: +departmentId,
        class_id: +classId,
        section: section || '',
        camera_id: 'attendance-terminal'
      })
      setSessionId(res.data.session_id)
      setSessionStatus('active')
      setSelectorOpen(false)
      toast.success('Attendance session started')
      await openCamera()
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to start')
    }
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoginLoading(true)
    try {
      const res = await api.post('/auth/login', loginUser)
      const data = res.data
      if (data.role !== 'teacher') {
        toast.error('Only teachers can run attendance')
        setLoginLoading(false)
        return
      }
      // Update auth state so the UI knows the user is logged in
      await authLogin(loginUser.username, loginUser.password)
      setShowLogin(false)
      toast.success('Logged in successfully')
      // Auto-start the session after login (no need to click Start again)
      if (pendingStartRef.current) {
        pendingStartRef.current = false
        await doStartSession()
      }
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Login failed')
    } finally {
      setLoginLoading(false)
    }
  }

  const scan = useCallback(async () => {
    if (!videoRef.current || !sessionId) return
    const canvas = document.createElement('canvas')
    const video = videoRef.current
    if (!video.videoWidth) return
    canvas.width = video.videoWidth; canvas.height = video.videoHeight
    canvas.getContext('2d')!.drawImage(video, 0, 0)
const b64 = canvas.toDataURL('image/jpeg', 0.8)
    setScanning(true)
    setDebugInfo(d => ({ ...d, recognition: 'scanning', lastFrameSent: new Date().toLocaleTimeString() }))
    try {
      const res = await api.post('/face/match', {
        session_id: sessionId,
        image_b64: b64,
        camera_id: 'attendance-terminal'
      })
      const d = res.data
      setDebugInfo(di => ({
        ...di,
        recognition: 'ok',
        lastRecognitionTime: new Date().toLocaleTimeString(),
        lastError: '-',
      }))
      if (d.matched) {
        const rec = {
          student: d.student,
          full_name: d.full_name || d.student,
          roll_number: d.roll_number,
          department: d.department,
          class: d.class,
          subject: d.subject,
          time: d.time,
          confidence: d.confidence,
          duplicate: d.duplicate,
          status: d.duplicate ? 'duplicate' : 'present'
        }
        setLastRecognition(rec)
        setLastUnknown(null)
        if (d.duplicate) {
          toast.custom(
            <div className="flex items-center gap-3 bg-amber-600 text-white px-5 py-3 rounded-2xl shadow-2xl shadow-amber-600/30">
              <CheckCircle2 size={20} />
              <div>
                <p className="font-semibold text-sm">{d.student}</p>
                <p className="text-xs opacity-80">Attendance Already Recorded</p>
              </div>
            </div>,
            { duration: 2500 }
          )
        } else {
          toast.success(
            <div className="flex items-center gap-3">
              <UserCheck size={20} />
              <div>
                <p className="font-semibold text-sm">{d.student} — Present</p>
                <p className="text-xs opacity-80">{(d.confidence * 100).toFixed(0)}% match</p>
              </div>
            </div>,
            { duration: 2500 }
          )
          await loadRecords()
        }
      } else {
        setLastRecognition(null)
        setLastUnknown({ reason: d.reason || 'Unknown face detected', confidence: d.confidence })
      }
    } catch { /* ignore transient */ } finally { setScanning(false) }
  }, [sessionId])

  const runScanLoop = useCallback(() => {
    if (sessionId && capturing && !paused && !scanning) scan()
    scanLoopRef.current = window.setTimeout(runScanLoop, 1200)
  }, [sessionId, capturing, paused, scanning, scan])

  useEffect(() => {
    runScanLoop()
    return () => { if (scanLoopRef.current) clearTimeout(scanLoopRef.current) }
  }, [runScanLoop])

  const loadRecords = useCallback(async () => {
    if (!sessionId) return
    try {
      const res = await api.get(`/attendance/session/${sessionId}`)
      setRecords(res.data.records)
    } catch {}
  }, [sessionId])

  useEffect(() => { if (sessionId) loadRecords() }, [sessionId, loadRecords])
  useEffect(() => {
    const i = setInterval(() => { if (sessionId) loadRecords() }, 3000)
    return () => clearInterval(i)
  }, [sessionId, loadRecords])

  const pauseSession = () => {
    setPaused(!paused)
    toast(paused ? 'Resumed scanning' : 'Scanning paused', { icon: '⏸️' })
  }

  const stopSession = async () => {
    try {
      await api.post(`/attendance/stop/${sessionId}`, {})
      setSessionStatus('closed')
      stopAllTracks()
      setCapturing(false); setCameraState('off')
      toast.success('Session closed. Absentees marked.')
      setSelectorOpen(true); setSessionId(null)
      setRecords([])
      setLastRecognition(null)
      setLastUnknown(null)
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to close')
    }
  }

  const retryCamera = () => {
    openCamera(activeCameraId || undefined)
  }

  const markedCount = records.length
  const presentCount = records.filter((r: any) => r.status === 'present').length
  const camBadge = cameraState === 'on' ? 'green' : cameraState === 'opening' ? 'yellow' : 'red'
  const camLabel = cameraState === 'on' ? 'Live' : cameraState === 'opening' ? 'Opening…' : cameraState.toUpperCase()

  // ---- Render ----
  const loginGate = showLogin && (
    <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-xl flex items-center justify-center p-4 animate-fade-in" onClick={() => { setShowLogin(false); pendingStartRef.current = false }}>
      <div
        className="relative w-full max-w-sm bg-white dark:bg-gray-900 rounded-3xl shadow-2xl border border-gray-200 dark:border-gray-800 overflow-hidden animate-slide-up"
        onClick={e => e.stopPropagation()}
      >
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary-500 via-violet-500 to-primary-500" />
        <div className="p-8 pt-10">
          <div className="text-center mb-6">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-primary-500 to-violet-600 flex items-center justify-center shadow-lg shadow-primary-500/25">
              <LogIn className="text-white" size={28} />
            </div>
            <h3 className="text-xl font-bold mt-4">Teacher Login</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Sign in to start the attendance session</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="label">Username / Teacher ID</label>
              <input
                className="input"
                placeholder="Enter your username"
                value={loginUser.username}
                onChange={e => setLoginUser({ ...loginUser, username: e.target.value })}
                autoFocus
              />
            </div>
            <div>
              <label className="label">Password</label>
              <input
                className="input"
                type="password"
                placeholder="Enter your password"
                value={loginUser.password}
                onChange={e => setLoginUser({ ...loginUser, password: e.target.value })}
              />
            </div>
            <button
              type="submit"
              disabled={loginLoading}
              className="btn-primary w-full flex items-center justify-center gap-2 py-3 text-base"
            >
              {loginLoading ? <Loader size={18} className="animate-spin" /> : <LogIn size={18} />}
              {loginLoading ? 'Signing in...' : 'Sign In & Start'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )

  // ---- Welcome / Selector Screen ----
  if (selectorOpen) {
    return (
      <AttendanceLayout>
        {loginGate}
        <div className="min-h-[calc(100vh-3.5rem)] flex items-center justify-center p-4">
          <div className="w-full max-w-lg animate-slide-up">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-gradient-to-br from-primary-500 via-violet-500 to-primary-600 shadow-2xl shadow-primary-500/30 mb-5">
                <Camera className="text-white" size={36} />
              </div>
              <h1 className="text-3xl font-bold tracking-tight">Attendance Terminal</h1>
              <p className="text-gray-500 dark:text-gray-400 mt-2 text-sm max-w-sm mx-auto leading-relaxed">
                AI-powered face recognition attendance system. Select your class and start scanning.
              </p>
            </div>

            <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
              <div className="p-6 space-y-5">
                <div>
                  <label className="label text-sm font-semibold flex items-center gap-2">
                    <Layers size={14} className="text-primary-500" /> Department
                  </label>
                  <select
                    className="input"
                    value={departmentId}
                    onChange={e => { setDepartmentId(e.target.value); setClassId(''); setSection('') }}
                  >
                    <option value="">Select department</option>
                    {departments.map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="label text-sm font-semibold flex items-center gap-2">
                    <Monitor size={14} className="text-primary-500" /> Class
                  </label>
                  <select
                    className="input"
                    value={classId}
                    onChange={e => { setClassId(e.target.value); setSection('') }}
                    disabled={!departmentId}
                  >
                    <option value="">{departmentId ? 'Select class' : 'Select department first'}</option>
                    {classes.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="label text-sm font-semibold flex items-center gap-2">
                    <Users size={14} className="text-primary-500" /> Section
                  </label>
                  <select
                    className="input"
                    value={section}
                    onChange={e => setSection(e.target.value)}
                    disabled={!classId}
                  >
                    <option value="">{classId ? 'Select section (optional)' : 'Select class first'}</option>
                    {sections.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>

                <button
                  onClick={startSession}
                  disabled={!departmentId || !classId}
                  className="btn-primary w-full flex items-center justify-center gap-2 py-3.5 text-base font-semibold mt-2"
                >
                  <Play size={18} />
                  Start Attendance
                </button>

                {user?.role !== 'teacher' && (
                  <p className="text-xs text-center text-gray-400 dark:text-gray-500 mt-2">
                    <LogIn size={12} className="inline mr-1" />
                    You'll be asked to sign in as a teacher before starting
                  </p>
                )}
              </div>

              {/* Camera preview */}
              {cameraList.length > 0 && (
                <div className="border-t border-gray-200 dark:border-gray-800 p-4 bg-gray-50/50 dark:bg-gray-800/50">
                  <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                    <Camera size={14} />
                    <span>{cameraList.length} camera{cameraList.length > 1 ? 's' : ''} detected</span>
                    <span className="ml-auto">Ready to start</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </AttendanceLayout>
    )
  }

  // ---- Active Session UI ----
  return (
    <AttendanceLayout>
      {loginGate}
      <div className="h-[calc(100vh-3.5rem)] flex flex-col lg:flex-row gap-4 -m-4 lg:-m-6 p-4 lg:p-6">
        {/* Left: Camera */}
        <div className="flex-1 flex flex-col gap-3 min-h-0">
          <div
            ref={cameraBoxRef}
            className="relative flex-1 rounded-2xl overflow-hidden bg-black border border-gray-200 dark:border-gray-800 min-h-[300px]"
          >
            {capturing ? (
              <>
<video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="absolute inset-0 w-full h-full object-cover"
                  onLoadedMetadata={() => {
                    if (videoRef.current && streamRef.current) {
                      videoRef.current.srcObject = streamRef.current
                      videoRef.current.play().catch(() => {})
                    }
                    setDebugInfo(d => ({
                      ...d,
                      resolution: videoRef.current?.videoWidth ? `${videoRef.current.videoWidth}×${videoRef.current.videoHeight}` : d.resolution,
                      videoWidth: videoRef.current?.videoWidth || 0,
                      videoHeight: videoRef.current?.videoHeight || 0,
                    }))
                  }}
                />
                {/* Scan overlay */}
                {scanning && (
                  <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-48 h-48 border-2 border-primary-400/60 rounded-2xl animate-pulse" />
                    </div>
                    <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-primary-400/80 to-transparent animate-scanline" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
                  </div>
                )}
                {/* Face detection indicator */}
                <div className="absolute top-4 left-4 flex gap-2 flex-wrap">
                  <Badge variant={camBadge}>
                    <Video size={12} className="inline mr-1" /> {camLabel}
                  </Badge>
                  <Badge variant={networkStatus === 'online' ? 'green' : 'red'}>
                    {networkStatus === 'online' ? <Wifi size={12} className="inline mr-1" /> : <WifiOff size={12} className="inline mr-1" />}
                  </Badge>
                  {lowLight && <Badge variant="yellow"><AlertCircle size={12} className="inline mr-1" /> Low light</Badge>}
                  {paused && <Badge variant="yellow"><Pause size={12} className="inline mr-1" /> Paused</Badge>}
                </div>
                {/* FPS */}
                <div className="absolute top-4 right-4 flex gap-2">
                  <Badge variant="blue">
                    <Activity size={12} className="inline mr-1" /> {cameraFps} FPS
                  </Badge>
                  <Badge variant={sessionStatus === 'active' ? 'green' : 'red'}>
                    {sessionStatus === 'active' ? 'Live' : 'Closed'}
                  </Badge>
                </div>
                {/* Fullscreen button */}
                <button
                  onClick={toggleFullscreen}
                  className="absolute bottom-4 right-4 p-2.5 rounded-xl bg-black/50 hover:bg-black/70 text-white backdrop-blur transition-all"
                >
                  {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                </button>

                {/* Last recognition card */}
                {lastRecognition && (
                  <div
                    className={`absolute bottom-4 left-4 right-16 p-4 rounded-2xl backdrop-blur-lg transition-all duration-500 ${
                      lastRecognition.status === 'duplicate'
                        ? 'bg-amber-500/85 text-white shadow-2xl shadow-amber-500/20'
                        : 'bg-emerald-500/85 text-white shadow-2xl shadow-emerald-500/20'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                        {lastRecognition.status === 'duplicate' ? <CheckCircle2 size={22} /> : <UserCheck size={22} />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-base truncate">{lastRecognition.full_name || lastRecognition.student}</p>
                        <p className="text-xs opacity-90 truncate flex items-center gap-2 mt-0.5">
                          {lastRecognition.status === 'duplicate' ? (
                            <><CheckCircle2 size={12} /> Attendance Already Recorded</>
                          ) : (
                            <><UserCheck size={12} /> Present • {(lastRecognition.confidence * 100).toFixed(0)}% match</>
                          )}
                        </p>
                      </div>
                      {lastRecognition.time && (
                        <span className="text-xs opacity-70 shrink-0">{lastRecognition.time}</span>
                      )}
                    </div>
                  </div>
                )}
                {!lastRecognition && lastUnknown && (
                  <div className="absolute bottom-4 left-4 right-16 p-4 rounded-2xl backdrop-blur-lg bg-red-500/85 text-white shadow-2xl shadow-red-500/20 flex items-center gap-3">
                    <AlertTriangle size={20} />
                    <div>
                      <p className="font-semibold text-sm">Unknown Face</p>
                      <p className="text-xs opacity-80">{lastUnknown.reason}</p>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-gray-500 p-6">
                {cameraState === 'opening' ? (
                  <div className="text-center">
                    <div className="w-16 h-16 mx-auto rounded-2xl bg-primary-500/10 flex items-center justify-center mb-4">
                      <Loader className="animate-spin text-primary-500" size={32} />
                    </div>
                    <p className="text-base font-medium text-gray-300">Opening camera...</p>
                    <p className="text-sm text-gray-500 mt-1">Please allow camera access when prompted</p>
                  </div>
                ) : cameraState === 'denied' ? (
                  <div className="text-center max-w-sm">
                    <div className="w-16 h-16 mx-auto rounded-2xl bg-red-500/10 flex items-center justify-center mb-4">
                      <CameraOff size={32} className="text-red-500" />
                    </div>
                    <p className="text-base font-medium text-gray-300">Camera Permission Denied</p>
                    <p className="text-sm text-gray-500 mt-1 mb-4">Allow camera access in your browser settings and try again.</p>
                    <button onClick={retryCamera} className="btn-primary flex items-center gap-2 mx-auto">
                      <RefreshCw size={16} /> Retry Camera
                    </button>
                  </div>
                ) : cameraState === 'busy' ? (
                  <div className="text-center max-w-sm">
                    <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-500/10 flex items-center justify-center mb-4">
                      <Camera size={32} className="text-amber-500" />
                    </div>
                    <p className="text-base font-medium text-gray-300">Camera Busy</p>
                    <p className="text-sm text-gray-500 mt-1 mb-4">The camera is in use by another application. Close it and retry.</p>
                    <button onClick={retryCamera} className="btn-primary flex items-center gap-2 mx-auto">
                      <RefreshCw size={16} /> Retry Camera
                    </button>
                  </div>
                ) : cameraState === 'notfound' ? (
                  <div className="text-center max-w-sm">
                    <div className="w-16 h-16 mx-auto rounded-2xl bg-gray-500/10 flex items-center justify-center mb-4">
                      <CameraOff size={32} />
                    </div>
                    <p className="text-base font-medium text-gray-300">No Camera Found</p>
                    <p className="text-sm text-gray-500 mt-1 mb-4">Connect a camera and click retry.</p>
                    <button onClick={retryCamera} className="btn-primary flex items-center gap-2 mx-auto">
                      <RefreshCw size={16} /> Retry Camera
                    </button>
                  </div>
                ) : cameraState === 'error' && cameraError ? (
                  <div className="text-center max-w-sm">
                    <div className="w-16 h-16 mx-auto rounded-2xl bg-red-500/10 flex items-center justify-center mb-4">
                      <AlertTriangle size={32} className="text-red-500" />
                    </div>
                    <p className="text-base font-medium text-gray-300">Camera Error</p>
                    <p className="text-sm text-gray-500 mt-1 mb-4">{cameraError}</p>
                    <button onClick={retryCamera} className="btn-primary flex items-center gap-2 mx-auto">
                      <RefreshCw size={16} /> Retry Camera
                    </button>
                  </div>
                ) : (
                  <div className="text-center">
                    <div className="w-16 h-16 mx-auto rounded-2xl bg-gray-500/10 flex items-center justify-center mb-4">
                      <Camera size={32} />
                    </div>
                    <p className="text-base font-medium text-gray-300">Camera Off</p>
                    <p className="text-sm text-gray-500 mt-1">Click Enable Camera to start</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800">
            <div className="flex gap-2 flex-wrap">
              {!capturing ? (
                <button
                  onClick={() => openCamera()}
                  disabled={cameraState === 'opening'}
                  className="btn-primary flex items-center gap-2 text-sm"
                >
                  <Camera size={16} /> Enable Camera
                </button>
              ) : (
                <>
                  <button
                    onClick={pauseSession}
                    className="btn-secondary flex items-center gap-2 text-sm"
                  >
                    <Pause size={16} /> {paused ? 'Resume' : 'Pause'}
                  </button>
                  <button
                    onClick={switchCamera}
                    className="btn-secondary flex items-center gap-2 text-sm"
                  >
                    <RefreshCw size={16} /> Switch Cam
                  </button>
                  <button
                    onClick={retryCamera}
                    className="btn-secondary flex items-center gap-2 text-sm"
                  >
                    <RotateCcw size={16} /> Refresh
                  </button>
                </>
              )}
              <button
                onClick={stopSession}
                disabled={!sessionId}
                className="btn-danger flex items-center gap-2 text-sm"
              >
                <Square size={16} /> Stop
              </button>
              <button
                onClick={toggleFullscreen}
                className="btn-secondary flex items-center gap-2 text-sm"
              >
                <Monitor size={16} /> Fullscreen
              </button>
            </div>
<div className="flex items-center gap-2 text-sm">
              <ScanFace className="text-primary-400" size={18} />
              <span className="text-gray-500 dark:text-gray-400">
                Recognition: <b className={scanning ? 'text-primary-400' : 'text-gray-400'}>
                  {scanning ? 'Scanning...' : 'Idle'}
                </b>
              </span>
            </div>
          </div>

          {/* Debug panel */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
            <button
              onClick={() => setDebugOpen(!debugOpen)}
              className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              <span className="flex items-center gap-2">
                <Activity size={13} /> Developer Debug Panel
              </span>
              <ChevronDown size={14} className={`transition-transform ${debugOpen ? 'rotate-180' : ''}`} />
            </button>
            {debugOpen && (
              <div className="px-4 pb-4 pt-1 grid grid-cols-2 gap-x-4 gap-y-2 text-xs font-mono">
                <DebugRow label="Media Devices" value={debugInfo.mediaDevices ? 'Available' : 'N/A'} good={debugInfo.mediaDevices} />
                <DebugRow label="Permission" value={debugInfo.permission} good={debugInfo.permission === 'granted'} />
                <DebugRow label="Selected Camera" value={debugInfo.selectedCamera} />
                <DebugRow label="Resolution" value={debugInfo.resolution} />
                <DebugRow label="FPS" value={`${cameraFps}`} />
                <DebugRow label="Stream Active" value={debugInfo.streamActive ? 'Yes' : 'No'} good={debugInfo.streamActive} />
                <DebugRow label="Backend" value={debugInfo.backend} good={debugInfo.backend === 'online'} />
                <DebugRow label="Recognition" value={debugInfo.recognition} />
                <DebugRow label="Last Frame Sent" value={debugInfo.lastFrameSent} />
                <DebugRow label="Last Recognition" value={debugInfo.lastRecognitionTime} />
                <DebugRow label="Video Size" value={`${debugInfo.videoWidth}×${debugInfo.videoHeight}`} />
                <DebugRow label="Last Error" value={debugInfo.lastError} good={debugInfo.lastError === '-' || debugInfo.lastError === ''} />
              </div>
            )}
          </div>
        </div>

        {/* Right: Session info + live list */}
        <div className="w-full lg:w-[360px] xl:w-[400px] flex flex-col gap-3 min-h-0">
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5">
            <h3 className="font-semibold text-sm mb-4 flex items-center gap-2">
              <Signal size={16} className="text-primary-500" /> Session #{sessionId}
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-gray-100 dark:bg-gray-800">
                <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                  <Clock size={12} /> Time
                </p>
                <p className="font-semibold text-sm mt-0.5">{currentTime.toLocaleTimeString()}</p>
              </div>
              <div className="p-3 rounded-xl bg-gray-100 dark:bg-gray-800">
                <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                  <CheckCircle size={12} /> Marked
                </p>
                <p className="font-semibold text-sm mt-0.5 text-emerald-500">{markedCount}</p>
              </div>
              <div className="p-3 rounded-xl bg-gray-100 dark:bg-gray-800">
                <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                  <UserCheck size={12} /> Present
                </p>
                <p className="font-semibold text-sm mt-0.5 text-primary-500">{presentCount}</p>
              </div>
              <div className="p-3 rounded-xl bg-gray-100 dark:bg-gray-800">
                <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                  <Activity size={12} /> Status
                </p>
                <p className="font-semibold text-sm mt-0.5 capitalize">{paused ? 'Paused' : sessionStatus}</p>
              </div>
            </div>
            {lowLight && (
              <div className="mt-3 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-xs flex items-center gap-2">
                <AlertCircle size={14} /> Low light detected — recognition may be affected
              </div>
            )}
          </div>

          <div className="flex-1 bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5 flex flex-col min-h-0">
            <h3 className="font-semibold text-sm mb-3 flex items-center gap-2 shrink-0">
              <Users size={16} className="text-primary-500" /> Live Attendance
              <span className="ml-auto text-xs font-normal text-gray-400">{records.length} students</span>
            </h3>
            {records.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
                <Users size={40} className="mb-3 opacity-30" />
                <p className="text-sm">No students marked yet</p>
                <p className="text-xs mt-1">Waiting for face recognition...</p>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 -mr-1">
                {records.map(r => (
                  <div key={r.id} className="flex items-center justify-between p-2.5 rounded-xl bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-emerald-500/15 flex items-center justify-center shrink-0">
                        <UserCheck size={15} className="text-emerald-500" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{r.student_name}</p>
                        <p className="text-[11px] text-gray-400 truncate">
                          {r.time}
                          {r.class_name ? ` • ${r.class_name}` : ''}
                        </p>
                      </div>
                    </div>
                    <div className="text-right shrink-0 ml-2">
                      <Badge variant={r.status === 'present' ? 'green' : 'red'}>{r.status}</Badge>
                      {r.confidence && (
                        <p className="text-[10px] text-gray-400 mt-0.5">{(r.confidence * 100).toFixed(0)}%</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </AttendanceLayout>
  )
}