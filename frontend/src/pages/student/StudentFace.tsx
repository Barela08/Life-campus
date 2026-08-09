import React, { useEffect, useRef, useState, useCallback } from 'react'
import api from '../../lib/api'
import StudentLayout from '../../components/StudentLayout'
import { PageHeader, Badge, Card } from '../../components/ui'
import { useAuth } from '../../store/auth'
import toast from 'react-hot-toast'
import { Camera, Loader, RefreshCw, CameraOff, AlertTriangle } from 'lucide-react'
import { cameraService, CameraState } from '../../lib/camera'

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

  // Re-attach video once it mounts (black-screen race fix)
  useEffect(() => {
    if (capturing) {
      cameraService.attachVideo(videoRef.current)
    }
  }, [capturing, live])

  const stopCamera = () => {
    cameraService.stopCamera()
    setCapturing(false)
    setLive(false)
    setCameraState('off')
  }

  const capture = async () => {
    if (!cameraService.isFrameReady()) {
      toast.error('Camera frame is not ready. Please wait.')
      return
    }
    const b64 = cameraService.captureFrame()
    if (!b64) { toast.error('Camera frame is not ready. Please wait.'); return }
    setSaving(true)
    setStatus('Registering...')
    try {
      await api.post('/face/register', { student_id: student.student_id, angle, image_b64: b64 })
      setRegistered([...new Set([...registered, angle])])
      setStatus(`Captured: ${angle}`)
      toast.success(`${angle} face captured`)
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'No face detected')
      setStatus('No face detected')
    } finally { setSaving(false) }
  }

  const camLabel = cameraState === 'on' && live
    ? 'LIVE'
    : cameraState === 'on'
    ? 'Connecting…'
    : cameraState === 'opening'
    ? 'Opening…'
    : cameraState.toUpperCase()

  return (
    <StudentLayout>
      <PageHeader title="Face Registration" subtitle="Register your face for automatic attendance" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Camera</h3>
            <div className="flex items-center gap-2">
              {capturing && (
                <Badge variant={cameraState === 'on' && live ? 'green' : cameraState === 'opening' ? 'yellow' : 'red'}>
                  {cameraState === 'on' && live ? '● Camera Live' : camLabel}
                </Badge>
              )}
              {!capturing ? (
                <button onClick={startCamera} className="btn-primary flex items-center gap-2"><Camera size={16} /> Start Camera</button>
              ) : (
                <button onClick={stopCamera} className="btn-secondary">Stop Camera</button>
              )}
            </div>
          </div>
          <div className="relative rounded-xl overflow-hidden bg-black aspect-video mb-2">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
            {!live && capturing && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-gray-300 text-sm">
                <Loader size={20} className="animate-spin mr-2" /> Starting live preview…
              </div>
            )}
            {!capturing && (
              <div className="absolute inset-0 w-full h-full flex flex-col items-center justify-center text-gray-500">
                {cameraState === 'opening' ? (
                  <><Loader className="animate-spin text-primary-500" size={28} /><p className="text-xs mt-2">Opening camera…</p></>
                ) : cameraState === 'denied' ? (
                  <><CameraOff size={32} /><p className="text-xs mt-2">Camera permission denied</p></>
                ) : cameraState === 'busy' ? (
                  <><CameraOff size={32} /><p className="text-xs mt-2">Camera busy</p></>
                ) : cameraState === 'notfound' || cameraState === 'unsupported' ? (
                  <><CameraOff size={32} /><p className="text-xs mt-2">No camera found / not supported</p></>
                ) : cameraState === 'error' && cameraError ? (
                  <><AlertTriangle size={32} className="text-red-500" /><p className="text-xs mt-2 text-red-500">{cameraError}</p></>
                ) : (
                  <><Camera size={32} /><p className="text-xs mt-2">Camera off</p></>
                )}
              </div>
            )}
          </div>
          {cameraError && capturing && (
            <p className="text-xs text-red-500 mb-1">{cameraError}</p>
          )}
          <div className="flex mb-2">
            <button onClick={startCamera} className="btn-secondary flex items-center gap-2 text-sm">
              <RefreshCw size={14} /> Refresh Camera
            </button>
          </div>
          <div>
            <label className="label">Select Angle</label>
            <div className="flex flex-wrap gap-2 mb-4">
              {angles.map(a => (
                <button key={a} onClick={() => setAngle(a)} className={`px-3 py-1.5 rounded-lg text-sm capitalize transition ${angle === a ? 'bg-primary-600 text-white' : 'bg-gray-100 dark:bg-gray-800 hover:bg-gray-200'}`}>{a}</button>
              ))}
            </div>
          </div>
          {status && <p className={`text-sm mb-3 ${status === 'No face detected' ? 'text-red-500' : 'text-emerald-600'}`}>{status}</p>}
          {capturing && (
            <button onClick={capture} disabled={!live || saving} className="btn-primary w-full flex items-center justify-center gap-2">
              {saving ? <Loader size={16} className="animate-spin" /> : <Camera size={16} />} {saving ? 'Processing...' : `Capture ${angle} face`}
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
                {registered.includes(a) ? <Badge variant="green">Registered ✓</Badge> : <Badge variant="gray">Pending</Badge>}
              </div>
            ))}
          </div>
          <div className="mt-6 p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50">
            <Badge variant={student?.face_status === 'approved' ? 'green' : 'yellow'}>Status: {student?.face_status || 'pending'}</Badge>
            <p className="text-xs text-gray-500 mt-2">Capture front, left, right, up, down, smile and normal angles for best recognition accuracy. When the camera shows <b>● Camera Live</b>, you can capture.</p>
          </div>
        </Card>
      </div>
    </StudentLayout>
  )
}
