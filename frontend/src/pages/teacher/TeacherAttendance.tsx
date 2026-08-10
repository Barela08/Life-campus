import React, { useEffect, useRef, useState } from 'react'
import api from '../../lib/api'
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
  const [sessionId, setSessionId] = useState<number | null>(null)
  const [sessionStatus, setSessionStatus] = useState('')
  const [records, setRecords] = useState<any[]>([])
  const [capturing, setCapturing] = useState(false)
  const [live, setLive] = useState(false)
  const [cameraState, setCameraState] = useState<CameraState>('off')
  const [cameraError, setCameraError] = useState('')
  const [scanning, setScanning] = useState(false)
  const [departmentId, setDepartmentId] = useState('')
  const [classId, setClassId] = useState('')
  const [section, setSection] = useState('')
  const [loading, setLoading] = useState(true)
  const [selectorOpen, setSelectorOpen] = useState(!sessionId)
  const [manualOpen, setManualOpen] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)

  const load = async () => {
    setLoading(true)
    try {
      const [d, c, sec] = await Promise.all([
        api.get('/teacher/departments'),
        api.get('/teacher/classes'),
        api.get('/teacher/sections'),
      ])
      setDepartments(d.data); setClasses(c.data); setSections(sec.data)
    } catch { toast.error('Failed to load') } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const startSession = async () => {
    if (!departmentId || !classId) { toast.error('Select department and class'); return }
    try {
      const res = await api.post('/attendance/start', {
        department_id: +departmentId, class_id: +classId, section, camera_id: 'teacher-cam',
      })
      setSessionId(res.data.session_id); setSessionStatus('active'); setSelectorOpen(false)
      toast.success('Attendance session started')
      const st = await api.get('/teacher/students')
      setStudents(st.data)
    } catch (err: any) { toast.error(err.response?.data?.detail || 'Failed to start') }
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

  const scan = async () => {
    if (!sessionId || scanning || !live) return
    if (!cameraService.isFrameReady()) return
    const b64 = cameraService.captureFrame()
    if (!b64) return
    setScanning(true)
    try {
      const res = await api.post('/face/match', { session_id: sessionId, image_b64: b64, camera_id: 'teacher-cam' })
      const d = res.data
      if (d.matched) {
        if (d.duplicate) toast(`${d.student}: Attendance Already Recorded`, { icon: '⚠️' })
        else { toast.success(`${d.student} marked present (${(d.confidence * 100).toFixed(0)}%)`); await loadRecords() }
      } else toast.error(d.reason || 'Unknown face')
    } catch (err: any) { toast.error(err.response?.data?.detail || 'Scan failed') } finally { setScanning(false) }
  }

  const loadRecords = async () => {
    if (!sessionId) return
    try { const res = await api.get(`/attendance/session/${sessionId}`); setRecords(res.data.records) } catch {}
  }
  useEffect(() => { if (sessionId) loadRecords() }, [sessionId])
  useEffect(() => { const i = setInterval(() => { if (sessionId) loadRecords() }, 5000); return () => clearInterval(i) }, [sessionId])

  const manualMark = async (studentId: number) => {
    try { await api.post('/attendance/manual', { session_id: sessionId, student_id: studentId, status: 'present' }); toast.success('Marked present'); loadRecords() }
    catch (err: any) { toast.error(err.response?.data?.detail || 'Failed') }
  }

  const stopSession = async () => {
    try {
      await api.post(`/attendance/stop/${sessionId}`, {})
      setSessionStatus('closed')
      stopCamera()
      toast.success('Session closed. Absentees marked.')
    } catch (err: any) { toast.error(err.response?.data?.detail || 'Failed to close') }
  }

  const markedIds = new Set(records.map((r: any) => r.student_name))

  if (loading) return <AttendanceLayout><Loading /></AttendanceLayout>

  return (
    <AttendanceLayout>
      <PageHeader title="Start Attendance" subtitle="Select department, class and section to begin" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-5">
          {selectorOpen ? (
            <div className="space-y-4">
              <h3 className="font-semibold flex items-center gap-2"><Play size={18} className="text-primary-500" /> Start New Session</h3>
              <div><label className="label">Department</label>
                <select className="input" value={departmentId} onChange={e => setDepartmentId(e.target.value)}>
                  <option value="">Select department</option>{departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select></div>
              <div><label className="label">Class</label>
                <select className="input" value={classId} onChange={e => setClassId(e.target.value)}>
                  <option value="">Select class</option>{classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select></div>
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
          <h3 className="font-semibold mb-4 flex items-center gap-2"><UserCheck size={18} /> Marked Students ({records.length})</h3>
          {records.length === 0 ? <p className="text-gray-400 text-sm text-center py-8">No students marked yet</p> : (
            <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
              <table className="w-full">
                <thead className="sticky top-0 bg-white dark:bg-gray-900"><tr className="border-b border-gray-100 dark:border-gray-800">
                  <th className="table-header">Student</th><th className="table-header">Status</th><th className="table-header">Time</th><th className="table-header">Confidence</th>
                </tr></thead>
                <tbody>
                  {records.map(r => (
                    <tr key={r.id} className="border-b border-gray-50">
                      <td className="table-cell font-medium">{r.student_name}</td>
                      <td className="table-cell"><Badge variant={r.status === 'present' ? 'green' : 'red'}>{r.status}</Badge></td>
                      <td className="table-cell">{r.time}</td>
                      <td className="table-cell">{(r.confidence * 100).toFixed(0)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <Modal open={manualOpen} onClose={() => setManualOpen(false)} title="Manual Attendance">
        <div className="space-y-2 max-h-[400px] overflow-y-auto">
          {students.length === 0 ? <p className="text-gray-400 text-sm text-center py-6">No students in your department</p> :
            students.map(s => {
              const marked = markedIds.has(s.full_name)
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