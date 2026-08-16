import React, { useCallback, useEffect, useRef, useState } from 'react'
import api, { apiErrorMessage } from '../../lib/api'
import AttendanceLayout from '../../components/AttendanceLayout'
import { PageHeader, Badge, Modal, Loading } from '../../components/ui'
import toast from 'react-hot-toast'
import { Camera, Play, Square, UserCheck, Users, RefreshCw, Loader } from 'lucide-react'
import { cameraService, CameraState } from '../../lib/camera'

export default function TeacherAttendance() {
  const [departments, setDepartments] = useState<any[]>([])
  const [classes, setClasses] = useState<any[]>([])
  const [sections, setSections] = useState<string[]>([])
  const [students, setStudents] = useState<any[]>([])
  const [teacherProfile, setTeacherProfile] = useState<any>(null)
  const [sessionId, setSessionId] = useState<number | null>(null)
  const [sessionStatus, setSessionStatus] = useState('')
  const [sessionMeta, setSessionMeta] = useState<any>(null)
  const [counts, setCounts] = useState({ marked: 0, present: 0, absent: 0, total_students: 0 })
  const [records, setRecords] = useState<any[]>([])
  const [capturing, setCapturing] = useState(false)
  const [live, setLive] = useState(false)
  const [cameraState, setCameraState] = useState<CameraState>('off')
  const [cameraError, setCameraError] = useState('')
  const [scanning, setScanning] = useState(false)
  const [departmentId, setDepartmentId] = useState('')
  const [classId, setClassId] = useState('')
  const [subjectId, setSubjectId] = useState('')
  const [section, setSection] = useState('')
  const [loading, setLoading] = useState(true)
  const [selectorOpen, setSelectorOpen] = useState(!sessionId)
  const [manualOpen, setManualOpen] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const markedLocalRef = useRef<Set<string>>(new Set())
  const scanInFlightRef = useRef(false)
  const successCooldownRef = useRef<Record<string, number>>({})

  const load = async () => {
    setLoading(true)
    try {
      const [d, c, sec, profile] = await Promise.all([
        api.get('/teacher/departments'),
        api.get('/teacher/classes'),
        api.get('/teacher/sections'),
        api.get('/teacher/profile'),
      ])
      setDepartments(d.data); setClasses(c.data); setSections(sec.data)
      setTeacherProfile(profile.data)
      if (profile.data.department_id) setDepartmentId(String(profile.data.department_id))
      if (profile.data.class_id) setClassId(String(profile.data.class_id))
      if (profile.data.subject_id) setSubjectId(String(profile.data.subject_id))
      if (profile.data.section) setSection(profile.data.section)
    } catch (err: any) { toast.error(apiErrorMessage(err, 'Failed to load')) } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const startSession = async () => {
    if (!departmentId || !classId) { toast.error('Select department and class'); return }
    if (!subjectId && !teacherProfile?.subject_id) { toast.error('Subject is required before starting attendance'); return }
    try {
      const res = await api.post('/attendance/start', {
        department_id: +departmentId, class_id: +classId, subject_id: +(subjectId || teacherProfile?.subject_id), section, camera_id: 'teacher-cam',
      })
      setSessionId(res.data.session_id); setSessionStatus('active'); setSelectorOpen(false); setRecords([])
      setSessionMeta(res.data)
      setCounts(res.data.counts || { marked: 0, present: 0, absent: 0, total_students: 0 })
      markedLocalRef.current.clear()
      toast.success('Attendance session started')
      const st = await api.get('/teacher/students')
      setStudents(st.data)
    } catch (err: any) { toast.error(apiErrorMessage(err, 'Failed to start')) }
  }

  const startCamera = async () => {
    cameraService.setCallbacks({
      onStateChange: (state, err) => {
        setCameraState(state)
        setCameraError(err || '')
        setCapturing(state === 'on')
      },
      onLive: (l) => setLive(l),
    })
    cameraService.attachVideo(videoRef.current)
    cameraService.startLiveMonitor()
    const ok = await cameraService.startCamera()
    if (!ok) {
      setCameraState(cameraService.getState())
      setCameraError(cameraService.getError())
      setCapturing(false)
      setLive(false)
    }
  }

  const stopCamera = () => {
    cameraService.stopCamera()
    setCapturing(false)
    setLive(false)
    setCameraState('off')
  }

  // Re-attach stream when video mounts (black-screen race fix)
  useEffect(() => {
    if (capturing) {
      cameraService.attachVideo(videoRef.current)
    }
  }, [capturing, live])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cameraService.setCallbacks({})
      cameraService.stopCamera()
      cameraService.stopLiveMonitor()
    }
  }, [])

  const upsertRecord = useCallback((record: any) => {
    if (!record?.id) return
    setRecords(prev => {
      const exists = prev.some(r => r.id === record.id)
      return exists ? prev.map(r => r.id === record.id ? { ...r, ...record } : r) : [record, ...prev]
    })
    if (record.student_id) markedLocalRef.current.add(String(record.student_id))
    else if (record.student_name) markedLocalRef.current.add(String(record.student_name))
  }, [])

  const scan = useCallback(async () => {
    if (!sessionId || scanInFlightRef.current || !live) return
    if (!cameraService.isFrameReady()) return
    const b64 = cameraService.captureFrame()
    if (!b64) return
    scanInFlightRef.current = true
    setScanning(true)
    try {
      const res = await api.post('/face/match', { session_id: sessionId, image_b64: b64, camera_id: 'teacher-cam' })
      const d = res.data
      const record = d.attendance || d.record
      const name = d.student || record?.student_name || 'Student'
      if (d.success && d.matched) {
        upsertRecord(record)
        if (d.counts) setCounts(d.counts)
        const key = String(d.student_id || record?.student_id || name)
        const now = Date.now()
        const onCooldown = !!successCooldownRef.current[key] && now - successCooldownRef.current[key] < 6000
        if (d.duplicate || d.already_marked) {
          if (!onCooldown) toast(`${name}: Attendance already marked.`)
        } else {
          successCooldownRef.current[key] = now
          toast.success(`${name} marked present (${((d.confidence || 0) * 100).toFixed(0)}%)`)
        }
        if (d.email?.queued === false && d.email?.message) toast(d.email.message)
        return
      }
      if (d.wrong_class) {
        toast.error(d.message || 'Student does not belong to this attendance session.')
        return
      }
      toast.error(d.reason || d.message || 'Face not recognized.')
      return
      if (d.matched) {
        if (d.duplicate) toast(`${d.student}: Attendance Already Recorded`, { icon: '⚠️' })
        else { toast.success(`${d.student} marked present (${(d.confidence * 100).toFixed(0)}%)`); await loadRecords() }
      } else toast.error(d.reason || 'Unknown face')
    } catch (err: any) { toast.error(apiErrorMessage(err, 'Scan failed')) } finally { scanInFlightRef.current = false; setScanning(false) }
  }, [sessionId, live, upsertRecord])

  const loadRecords = async () => {
    if (!sessionId) return
    try {
      const res = await api.get(`/attendance/session/${sessionId}`)
      setRecords(res.data.records)
      setSessionMeta(res.data)
      if (res.data.counts) setCounts(res.data.counts)
      markedLocalRef.current = new Set((res.data.records || []).map((r: any) => String(r.student_id || r.student_name)))
    } catch {}
  }
  useEffect(() => { if (sessionId) loadRecords() }, [sessionId])
  useEffect(() => {
    if (!sessionId || !capturing || !live || sessionStatus !== 'active') return
    const i = window.setInterval(() => { scan() }, 700)
    return () => window.clearInterval(i)
  }, [sessionId, capturing, live, sessionStatus, scan])

  const manualMark = async (studentId: number) => {
    try {
      const res = await api.post('/attendance/manual', { session_id: sessionId, student_id: studentId, status: 'present' })
      upsertRecord(res.data.attendance || res.data.record)
      if (res.data.counts) setCounts(res.data.counts)
      toast.success('Marked present')
    }
    catch (err: any) { toast.error(apiErrorMessage(err, 'Failed')) }
  }

  const stopSession = async () => {
    try {
      await api.post(`/attendance/stop/${sessionId}`, {})
      setSessionStatus('closed')
      stopCamera()
      toast.success('Session closed. Absentees marked.')
    } catch (err: any) { toast.error(apiErrorMessage(err, 'Failed to close')) }
  }

  const markedIds = new Set(records.map((r: any) => String(r.student_id || r.student_name)))
  const presentCount = counts.present || records.filter((r: any) => r.status === 'present').length
  const totalStudents = counts.total_students || students.length
  const absentCount = counts.absent ?? Math.max(totalStudents - presentCount, 0)

  if (loading) return <AttendanceLayout><Loading /></AttendanceLayout>

  return (
    <AttendanceLayout>
      <PageHeader title="Start Attendance" subtitle="Attendance follows your assigned subject, class and section" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-5">
          {selectorOpen ? (
            <div className="space-y-4">
              <h3 className="font-semibold flex items-center gap-2"><Play size={18} className="text-primary-500" /> Start New Session</h3>
              {teacherProfile?.subject && (
                <div className="rounded-lg bg-primary-50 dark:bg-primary-500/10 p-3 text-sm">
                  <p className="font-medium">{teacherProfile.subject}</p>
                  <p className="text-xs text-gray-500">{teacherProfile.department} - {teacherProfile.class_name}{teacherProfile.section ? ` / Section ${teacherProfile.section}` : ''}</p>
                </div>
              )}
              <div><label className="label">Department</label>
                <select className="input" value={departmentId} onChange={e => setDepartmentId(e.target.value)}>
                  <option value="">Select department</option>{departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select></div>
              <div><label className="label">Class</label>
                <select className="input" value={classId} onChange={e => setClassId(e.target.value)}>
                  <option value="">Select class</option>{classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select></div>
              <input type="hidden" value={subjectId} readOnly />
              <div><label className="label">Section (optional)</label>
                <select className="input" value={section} onChange={e => setSection(e.target.value)}>
                  <option value="">All sections</option>{sections.map((s, i) => <option key={i} value={s}>{s}</option>)}
                </select></div>
              <button onClick={startSession} className="btn-primary w-full flex items-center justify-center gap-2"><Play size={16} /> Start Session</button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold flex items-center gap-2"><Camera size={18} className="text-emerald-500" /> Session #{sessionId}</h3>
                <Badge variant={sessionStatus === 'active' ? 'green' : 'red'}>{sessionStatus}</Badge>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-lg bg-gray-50 dark:bg-gray-800 p-2"><span className="text-gray-400">Subject</span><p className="font-medium">{sessionMeta?.subject || teacherProfile?.subject || '-'}</p></div>
                <div className="rounded-lg bg-gray-50 dark:bg-gray-800 p-2"><span className="text-gray-400">Class</span><p className="font-medium">{sessionMeta?.class || teacherProfile?.class_name || '-'}</p></div>
                <div className="rounded-lg bg-gray-50 dark:bg-gray-800 p-2"><span className="text-gray-400">Section</span><p className="font-medium">{sessionMeta?.section || teacherProfile?.section || '-'}</p></div>
                <div className="rounded-lg bg-gray-50 dark:bg-gray-800 p-2"><span className="text-gray-400">Total</span><p className="font-medium">{totalStudents}</p></div>
              </div>
              {/* The <video> is ALWAYS rendered so videoRef.current is always valid
                  and the MediaStream can be bound at any time — eliminates the
                  black-screen race. State/error UI is layered on top. */}
              <div className="relative rounded-xl overflow-hidden bg-black aspect-video">
                <video
                  ref={(el) => {
                    videoRef.current = el
                    // CRITICAL: bind the stream the INSTANT the element mounts.
                    cameraService.attachVideo(el)
                  }}
                  autoPlay
                  playsInline
                  muted
                  className="absolute inset-0 w-full h-full object-cover"
                />
                {!capturing && (
                  <div className="absolute inset-0 w-full h-full flex flex-col items-center justify-center text-gray-500 bg-black">
                    {cameraState === 'opening' ? (
                      <><Loader size={24} className="animate-spin mb-2" /><p className="text-xs">Opening camera...</p></>
                    ) : cameraState === 'denied' ? (
                      <p className="text-xs text-red-400">Camera permission denied. Allow access and retry.</p>
                    ) : cameraState === 'busy' ? (
                      <p className="text-xs text-amber-400">Camera busy — close other apps and retry.</p>
                    ) : cameraState === 'error' ? (
                      <p className="text-xs text-red-400">{cameraError || 'Camera error'}</p>
                    ) : (
                      <p className="text-xs">{cameraError || 'Camera off'}</p>
                    )}
                  </div>
                )}
                {capturing && !live && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-gray-200 text-sm">
                    <Loader size={20} className="animate-spin mr-2" /> Starting live preview…
                  </div>
                )}
                {capturing && live && (
                  <div className="absolute top-2 left-2"><Badge variant="green">● LIVE</Badge></div>
                )}
              </div>
              {(cameraState === 'error' || cameraState === 'denied' || cameraState === 'busy') && (
                <button onClick={startCamera} className="btn-secondary w-full flex items-center justify-center gap-2">
                  <RefreshCw size={16} /> Retry Camera
                </button>
              )}
              <div className="flex gap-2">
                {!capturing ? (
                  <button onClick={startCamera} className="btn-primary flex-1 flex items-center justify-center gap-2"><Camera size={16} /> Enable Camera</button>
                ) : (
                  <>
                    <button onClick={scan} disabled={scanning || !live} className="btn-primary flex-1 flex items-center justify-center gap-2">{scanning ? <span className="animate-pulse">Scanning...</span> : <><UserCheck size={16} /> Scan Face</>}</button>
                    <button onClick={stopSession} className="btn-danger flex items-center justify-center gap-2"><Square size={16} /> Close</button>
                  </>
                )}
              </div>
              <button onClick={() => setManualOpen(true)} disabled={!sessionStatus.includes('active')} className="btn-secondary w-full flex items-center justify-center gap-2"><Users size={16} /> Manual Attendance</button>
              {!sessionStatus.includes('active') && sessionId && (
                <button onClick={() => { setSessionId(null); setSelectorOpen(true) }} className="btn-secondary w-full">New Session</button>
              )}
            </div>
          )}
        </div>
        <div className="card p-5">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
              <h3 className="font-semibold flex items-center gap-2"><UserCheck size={18} /> Live Attendance</h3>
              <p className="text-xs text-gray-400 mt-1">Session #{sessionId || '-'}</p>
            </div>
            <div className="text-right text-sm">
              <p className="font-semibold">Marked: {counts.marked || records.length}</p>
              <p className="text-emerald-600 dark:text-emerald-400">Present: {presentCount}</p>
              <p className="text-red-600 dark:text-red-400">Absent: {absentCount}</p>
              <p className="text-gray-400">Total: {totalStudents}</p>
            </div>
          </div>
          {records.length === 0 ? <p className="text-gray-400 text-sm text-center py-8">No students marked yet</p> : (
            <div className="max-h-[400px] overflow-y-auto space-y-3">
              {records.map((r, index) => (
                <div key={r.id} className="border-b border-gray-100 dark:border-gray-800 pb-3 last:border-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      {r.profile_photo ? <img src={r.profile_photo} alt="" className="w-9 h-9 rounded-full object-cover" /> : <div className="w-9 h-9 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-xs font-semibold">{(r.student_name || '?').slice(0, 1)}</div>}
                      <div className="min-w-0">
                        <p className="font-medium text-sm">{index + 1}. {r.student_name}</p>
                        <p className="text-xs text-gray-400">Student ID: {r.student_id || '-'}</p>
                        {(r.subject || r.class_name) && <p className="text-xs text-gray-400">{r.subject || 'Class'}{r.class_name ? ` - ${r.class_name}` : ''}</p>}
                        {typeof r.confidence === 'number' && r.confidence > 0 && <p className="text-xs text-gray-400">Confidence: {(r.confidence * 100).toFixed(0)}%</p>}
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge variant={r.status === 'present' ? 'green' : 'red'}>{r.status}</Badge>
                      <p className="text-xs text-gray-400 mt-1">{r.time || '-'}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <Modal open={manualOpen} onClose={() => setManualOpen(false)} title="Manual Attendance">
        <div className="space-y-2 max-h-[400px] overflow-y-auto">
          {students.length === 0 ? <p className="text-gray-400 text-sm text-center py-6">No students in your department</p> :
            students.map(s => {
              const marked = markedIds.has(String(s.student_id || s.full_name))
              return (
                <div key={s.id} className="flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800">
                  <div>
                    <p className="font-medium text-sm">{s.full_name}</p>
                    <p className="text-xs text-gray-400">{s.student_id}</p>
                  </div>
                  {marked ? <Badge variant="green">Marked</Badge> : <button onClick={() => manualMark(s.id)} className="btn-primary text-sm py-1.5 px-3">Mark Present</button>}
                </div>
              )
            })}
        </div>
      </Modal>
    </AttendanceLayout>
  )
}
