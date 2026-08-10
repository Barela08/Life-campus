import React, { useEffect, useState } from 'react'
import api from '../../lib/api'
import AdminLayout from '../../components/AdminLayout'
import { PageHeader, Modal, SearchInput, Badge, Empty, Loading } from '../../components/ui'
import toast from 'react-hot-toast'
import { Plus, Pencil, Trash2, Camera, CheckCircle, RotateCcw, UserPlus, RefreshCw, Loader, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react'
import { cameraService, CameraState } from '../../lib/camera'

interface Student {
  id: number
  student_id: string
  full_name: string
  roll_number: string
  section: string | null
  department_id: number
  course_id: number
  semester_id: number
  class_id: number
  email: string
  phone: string
  parent_email: string | null
  profile_photo: string
  face_status: string
}

interface Dept { id: number; name: string }
interface Course { id: number; name: string }
interface Semester { id: number; name: string }
interface Klass { id: number; name: string }

const ANGLES = ['front', 'left', 'right', 'up', 'down', 'smile', 'normal']

export default function Students() {
  const [students, setStudents] = useState<Student[]>([])
  const [depts, setDepts] = useState<Dept[]>([])
  const [courses, setCourses] = useState<Course[]>([])
  const [semesters, setSemesters] = useState<Semester[]>([])
  const [classes, setClasses] = useState<Klass[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState(false)
  const [faceModal, setFaceModal] = useState<Student | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<any>({})

  const load = async () => {
    setLoading(true)
    try {
      const [s, d, c, se, cl] = await Promise.all([
        api.get('/admin/students'), api.get('/admin/departments'), api.get('/admin/courses'),
        api.get('/admin/semesters'), api.get('/admin/classes'),
      ])
      setStudents(s.data); setDepts(d.data); setCourses(c.data); setSemesters(se.data); setClasses(cl.data)
    } catch (e) { toast.error('Failed to load students') } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const openNew = () => { setForm({ password: '1234' }); setModal(true) }
  const openEdit = (s: Student) => { setForm({ ...s }); setModal(true) }

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      if (form.id) {
        const { id, student_id, full_name, roll_number, section, department_id, course_id, semester_id, class_id, phone, parent_email } = form
        await api.put(`/admin/students/${id}`, { full_name, roll_number, section, department_id: +department_id, course_id: +course_id, semester_id: +semester_id, class_id: +class_id, phone, parent_email })
      } else {
        await api.post('/admin/students', form)
      }
      toast.success(form.id ? 'Student updated' : 'Student added')
      setModal(false)
      load()
    } catch (err: any) { toast.error(err.response?.data?.detail || 'Failed to save') } finally { setSaving(false) }
  }

  const remove = async (s: Student) => {
    if (!confirm(`Delete ${s.full_name}?`)) return
    try { await api.delete(`/admin/students/${s.id}`); toast.success('Student deleted'); load() }
    catch { toast.error('Failed to delete') }
  }

  const approveFace = async (s: Student) => {
    try { await api.post(`/face/approve/${s.id}`); toast.success('Face approved'); load() } catch { toast.error('No face embeddings') }
  }

  const resetFace = async (s: Student) => {
    if (!confirm(`Reset face data for ${s.full_name}?`)) return
    try { await api.post(`/face/reset/${s.id}`); toast.success('Face data reset'); load() } catch { toast.error('Failed to reset') }
  }

  const filtered = students.filter(s =>
    s.full_name.toLowerCase().includes(search.toLowerCase()) ||
    s.student_id.toLowerCase().includes(search.toLowerCase()) ||
    s.roll_number.toLowerCase().includes(search.toLowerCase())
  )

  const deptName = (id: number) => depts.find(d => d.id === id)?.name || '-'
  const className = (id: number) => classes.find(c => c.id === id)?.name || '-'

  return (
    <AdminLayout>
      <PageHeader
        title="Students"
        subtitle="Manage students and face registration"
        actions={<button onClick={openNew} className="btn-primary flex items-center gap-2"><Plus size={16} /> Add Student</button>}
      />
      <div className="mb-4"><SearchInput value={search} onChange={setSearch} placeholder="Search students..." /></div>
      {loading ? <Loading /> : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
                  <th className="table-header">Student</th>
                  <th className="table-header">ID / Roll</th>
                  <th className="table-header">Department</th>
                  <th className="table-header">Class</th>
                  <th className="table-header">Face Status</th>
                  <th className="table-header">Contact</th>
                  <th className="table-header text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? <tr><td colSpan={7}><Empty message="No students found" /></td></tr> :
                  filtered.map(s => (
                    <tr key={s.id} className="border-b border-gray-50 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="table-cell">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-primary-100 dark:bg-primary-500/20 flex items-center justify-center text-primary-700 font-semibold overflow-hidden">
                            {s.profile_photo ? <img src={`/uploads/${s.profile_photo.split('/').pop()}`} className="w-full h-full object-cover" /> : s.full_name.charAt(0)}
                          </div>
                          <span className="font-medium">{s.full_name}</span>
                        </div>
                      </td>
                      <td className="table-cell text-xs">{s.student_id}<br /><span className="text-gray-400">Roll: {s.roll_number}</span></td>
                      <td className="table-cell">{deptName(s.department_id)}</td>
                      <td className="table-cell">{className(s.class_id)}</td>
                      <td className="table-cell">
                        <Badge variant={s.face_status === 'approved' ? 'green' : s.face_status === 'pending' ? 'yellow' : 'red'}>{s.face_status}</Badge>
                      </td>
                      <td className="table-cell text-xs">{s.email}</td>
                      <td className="table-cell">
                        <div className="flex justify-end gap-1">
                          <button onClick={() => setFaceModal(s)} title="Face Registration" className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"><Camera size={16} /></button>
                          {s.face_status === 'pending' && <button onClick={() => approveFace(s)} title="Approve Face" className="p-1.5 rounded-lg hover:bg-emerald-50 text-emerald-600"><CheckCircle size={16} /></button>}
                          <button onClick={() => resetFace(s)} title="Reset Face" className="p-1.5 rounded-lg hover:bg-amber-50 text-amber-600"><RotateCcw size={16} /></button>
                          <button onClick={() => openEdit(s)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"><Pencil size={16} /></button>
                          <button onClick={() => remove(s)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-500"><Trash2 size={16} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title={form.id ? 'Edit Student' : 'Add Student'} wide>
        <form onSubmit={save} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
<div><label className="label">Full Name</label><input className="input" required value={form.full_name || ''} onChange={e => setForm({ ...form, full_name: e.target.value })} /></div>
          <div><label className="label">Student ID</label><input className="input" required disabled={!!form.id} value={form.student_id || ''} onChange={e => setForm({ ...form, student_id: e.target.value })} /></div>
          <div><label className="label">Roll Number</label><input className="input" required value={form.roll_number || ''} onChange={e => setForm({ ...form, roll_number: e.target.value })} /></div>
          <div><label className="label">Section</label><input className="input" placeholder="e.g. A or B" value={form.section || ''} onChange={e => setForm({ ...form, section: e.target.value })} /></div>
          <div><label className="label">Department</label>
            <select className="input" value={form.department_id || ''} onChange={e => setForm({ ...form, department_id: e.target.value })}>
              <option value="">Select</option>{depts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select></div>
          <div><label className="label">Course</label>
            <select className="input" value={form.course_id || ''} onChange={e => setForm({ ...form, course_id: e.target.value })}>
              <option value="">Select</option>{courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select></div>
          <div><label className="label">Semester</label>
            <select className="input" value={form.semester_id || ''} onChange={e => setForm({ ...form, semester_id: e.target.value })}>
              <option value="">Select</option>{semesters.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select></div>
          <div><label className="label">Class</label>
            <select className="input" value={form.class_id || ''} onChange={e => setForm({ ...form, class_id: e.target.value })}>
              <option value="">Select</option>{classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select></div>
          <div><label className="label">Email</label><input className="input" type="email" required value={form.email || ''} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
          <div><label className="label">Phone</label><input className="input" value={form.phone || ''} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
          <div><label className="label">Parent Email (optional)</label><input className="input" type="email" value={form.parent_email || ''} onChange={e => setForm({ ...form, parent_email: e.target.value })} /></div>
          {!form.id && <div><label className="label">Default Password</label><input className="input" value={form.password || '1234'} onChange={e => setForm({ ...form, password: e.target.value })} /></div>}
          <div className="sm:col-span-2 flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setModal(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary flex items-center gap-2"><UserPlus size={16} /> {saving ? 'Saving...' : 'Save'}</button>
          </div>
        </form>
      </Modal>

      <FaceRegistrationModal student={faceModal} onClose={() => setFaceModal(null)} onDone={() => { setFaceModal(null); load() }} />
    </AdminLayout>
  )
}

// ============ Face Registration Modal ============
function FaceRegistrationModal({ student, onClose, onDone }: { student: Student | null; onClose: () => void; onDone: () => void }) {
  // Camera / UI state
  const [capturing, setCapturing] = useState(false)
  const [live, setLive] = useState(false)
  const [cameraState, setCameraState] = useState<CameraState>('off')
  const [cameraError, setCameraError] = useState('')
  const [startedAt, setStartedAt] = useState<number | null>(null)
  const [startTimeout, setStartTimeout] = useState(false)

  // Registration state
  const [angle, setAngle] = useState('front')
  const [registered, setRegistered] = useState<string[]>([])
  const [processing, setProcessing] = useState(false)
  const [lastResult, setLastResult] = useState<{ ok: boolean; message: string } | null>(null)

  const videoRef = React.useRef<HTMLVideoElement>(null)
  const startTimeoutRef = React.useRef<number | null>(null)

  // Load existing registered angles from backend when modal opens
  useEffect(() => {
    if (student) {
      setRegistered([])
      setAngle('front')
      setLastResult(null)
      setCameraError('')
      setStartTimeout(false)
      api.get(`/face/status/${student.id}`)
        .then(res => {
          const angles: string[] = res.data.registered_angles || []
          setRegistered(angles)
          // Auto-select first missing angle
          const firstMissing = ANGLES.find(a => !angles.includes(a))
          if (firstMissing) setAngle(firstMissing)
        })
        .catch(() => {})
    }
  }, [student])

  // Cleanup on unmount / modal close
  useEffect(() => {
    return () => {
      if (startTimeoutRef.current) window.clearTimeout(startTimeoutRef.current)
      cameraService.setCallbacks({})
      cameraService.stopCamera()
      cameraService.stopLiveMonitor()
    }
  }, [])

  // Camera timeout: if not live within 10s, show error
  useEffect(() => {
    if (capturing && !live && startedAt) {
      if (startTimeoutRef.current) window.clearTimeout(startTimeoutRef.current)
      startTimeoutRef.current = window.setTimeout(() => {
        if (!live) setStartTimeout(true)
      }, 10000)
    }
    return () => { if (startTimeoutRef.current) window.clearTimeout(startTimeoutRef.current) }
  }, [capturing, live, startedAt])

  const startCamera = async () => {
    setStartTimeout(false)
    setCameraError('')
    setLastResult(null)
    cameraService.setCallbacks({
      onStateChange: (state, err) => {
        setCameraState(state)
        setCameraError(err || '')
        setCapturing(state === 'on')
      },
      onLive: (l) => {
        setLive(l)
        if (l) setStartTimeout(false)
      },
    })
    cameraService.attachVideo(videoRef.current)
    cameraService.startLiveMonitor()
    setStartedAt(Date.now())
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
    if (startTimeoutRef.current) window.clearTimeout(startTimeoutRef.current)
    setStartTimeout(false)
  }

  // Re-attach stream when video mounts (black-screen race fix)
  useEffect(() => {
    if (capturing) {
      cameraService.attachVideo(videoRef.current)
    }
  }, [capturing, live])

  const capture = async () => {
    if (!student || !cameraService.isFrameReady() || !live) {
      setLastResult({ ok: false, message: 'Camera is not ready. Please wait.' })
      return
    }
    const b64 = cameraService.captureFrame()
    if (!b64) {
      setLastResult({ ok: false, message: 'Camera frame is not ready. Please wait.' })
      return
    }
    setProcessing(true)
    setLastResult(null)
    try {
      // Send to existing backend face-registration endpoint.
      // Backend validates face, generates embedding, saves to DB.
      // Only mark as captured AFTER backend confirms success.
      const res = await api.post('/face/register', { student_id: student.id, angle, image_b64: b64 })
      const updated = [...new Set([...registered, angle])]
      setRegistered(updated)
      setLastResult({ ok: true, message: `✓ ${angle} angle registered successfully` })
      toast.success(`${angle} face registered`)
      // Move to next missing angle
      const nextMissing = ANGLES.find(a => !updated.includes(a))
      if (nextMissing) {
        setAngle(nextMissing)
      }
    } catch (err: any) {
      const detail = err.response?.data?.detail || 'Registration failed. Please try again.'
      setLastResult({ ok: false, message: detail })
      toast.error(detail)
    } finally {
      setProcessing(false)
    }
  }

  if (!student) return null

  const complete = ANGLES.every(a => registered.includes(a))
  const progress = registered.length

  // Human-readable camera error labels
  const camErrorMessage =
    cameraState === 'denied' ? 'Camera permission denied. Allow camera access in browser settings and try again.' :
    cameraState === 'notfound' ? 'No camera was detected on this device.' :
    cameraState === 'busy' ? 'Camera is being used by another application. Close other camera apps and try again.' :
    cameraState === 'unsupported' ? 'Camera not supported in this browser.' :
    cameraState === 'error' ? (cameraError || 'Unable to start camera. Please try again.') :
    startTimeout ? 'Camera is taking too long to start.' : ''

  return (
    <Modal open={!!student} onClose={onClose} title={`Face Registration - ${student.full_name}`} wide>
      <div className="space-y-4">
        {/* Student info */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <p className="text-sm text-gray-500">Roll No: {student.roll_number || '-'} • {student.student_id}</p>
          </div>
          <Badge variant={complete ? 'green' : registered.length > 0 ? 'yellow' : 'red'}>
            {complete ? 'Complete' : `${progress}/${ANGLES.length} angles`}
          </Badge>
        </div>

        {/* Camera controls */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">Capture multiple face angles</p>
          {!capturing ? (
            <button onClick={startCamera} className="btn-primary flex items-center gap-2"><Camera size={16} /> Start Camera</button>
          ) : (
            <div className="flex items-center gap-2">
              <Badge variant={live ? 'green' : 'yellow'}>{live ? '● Camera Live' : 'Starting…'}</Badge>
              <button onClick={stopCamera} className="btn-secondary">Stop Camera</button>
            </div>
          )}
        </div>

        {/* Camera view — video ALWAYS rendered so stream can always bind */}
        <div className="relative rounded-xl overflow-hidden bg-black aspect-video">
          <video
            ref={(el) => {
              videoRef.current = el
              cameraService.attachVideo(el)
            }}
            autoPlay
            playsInline
            muted
            className="absolute inset-0 w-full h-full object-cover"
          />
          {!capturing && (
            <div className="absolute inset-0 w-full h-full flex flex-col items-center justify-center text-gray-500 bg-black">
              <Camera size={32} className="mb-2 opacity-40" />
              <p className="text-xs">Camera off — click Start Camera</p>
            </div>
          )}
          {capturing && !live && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-gray-200 text-sm">
              <Loader size={20} className="animate-spin mr-2" />
              {startTimeout ? 'Camera is taking too long to start.' : 'Starting live preview…'}
            </div>
          )}
          {capturing && live && (
            <div className="absolute top-2 left-2"><Badge variant="green">● LIVE</Badge></div>
          )}
        </div>

        {/* Camera error + retry */}
        {camErrorMessage && (
          <div className="p-3 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 text-sm flex items-center gap-2">
            <AlertTriangle size={16} />
            <span className="flex-1">{camErrorMessage}</span>
          </div>
        )}
        {(camErrorMessage || !live) && capturing && (
          <button onClick={startCamera} className="btn-secondary w-full flex items-center justify-center gap-2">
            <RefreshCw size={16} /> Retry Camera
          </button>
        )}

        {/* Angle selector */}
        <div>
          <label className="label">Select Angle</label>
          <div className="flex flex-wrap gap-2">
            {ANGLES.map(a => (
              <button
                key={a}
                onClick={() => setAngle(a)}
                disabled={processing}
                className={`px-3 py-1.5 rounded-lg text-sm capitalize transition flex items-center gap-1.5 ${
                  angle === a ? 'bg-primary-600 text-white' :
                  registered.includes(a) ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400' :
                  'bg-gray-100 dark:bg-gray-800 hover:bg-gray-200'
                }`}
              >
                {registered.includes(a) ? <CheckCircle2 size={14} /> : <span className="w-3.5 h-3.5 rounded-full border-2 border-current opacity-50" />}
                {a}
              </button>
            ))}
          </div>
        </div>

        {/* Result message */}
        {lastResult && (
          <p className={`text-sm flex items-center gap-2 ${lastResult.ok ? 'text-emerald-600' : 'text-red-500'}`}>
            {lastResult.ok ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
            {lastResult.message}
          </p>
        )}

        {/* Capture button */}
        {capturing && live && !complete && (
          <button
            onClick={capture}
            disabled={processing}
            className="btn-primary w-full flex items-center justify-center gap-2"
          >
            {processing ? <Loader size={16} className="animate-spin" /> : <Camera size={16} />}
            {processing ? 'Processing face...' : `Capture ${angle} face`}
          </button>
        )}

        {/* Complete UI */}
        {complete && (
          <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-center">
            <CheckCircle2 size={32} className="mx-auto mb-2 text-emerald-500" />
            <p className="font-semibold text-emerald-700 dark:text-emerald-400">✓ Face Registration Complete</p>
            <p className="text-xs text-emerald-600 dark:text-emerald-500 mt-1">{progress}/{ANGLES.length} angles registered</p>
          </div>
        )}

        <div className="flex gap-2">
          <button onClick={onDone} className="btn-primary flex-1">Done</button>
          {capturing && <button onClick={stopCamera} className="btn-secondary">Stop Camera</button>}
        </div>
      </div>
    </Modal>
  )
}