import React, { useEffect, useState } from 'react'
import api, { apiErrorMessage } from '../../lib/api'
import AdminLayout from '../../components/AdminLayout'
import { PageHeader, Badge, Loading } from '../../components/ui'
import toast from 'react-hot-toast'
import { Search, CalendarCheck, Users, UserCheck, UserX, Clock, AlertTriangle, Trash2, Download } from 'lucide-react'

export default function AdminAttendance() {
  const [records, setRecords] = useState<any[]>([])
  const [sessions, setSessions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [date, setDate] = useState('')
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('')
  const [selected, setSelected] = useState<Set<number>>(new Set())

  const load = async () => {
    setLoading(true)
    try {
      const params: any = {}
      if (date) params.date = date
      if (filter) params.status = filter
      if (search.trim()) params.search = search.trim()
      const [r, s] = await Promise.all([
        api.get('/attendance/records', { params }),
        api.get('/attendance/sessions'),
        api.get('/attendance/overview'),
      ])
      setRecords(r.data)
      setSessions(s.data)
      setSelected(new Set())
    } catch (err: any) {
      toast.error(apiErrorMessage(err, 'Failed to load attendance'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])
  useEffect(() => {
    const t = window.setTimeout(() => load(), 500)
    return () => window.clearTimeout(t)
  }, [date, filter, search])

  const filtered = records.filter(r => {
    const text = `${r.student_name || ''} ${r.student_id || ''} ${r.subject || ''} ${r.teacher || ''} ${r.class_name || ''} ${r.section || ''}`.toLowerCase()
    return (!search || text.includes(search.toLowerCase())) && (!filter || r.status === filter)
  })

  const presentCount = records.filter(r => r.status === 'present').length
  const absentCount = records.filter(r => r.status === 'absent').length
  const allSelected = filtered.length > 0 && filtered.every(r => selected.has(r.id))

  const toggleSelected = (id: number) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    setSelected(allSelected ? new Set() : new Set(filtered.map(r => r.id)))
  }

  const deleteRecord = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this attendance record?')) return
    try {
      await api.delete(`/attendance/records/${id}`)
      toast.success('Attendance record deleted')
      load()
    } catch (err: any) {
      toast.error(apiErrorMessage(err, 'Delete failed'))
    }
  }

  const deleteSelected = async () => {
    const ids = Array.from(selected)
    if (!ids.length) { toast.error('Select attendance records first'); return }
    if (!window.confirm('Delete selected attendance records?')) return
    try {
      await api.post('/attendance/records/bulk-delete', { record_ids: ids })
      toast.success('Selected records deleted')
      load()
    } catch (err: any) {
      toast.error(apiErrorMessage(err, 'Bulk delete failed'))
    }
  }

  const deleteSession = async (id: number) => {
    if (!window.confirm('Delete ALL attendance records for this session? This cannot be undone.')) return
    try {
      await api.delete(`/attendance/sessions/${id}`)
      toast.success('Attendance session deleted')
      load()
    } catch (err: any) {
      toast.error(apiErrorMessage(err, 'Session delete failed'))
    }
  }

  const exportCsv = () => {
    const header = ['student_name', 'student_id', 'subject', 'teacher', 'class_name', 'section', 'status', 'date', 'time', 'method', 'confidence']
    const rows = filtered.map(row => header.map(key => `"${String(row[key] ?? '').replace(/"/g, '""')}"`).join(','))
    const csv = [header.join(','), ...rows].join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `attendance-${date || 'records'}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <AdminLayout>
      <PageHeader title="Attendance Management" subtitle="Search, export and delete attendance records and sessions" />
      {loading ? <Loading /> : (
        <>
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

          <div className="flex flex-wrap gap-3 mb-4">
            <div className="relative flex-1 min-w-[220px]">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input className="input pl-9" placeholder="Search student, ID, subject, teacher..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <input type="date" className="input" value={date} onChange={e => setDate(e.target.value)} />
            <select className="input" value={filter} onChange={e => setFilter(e.target.value)}>
              <option value="">All Status</option>
              <option value="present">Present</option>
              <option value="absent">Absent</option>
              <option value="late">Late</option>
            </select>
            <button onClick={exportCsv} className="btn-secondary flex items-center gap-2"><Download size={16} /> Export</button>
            <button onClick={deleteSelected} disabled={selected.size === 0} className="btn-danger flex items-center gap-2"><Trash2 size={16} /> Delete Selected</button>
          </div>

          <div className="card p-5">
            <h3 className="font-semibold mb-4 flex items-center gap-2"><Users size={18} /> Attendance Records ({filtered.length})</h3>
            {filtered.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-8">No attendance records found</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead><tr className="border-b border-gray-100 dark:border-gray-800">
                    <th className="table-header"><input type="checkbox" checked={allSelected} onChange={toggleAll} /></th>
                    <th className="table-header">Student</th><th className="table-header">Student ID</th><th className="table-header">Subject</th><th className="table-header">Teacher</th><th className="table-header">Class</th><th className="table-header">Section</th><th className="table-header">Status</th><th className="table-header">Date</th><th className="table-header">Time</th><th className="table-header">Method</th><th className="table-header">Confidence</th><th className="table-header">Actions</th>
                  </tr></thead>
                  <tbody>
                    {filtered.map(r => (
                      <tr key={r.id} className="border-b border-gray-50">
                        <td className="table-cell"><input type="checkbox" checked={selected.has(r.id)} onChange={() => toggleSelected(r.id)} /></td>
                        <td className="table-cell font-medium">{r.student_name}</td>
                        <td className="table-cell">{r.student_id || '-'}</td>
                        <td className="table-cell">{r.subject || '-'}</td>
                        <td className="table-cell">{r.teacher || '-'}</td>
                        <td className="table-cell">{r.class_name || '-'}</td>
                        <td className="table-cell">{r.section || '-'}</td>
                        <td className="table-cell"><Badge variant={r.status === 'present' ? 'green' : r.status === 'late' ? 'yellow' : 'red'}>{r.status}</Badge></td>
                        <td className="table-cell">{r.date}</td>
                        <td className="table-cell">{r.time || '-'}</td>
                        <td className="table-cell">{r.method || '-'}</td>
                        <td className="table-cell">{r.confidence ? `${(r.confidence * 100).toFixed(0)}%` : '-'}</td>
                        <td className="table-cell"><button onClick={() => deleteRecord(r.id)} className="btn-danger py-1.5 px-2"><Trash2 size={14} /></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="card p-5 mt-6">
            <h3 className="font-semibold mb-4 flex items-center gap-2"><Clock size={18} /> Recent Sessions</h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead><tr className="border-b border-gray-100 dark:border-gray-800">
                  <th className="table-header">#</th><th className="table-header">Teacher</th><th className="table-header">Subject</th><th className="table-header">Class</th><th className="table-header">Section</th><th className="table-header">Marked</th><th className="table-header">Status</th><th className="table-header">Started</th><th className="table-header">Actions</th>
                </tr></thead>
                <tbody>
                  {sessions.map(s => (
                    <tr key={s.id} className="border-b border-gray-50">
                      <td className="table-cell">{s.id}</td>
                      <td className="table-cell">{s.teacher || '-'}</td>
                      <td className="table-cell">{s.subject || '-'}</td>
                      <td className="table-cell">{s.class || '-'}</td>
                      <td className="table-cell">{s.section || '-'}</td>
                      <td className="table-cell">{s.counts?.marked ?? '-'}</td>
                      <td className="table-cell"><Badge variant={s.status === 'active' ? 'green' : 'gray'}>{s.status}</Badge></td>
                      <td className="table-cell">{s.started_at}</td>
                      <td className="table-cell"><button onClick={() => deleteSession(s.id)} className="btn-danger py-1.5 px-2"><Trash2 size={14} /></button></td>
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
