import React, { useEffect, useRef, useState, useCallback } from 'react'
import api from '../../lib/api'
import StudentLayout from '../../components/StudentLayout'
import { PageHeader, Badge, Card } from '../../components/ui'
import { useAuth } from '../../store/auth'
import { cameraService, CameraState } from '../../lib/camera'
import toast from 'react-hot-toast'
import { Camera, RefreshCw, Loader, CheckCircle2, AlertTriangle } from 'lucide-react'

const angles = ['front', 'left', 'right', 'up', 'down', 'smile', 'normal']
const angleColors: Record<string, string> = {
  front: 'bg-emerald-500', left: 'bg-blue-500', right: 'bg-purple-500', up: 'bg-amber-500',
  down: 'bg-pink-500', smile: 'bg-red-500', normal: 'bg-teal-500',
}

export default function StudentFace() {
  const { user } = useAuth()
  const [student, setStudent] = useState<any>(null)
  const [capturing, setCapturing] = useState(false)
  const [live, setLive] = useState(false)
  const [cameraState, setCameraState] = useState<CameraState>('off')
  const [cameraError, setCameraError] = useState('')
  const [angle, setAngle] = useState('front')
  const [registered, setRegistered] = useState<string[]>([])
  const [status, setStatus] = useState('')
  const [saving, setSaving] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    api.get('/student/profile').then(res => { setStudent(res.data); setRegistered(res.data.registered_angles || []) }).catch(() => {})
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cameraService.setCallbacks({})
      cameraService.stopCamera()
    }
  }, [])

  const startCamera = useCallback(async () => {
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
    }
  }, [])

  // Re-attach the video once the element mounts / capturing toggles
  useEffect(() => {
    if (capturing) cameraService.attachVideo(videoRef.current)
  }, [capturing, live])

  const stopCamera = () => {
    cameraService.stopCamera()
    setCapturing(false); setLive(false); setCameraState('off')
  }

  const capture = async () => {
    if (!cameraService.isFrameReady()) {
      setStatus('Camera frame is not ready. Please wait.')
      toast.error('Camera frame is not ready. Please wait.')
      return
    }
    const b64 = cameraService.captureFrame()
    if (!b64) {
      setStatus('Camera frame is not ready. Please wait.')
      return
    }
    setSaving(true)
    setStatus('Registering...')
    try {
      await api.post('/face/register', { student_id: student.student_id, angle, image_b64: b64 })
      setRegistered([...new Set([...registered, angle])])
      setStatus(`✓ ${angle} face captured`)
      toast.success(`${angle} face captured`)
    } catch (err: any) {
      const detail = err.response?.data?.detail || 'No face detected'
      toast.error(detail)
      setStatus(detail || 'No face detected')
    } finally { setSaving(false) }
  }

  const camLabel = cameraState === 'on' && live
    ? 'LIVE'
    : cameraState === 'on'
    ? 'Connecting…'
    : cameraState === 'opening'
    ? 'Opening…'
    : cameraState.toUpperCase()

  const camBadge = cameraState === 'on' && live ? 'green' : cameraState === 'opening' ? 'yellow' : 'red'

  return (
    <StudentLayout>
      <PageHeader title="Face Registration" subtitle="Register your face for automatic attendance" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Camera</h3>
            {!capturing ? (
              <button onClick={startCamera} className="btn-primary flex items-center gap-2"><Camera size={16} /> Start Camera</button>
            ) : (
              <div className="flex gap-2">
                <button onClick={stopCamera} className="btn-secondary">Stop Camera</button>
                <button onClick={startCamera} className="btn-secondary flex items-center gap-1"><RefreshCw size={14} /> Refresh</button>
              </div>
            )}
          </div>
          <div className="relative rounded-xl overflow-hidden bg-black aspect-video mb-4">
            {capturing ? (
              <>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                  onLoadedMetadata={() => cameraService.attachVideo(videoRef.current)}
                />
                {!live && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-gray-200 text-sm">
                    <Loader size={20} className="animate-spin mr-2" /> Starting live preview…
                  </div>
                )}
                <div className="absolute top-2 left-2">
                  <Badge variant={camBadge}><Camera size={12} className="inline mr-1" /> {camLabel}</Badge>
                </div>
              </>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-gray-500">
                {cameraState === 'opening' ? (
                  <div className="flex items-center gap-2"><Loader size={20} className="animate-spin" /> Opening camera...</div>
                ) : cameraState === 'denied' ? (
                  <div className="text-center px-4">
                    <Camera size={36} className="mx-auto mb-2 text-red-500" />
                    <p className="text-sm">Camera permission denied</p>
                    <p className="text-xs mt-1">Allow access in browser settings.</p>
                  </div>
                ) : cameraState === 'busy' ? (
                  <div className="text-center px-4">
                    <Camera size={36} className="mx-auto mb-2 text-amber-500" />
                    <p className="text-sm">Camera is busy</p>
                    <p className="text-xs mt-1">Used by another application.</p>
                  </div>
                ) : cameraState === 'notfound' ? (
                  <div className="text-center px-4">
                    <Camera size={36} className="mx-auto mb-2" />
                    <p className="text-sm">No camera found</p>
                  </div>
                ) : cameraError ? (
                  <div className="text-center px-4">
                    <AlertTriangle size={36} className="mx-auto mb-2 text-red-500" />
                    <p className="text-sm">{cameraError}</p>
                  </div>
                ) : (
                  <>
                    <Camera size={36} className="mb-2 opacity-50" />
                    <p className="text-sm">Camera off</p>
                  </>
                )}
              </div>
            )}
          </div>
          <div>
            <label className="label">Select Angle</label>
            <div className="flex flex-wrap gap-2 mb-4">
              {angles.map(a => (
                <button key={a} onClick={() => setAngle(a)} className={`px-3 py-1.5 rounded-lg text-sm capitalize transition ${angle === a ? 'bg-primary-600 text-white' : 'bg-gray-100 dark:bg-gray-800 hover:bg-gray-200'}`}>{a}</button>
              ))}
            </div>
          </div>
          {status && (
            <p className={`text-sm mb-3 flex items-center gap-1 ${status.toLowerCase().includes('not') || status.toLowerCase().includes('error') || status.toLowerCase().includes('blurry') || status.toLowerCase().includes('multiple') || status.toLowerCase().includes('ready') ? 'text-red-500' : 'text-emerald-600'}`}>
              {status.toLowerCase().includes('captured') ? <CheckCircle2 size={14} /> : null}
              {status}
            </p>
          )}
          {capturing && (
            <button onClick={capture} disabled={!live || saving} className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50">
              {saving ? <Loader size={16} className="animate-spin" /> : <Camera size={16} />}
              {saving ? 'Registering...' : `Capture ${angle} face`}
            </button>
          )}
        </Card>
        <Card>
          <h3 className="font-semibold mb-4">Registration Progress</h3>
          <div className="space-y-3">
            {angles.map(a => (
              <div key={a} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${registered.includes(a) ? angleColors[a] : 'bg-gray-200 dark:bg-gray-700'}`} />
                  <span className="text-sm capitalize">{a}</span>
                </div>
                {registered.includes(a) ? <Badge variant="green">Registered</Badge> : <Badge variant="gray">Pending</Badge>}
              </div>
            ))}
          </div>
          <div className="mt-6 p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50">
            <Badge variant={student?.face_status === 'approved' ? 'green' : 'yellow'}>Status: {student?.face_status || 'pending'}</Badge>
            <p className="text-xs text-gray-500 mt-2">Capture front, left, right, up, down, smile and normal angles for best recognition accuracy.</p>
          </div>
        </Card>
      </div>
    </StudentLayout>
  )
}
