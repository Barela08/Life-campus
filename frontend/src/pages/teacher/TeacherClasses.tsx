import React, { useEffect, useState } from 'react'
import api from '../../lib/api'
import TeacherLayout from '../../components/TeacherLayout'
import { PageHeader, Badge, Loading } from '../../components/ui'
import toast from 'react-hot-toast'
import { CalendarClock, Camera, Play } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export default function TeacherClasses() {
  const [sessions, setSessions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  const load = async () => {
    setLoading(true)
    try { setSessions((await api.get('/teacher/sessions')).data) }
    catch { toast.error('Failed to load') } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const today = new Date().toDateString()

  return (
    <TeacherLayout>
      <PageHeader title="Today's Classes" subtitle="View your classes and start attendance" />
      {loading ? <Loading /> : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {sessions.length === 0 ? (
            <div className="card p-8 text-center text-gray-400 col-span-full"><CalendarClock size={32} className="mx-auto mb-3 opacity-40" /><p>No class sessions found</p></div>
          ) : sessions.map(s => (
            <div key={s.id} className="card p-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold">{s.subject}</h3>
                  <p className="text-sm text-gray-400">{s.class}</p>
                </div>
                <Badge variant={s.status === 'active' ? 'green' : 'gray'}>{s.status}</Badge>
              </div>
              <p className="text-xs text-gray-400 mb-4">Started: {s.started_at}</p>
              <div className="flex gap-2">
                <button onClick={() => navigate('/attendance')} className="btn-primary flex-1 flex items-center justify-center gap-2"><Play size={16} /> Start Attendance</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </TeacherLayout>
  )
}
