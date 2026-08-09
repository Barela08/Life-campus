import React, { useEffect, useRef, useState } from 'react'
import api from '../../lib/api'
import StudentLayout from '../../components/StudentLayout'
import { PageHeader, Badge, Card } from '../../components/ui'
import { useAuth } from '../../store/auth'
import toast from 'react-hot-toast'
import { Camera } from 'lucide-react'

const angles = ['front', 'left', 'right', 'up', 'down', 'smile', 'normal']
const angleColors: Record<string, string> = {
  front: 'bg-emerald-500', left: 'bg-blue-500', right: 'bg-purple-500', up: 'bg-amber-500',
  down: 'bg-pink-500', smile: 'bg-red-500', normal: 'bg-teal-500',
}

export default function StudentFace() {
  const { user } = useAuth()
  const [student, setStudent] = useState<any>(null)
  const [capturing, setCapturing] = useState(false)
  const [angle, setAngle] = useState('front')
  const [registered, setRegistered] = useState<string[]>([])
  const [status, setStatus] = useState('')
  const [stream, setStream] = useState<MediaStream | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    api.get('/student/profile').then(res => { setStudent(res.data); setRegistered(res.data.registered_angles || []) }).catch(() => {})
  }, [])

  useEffect(() => {
    return () => { if (stream) stream.getTracks().forEach(t => t.stop()) }
  }, [stream])

  const startCamera = async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: true })
      setStream(s)
      if (videoRef.current) { videoRef.current.srcObject = s; setCapturing(true) }
    } catch { toast.error('Camera access denied') }
  }

  const capture = async () => {
    if (!videoRef.current || !canvasRef.current) return
    const canvas = canvasRef.current
    const video = videoRef.current
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d')!.drawImage(video, 0, 0)
    const b64 = canvas.toDataURL('image/jpeg').split(',')[1]
    setStatus('Registering...')
    try {
      await api.post('/face/register', { student_id: student.student_id, angle, image_b64: b64 })
      setRegistered([...new Set([...registered, angle])])
      setStatus(`Captured: ${angle}`)
      toast.success(`${angle} face captured`)
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'No face detected')
      setStatus('No face detected')
    }
  }

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
              <button onClick={() => { stream?.getTracks().forEach(t => t.stop()); setCapturing(false); setStream(null) }} className="btn-secondary">Stop Camera</button>
            )}
          </div>
          <div className="relative rounded-xl overflow-hidden bg-black aspect-video mb-4">
            {capturing ? <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-gray-500">Camera off</div>}
            <canvas ref={canvasRef} className="hidden" />
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
          {capturing && <button onClick={capture} className="btn-primary w-full flex items-center justify-center gap-2"><Camera size={16} /> Capture {angle} face</button>}
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
