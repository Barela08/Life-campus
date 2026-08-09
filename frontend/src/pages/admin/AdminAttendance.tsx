 import React, { useEffect, useState } from 'react'
import api from '../../lib/api'
import AdminLayout from '../../components/AdminLayout'
import { PageHeader, Badge, Loading } from '../../components/ui'
import toast from 'react-hot-toast'
import { Search, CalendarCheck, Users, UserCheck, UserX, Clock, AlertTriangle } from 'lucide-react'

export default function AdminAttendance() {
  const [records, setRecords] = useState<any[]>([])
  const [sessions, setSessions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [date, setDate] = useState('')
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const params: any = {}
      if (date) params.date = date
      const [r, s, o] = await Promise.all([
        api.get('/attendance/records', { params }),
        api.get('/attendance/sessions'),
        api.get('/attendance/overview'),
      ])
      setRecords(r.data); setSessions(s.data)
    } catch { toast.error('Failed to load') } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])
  useEffect(() => { const t = setTimeout(() => load(), 500); return () => clearTimeout(t) }, [date])

  const filtered = records.filter(r => {
    const matchSearch = !search || r.student_name.toLowerCase().includes(search.toLowerCase()) || r.subject.toLowerCase().includes(search.toLowerCase())
    const matchFilter = !filter || r.status === filter
    return matchSearch && matchFilter
  })

  const presentCount = records.filter(r => r.status === 'present').length
  const absentCount = records.filter(r => r.status === 'absent').length

  return (
    <AdminLayout>
      <PageHeader title="Attendance Monitor" subtitle="View and manage attendance — attendance is marked by AI in the attendance terminal" />
      {loading ? <Loading /> : (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="card p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary-50 dark:bg-primary-500/10 flex items-center justify-center"><CalendarCheck size={20} className="text-primary-600" /></div>
              <div><p className="text-2xl font-bold">{records.length}</p><p className="text-xs text-gray-400">Total Records</p></div>
            </div>
            <div className="card p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center"><UserCheck size={20} className="text-emerald-600" /></div>
              <div><p className="text-2xl font-bold">{presentCount}</p><p className="text-xs text-gray-400">Present</p></div>
            </div>
            <div className="card p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-500/10 flex items-center justify-center"><UserX size={20} className="text-red-600" /></div>
              <div><p className="text-2xl font-bold">{absentCount}</p><p className="text-xs text-gray-400">Absent</p></div>
            </div>
            <div className="card p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-500/10 flex items-center justify-center"><AlertTriangle size={20} className="text-amber-600" /></div>
              <div><p className="text-2xl font-bold">{sessions.filter(s => s.status === 'active').length}</p><p className="text-xs text-gray-400">Active Sessions</p></div>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-3 mb-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input className="input pl-9" placeholder="Search by student or subject..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <input type="date" className="input" value={date} onChange={e => setDate(e.target.value)} />
            <select className="input" value={filter} onChange={e => setFilter(e.target.value)}>
              <option value="">All Status</option>
              <option value="present">Present</option>
              <option value="absent">Absent</option>
              <option value="late">Late</option>
            </select>
          </div>

          {/* Records table */}
          <div className="card p-5">
            <h3 className="font-semibold mb-4 flex items-center gap-2"><Users size={18} /> Attendance Records ({filtered.length})</h3>
            {filtered.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-8">No attendance records found</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead><tr className="border-b border-gray-100 dark:border-gray-800">
                    <th className="table-header">Student</th><th className="table-header">Subject</th><th className="table-header">Class</th>
                    <th className="table-header">Status</th><th className="table-header">Date</th><th className="table-header">Time</th><th className="table-header">Confidence</th>
                  </tr></thead>
                  <tbody>
                    {filtered.map(r => (
                      <tr key={r.id} className="border-b border-gray-50">
                        <td className="table-cell font-medium">{r.student_name}</td>
                        <td className="table-cell">{r.subject}</td>
                        <td className="table-cell">{r.class_name}</td>
                        <td className="table-cell"><Badge variant={r.status === 'present' ? 'green' : r.status === 'late' ? 'yellow' : 'red'}>{r.status}</Badge></td>
                        <td className="table-cell">{r.date}</td>
                        <td className="table-cell">{r.time}</td>
                        <td className="table-cell">{r.confidence ? (r.confidence * 100).toFixed(0) + '%' : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Sessions */}
          <div className="card p-5 mt-6">
            <h3 className="font-semibold mb-4 flex items-center gap-2"><Clock size={18} /> Recent Sessions</h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead><tr className="border-b border-gray-100 dark:border-gray-800">
                  <th className="table-header">#</th><th className="table-header">Teacher</th><th className="table-header">Subject</th>
                  <th className="table-header">Class</th><th className="table-header">Status</th><th className="table-header">Started</th>
                </tr></thead>
                <tbody>
                  {sessions.map(s => (
                    <tr key={s.id} className="border-b border-gray-50">
                      <td className="table-cell">{s.id}</td>
                      <td className="table-cell">{s.teacher}</td>
                      <td className="table-cell">{s.subject}</td>
                      <td className="table-cell">{s.class}</td>
                      <td className="table-cell"><Badge variant={s.status === 'active' ? 'green' : 'gray'}>{s.status}</Badge></td>
                      <td className="table-cell">{s.started_at}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </AdminLayout>
  )
}
