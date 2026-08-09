import React, { useEffect, useState } from 'react'
import api from '../../lib/api'
import TeacherLayout from '../../components/TeacherLayout'
import { StatCard, PageHeader, Loading, Badge } from '../../components/ui'
import { CalendarCheck, PlayCircle, UserCheck, UserX, Clock } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export default function TeacherDashboard() {
  const [data, setData] = useState<any>(null)
  const [sessions, setSessions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  const load = async () => {
    setLoading(true)
    try {
      const [d, s] = await Promise.all([api.get('/teacher/dashboard'), api.get('/teacher/sessions')])
      setData(d.data); setSessions(s.data)
    } catch (e) { console.error(e) } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  if (loading || !data) return <TeacherLayout><Loading /></TeacherLayout>

  return (
    <TeacherLayout>
      <PageHeader title="Teacher Dashboard" subtitle={`Welcome, ${data.full_name}`} />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard icon={<CalendarCheck size={22} />} label="Total Sessions" value={data.total_sessions} color="bg-primary-100 text-primary-600 dark:bg-primary-500/20 dark:text-primary-400" />
        <StatCard icon={<PlayCircle size={22} />} label="Active Sessions" value={data.active_sessions} color="bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400" />
        <StatCard icon={<UserCheck size={22} />} label="Present" value={data.present} color="bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400" />
        <StatCard icon={<UserX size={22} />} label="Absent" value={data.absent} color="bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-400" />
      </div>
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">Recent Sessions</h3>
          <button onClick={() => navigate('/teacher/attendance')} className="btn-primary text-sm py-2">Start Attendance</button>
        </div>
        {sessions.length === 0 ? <p className="text-gray-400 text-sm text-center py-6">No sessions yet</p> : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr className="border-b border-gray-100 dark:border-gray-800">
                <th className="table-header">Subject</th><th className="table-header">Class</th><th className="table-header">Status</th><th className="table-header">Started</th>
              </tr></thead>
              <tbody>
                {sessions.map(s => (
                  <tr key={s.id} className="border-b border-gray-50">
                    <td className="table-cell font-medium">{s.subject}</td>
                    <td className="table-cell">{s.class}</td>
                    <td className="table-cell"><Badge variant={s.status === 'active' ? 'green' : 'gray'}>{s.status}</Badge></td>
                    <td className="table-cell flex items-center gap-1"><Clock size={12} /> {new Date(s.started_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </TeacherLayout>
  )
}
