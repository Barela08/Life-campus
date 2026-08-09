import React, { useEffect, useRef, useState } from 'react'
import api from '../../lib/api'
import AdminLayout from '../../components/AdminLayout'
import { PageHeader, Badge, Loading, Modal } from '../../components/ui'
import toast from 'react-hot-toast'
import { Camera, CheckCircle2, RotateCcw, RefreshCw, Search, ChevronRight, XCircle, Trash2, UserCheck } from 'lucide-react'
import { cameraService, attachCameraVideo, CameraState } from '../../lib/camera'

const ANGLES = ['front', 'left', 'right', 'up', 'down', 'smile', 'normal']

export default function AdminFace() {
  const [students, setStudents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [captureId, setCaptureId] = useState<number | null>(null)
  const [captureStudent, setCaptureStudent] = useState<any>(null)
  const [captureOpen, setCaptureOpen] = useState(false)
  const [angleIdx, setAngleIdx] = useState(0)
  const [capturing, setCapturing] = useState(false)
  const [cameraState, setCameraState] = useState<CameraState>('off')
  const [cameraError, setCameraError] = useState('')
  const [capturedAngles, setCapturedAngles] = useState<string[]>([])
  const [captureStatus, setCaptureStatus] = useState('')
  const [captureError, setCaptureError] = useState('')
  const [saving, setSaving] = useState(false)
  const [registrationComplete, setRegistrationComplete] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)

  const load = async () => {
    setLoading(true)
    try {
      const res = await api.get('/admin/students')
      setStudents(res.data)
    } catch { toast.error('Failed to load students') } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const approve = async (id: number) => {
    try { await api.post(`/face/approve/${id}`); toast.success('Face approved'); load() }
    catch (err: any) { toast.error(err.response?.data?.detail || 'Failed') }
  }

  const reset = async (id: number) => {
    try { await api.post(`/face/reset/${id}`); toast.success('Face data reset'); load() }
    catch (err: any) { toast.error(err.response?.data?.detail || 'Failed') }
  }

  const openCapture = async (s: any) => {
    setCaptureStudent(s); setCaptureId(s.id); setAngleIdx(0); setCapturedAngles([])
    setCaptureStatus(''); setCaptureError(''); setRegistrationComplete(false); setCaptureOpen(true)
    // Load existing registered angles
    try {
      const res = await api.get(`/face/status/${s.id}`)
      setCapturedAngles(res.data.registered_angles || [])
      if (res.data.complete) setRegistrationComplete(true)
    } catch {}
    setTimeout(() => startCaptureCam(), 100)
  }

  const closeCapture = () => {
    cameraService.stopCamera()
    setCaptureOpen(false); setCameraState('off'); setCaptureStudent(null)
  }

  const startCaptureCam = async () => {
    cameraService.setCallbacks({
      onStateChange: (state, err) => {
        setCameraState(state)
        setCameraError(err || '')
        setCapturing(state === 'on')
      },
    })
    cameraService.attachVideo(videoRef.current)
    const ok = await cameraService.startCamera()
    if (!ok) {
      setCameraState(cameraService.getState())
      setCameraError(cameraService.getError())
    }
  }

  // Re-attach video when it mounts
  useEffect(() => {
    if (captureOpen) {
      cameraService.attachVideo(videoRef.current)
    }
  }, [captureOpen, capturing])

  const captureAngle = async () => {
    if (!captureId) return
    if (!cameraService.isFrameReady()) {
      setCaptureError('Camera frame is not ready. Please wait.')
      return
    }
    const angle = ANGLES[angleIdx]
    const b64 = cameraService.captureFrame()
    if (!b64) {
      setCaptureError('Camera frame is not ready. Please wait.')
      return
    }
    setSaving(true)
    setCaptureError('')
    setCaptureStatus('Detecting face...')
    try {
      const res = await api.post('/face/register', { student_id: +captureId, angle, image_b64: b64 })
      setCapturedAngles(a => [...new Set([...a, angle])])
      setCaptureStatus(`✓ ${angle} angle captured`)
      toast.success(`${angle} angle captured`)
      if (angleIdx < ANGLES.length - 1) {
        setAngleIdx(angleIdx + 1)
      } else {
        setRegistrationComplete(true)
        setCaptureStatus('Face Registration Complete')
        toast.success('All angles captured!')
      }
    } catch (err: any) {
      const detail = err.response?.data?.detail || 'Face registration failed.'
      setCaptureError(detail)
      setCaptureStatus('')
      toast.error(detail)
    } finally { setSaving(false) }
  }

  const retakeAngle = (angle: string) => {
    const idx = ANGLES.indexOf(angle)
    if (idx >= 0) {
      setAngleIdx(idx)
      setCapturedAngles(a => a.filter(x => x !== angle))
      setRegistrationComplete(false)
      setCaptureError('')
      setCaptureStatus(`Retaking ${angle} angle...`)
    }
  }

  const deleteRegistration = async () => {
    if (!captureId) return
    if (!confirm('Delete all face data for this student?')) return
    try {
      await api.post(`/face/reset/${captureId}`)
      setCapturedAngles([])
      setRegistrationComplete(false)
      setAngleIdx(0)
      setCaptureStatus('')
      toast.success('Face registration deleted')
      load()
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to delete')
    }
  }

  const registerAgain = () => {
    setCapturedAngles([])
    setRegistrationComplete(false)
    setAngleIdx(0)
    setCaptureStatus('')
    setCaptureError('')
  }

  const filtered = students.filter((s: any) => (s.full_name || '').toLowerCase().includes(search.toLowerCase()) || (s.student_id || '').toLowerCase().includes(search.toLowerCase()))

  const statusColor: Record<string, 'green' | 'yellow' | 'red' | 'gray' | 'blue'> = { approved: 'green', pending: 'yellow', not_registered: 'red' }

  return (
    <AdminLayout>
      <PageHeader title="Face Registration" subtitle="Capture multi-angle faces and approve student registrations" />
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="input pl-9" placeholder="Search by name or student ID..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <button onClick={load} className="btn-secondary flex items-center gap-2"><RefreshCw size={16} /> Refresh</button>
      </div>
      {loading ? <Loading /> : (
        <div className="card p-5">
          <h3 className="font-semibold mb-4 flex items-center gap-2"><Camera size={18} /> Student Face Registrations ({filtered.length})</h3>
          {filtered.length === 0 ? <p className="text-gray-400 text-sm text-center py-8">No students found</p> : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead><tr className="border-b border-gray-100 dark:border-gray-800">
                  <th className="table-header">Student</th><th className="table-header">ID</th><th className="table-header">Status</th><th className="table-header">Actions</th>
                </tr></thead>
                <tbody>
                  {filtered.map((s: any) => (
                    <tr key={s.id} className="border-b border-gray-50">
                      <td className="table-cell font-medium">{s.full_name}</td>
                      <td className="table-cell">{s.student_id}</td>
                      <td className="table-cell"><Badge variant={statusColor[s.face_status] || 'gray'}>{s.face_status}</Badge></td>
                      <td className="table-cell">
                        <div className="flex gap-2 flex-wrap">
                          <button onClick={() => openCapture(s)} className="btn-secondary text-sm py-1.5 px-3 flex items-center gap-1"><Camera size={14} /> Capture Faces</button>
                          {s.face_status !== 'approved' && (
                            <button onClick={() => approve(s.id)} className="btn-primary text-sm py-1.5 px-3 flex items-center gap-1"><CheckCircle2 size={14} /> Approve</button>
                          )}
                          <button onClick={() => reset(s.id)} className="btn-secondary text-sm py-1.5 px-3 flex items-center gap-1"><RotateCcw size={14} /> Reset</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Multi-angle capture modal */}
      <Modal open={captureOpen} onClose={closeCapture} title={`Face Capture — ${captureStudent?.full_name || ''}`}>
        <div className="space-y-4">
          {/* Progress indicator */}
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">Progress: {capturedAngles.length}/{ANGLES.length}</span>
            {capturedAngles.length > 0 && (
              <span className="text-xs text-emerald-500">{capturedAngles.length}/{ANGLES.length} angles captured</span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {ANGLES.map((a, i) => (
              <span key={a} className={`px-2 py-1 rounded-full text-xs font-medium ${i === angleIdx ? 'bg-primary-500 text-white' : capturedAngles.includes(a) ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400' : 'bg-gray-100 text-gray-500 dark:bg-gray-800'}`}>
                {a}{capturedAngles.includes(a) ? ' ✓' : ''}
              </span>
            ))}
          </div>

          {/* Camera view */}
          <div className="rounded-xl overflow-hidden bg-black aspect-video relative">
            {capturing && cameraState === 'on' ? (
              <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-500 flex-col">
                <Camera size={40} />
                <p className="text-xs mt-2">
                  {cameraState === 'error' ? cameraError || 'Camera error' :
                   cameraState === 'denied' ? 'Camera permission denied' :
                   cameraState === 'busy' ? 'Camera busy' :
                   cameraState === 'notfound' ? 'No camera found' :
                   cameraState === 'unsupported' ? 'Camera not supported' :
                   'Starting camera…'}
                </p>
              </div>
            )}
            <div className="absolute top-2 left-2"><Badge variant="blue">Current: {ANGLES[angleIdx]}</Badge></div>
          </div>

          {/* Status / Error messages */}
          {captureStatus && <p className="text-sm text-emerald-600 text-center">{captureStatus}</p>}
          {captureError && <p className="text-sm text-red-500 text-center">{captureError}</p>}

          {!registrationComplete ? (
            <>
              <p className="text-xs text-gray-400 text-center">Position the student's face for the <b className="text-primary-400">{ANGLES[angleIdx]}</b> angle, then capture.</p>
              <div className="flex gap-2">
                <button onClick={captureAngle} disabled={cameraState !== 'on' || saving} className="btn-primary flex-1 flex items-center justify-center gap-2">
                  <Camera size={16} /> {saving ? 'Processing...' : `Capture ${ANGLES[angleIdx]}`}
                </button>
                <button onClick={closeCapture} className="btn-secondary">Close</button>
              </div>
            </>
          ) : (
            <>
              {/* Registration Complete */}
              <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center">
                    <UserCheck size={20} className="text-white" />
                  </div>
                  <div>
                    <p className="font-semibold text-emerald-700 dark:text-emerald-400">Face Registration Complete</p>
                    <p className="text-xs text-emerald-600 dark:text-emerald-500">{captureStudent?.full_name}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs text-gray-600 dark:text-gray-400">
                  <div><span className="text-gray-400">Roll Number:</span> {captureStudent?.roll_number || '-'}</div>
                  <div><span className="text-gray-400">Department:</span> {captureStudent?.department_id || '-'}</div>
                  <div><span className="text-gray-400">Class:</span> {captureStudent?.class_id || '-'}</div>
                  <div><span className="text-gray-400">Section:</span> {captureStudent?.section || '-'}</div>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => retakeAngle(ANGLES[angleIdx])} className="btn-secondary flex-1 flex items-center justify-center gap-2">
                  <RotateCcw size={16} /> Retake Angle
                </button>
                <button onClick={deleteRegistration} className="btn-danger flex-1 flex items-center justify-center gap-2">
                  <Trash2 size={16} /> Delete Registration
                </button>
                <button onClick={registerAgain} className="btn-primary flex-1 flex items-center justify-center gap-2">
                  <RefreshCw size={16} /> Register Again
                </button>
              </div>
            </>
          )}
        </div>
      </Modal>
    </AdminLayout>
  )
}