import React, { useEffect, useState } from 'react'
import api from '../../lib/api'
import AdminLayout from '../../components/AdminLayout'
import { PageHeader, Badge, Empty, Loading, SearchInput } from '../../components/ui'
import toast from 'react-hot-toast'
import { FileText, FileSpreadsheet, Download, Filter } from 'lucide-react'
import { formatDate } from '../../lib/utils'

export default function Reports() {
  const [records, setRecords] = useState<any[]>([])
  const [subjects, setSubjects] = useState<any[]>([])
  const [classes, setClasses] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [subjectId, setSubjectId] = useState('')
  const [classId, setClassId] = useState('')
  const [date, setDate] = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const params: any = {}
      if (subjectId) params.subject_id = subjectId
      if (classId) params.class_id = classId
      if (date) params.date = date
      const [r, s, c] = await Promise.all([
        api.get('/attendance/records', { params }),
        api.get('/admin/subjects'), api.get('/admin/classes'),
      ])
      setRecords(r.data); setSubjects(s.data); setClasses(c.data)
    } catch { toast.error('Failed to load') } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [subjectId, classId, date])

  const exportFile = (fmt: string) => {
    const params = new URLSearchParams()
    if (subjectId) params.set('subject_id', subjectId)
    if (classId) params.set('class_id', classId)
    if (date) params.set('date', date)
    const token = localStorage.getItem('lifeos_token')
    window.open(`/api/export/${fmt}?${params.toString()}`, '_blank')
  }

  const filtered = records.filter(r => r.student_name.toLowerCase().includes(search.toLowerCase()))

  return (
    <AdminLayout>
      <PageHeader title="Attendance Reports" subtitle="View and export attendance records" />
      <div className="card p-4 mb-6">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[150px]"><label className="label">Subject</label>
            <select className="input" value={subjectId} onChange={e => setSubjectId(e.target.value)}>
              <option value="">All Subjects</option>{subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select></div>
          <div className="flex-1 min-w-[150px]"><label className="label">Class</label>
            <select className="input" value={classId} onChange={e => setClassId(e.target.value)}>
              <option value="">All Classes</option>{classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select></div>
          <div className="flex-1 min-w-[150px]"><label className="label">Date</label>
            <input type="date" className="input" value={date} onChange={e => setDate(e.target.value)} /></div>
          <div className="flex items-center gap-2">
            <button onClick={() => exportFile('pdf')} className="btn-secondary flex items-center gap-2"><FileText size={16} /> PDF</button>
            <button onClick={() => exportFile('excel')} className="btn-secondary flex items-center gap-2"><FileSpreadsheet size={16} /> Excel</button>
            <button onClick={() => exportFile('csv')} className="btn-secondary flex items-center gap-2"><Download size={16} /> CSV</button>
          </div>
        </div>
      </div>
      <div className="mb-4"><SearchInput value={search} onChange={setSearch} placeholder="Search by student name..." /></div>
      {loading ? <Loading /> : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
                <th className="table-header">Student</th><th className="table-header">Subject</th><th className="table-header">Status</th>
                <th className="table-header">Date</th><th className="table-header">Time</th><th className="table-header">Method</th><th className="table-header">Confidence</th>
              </tr></thead>
              <tbody>
                {filtered.length === 0 ? <tr><td colSpan={7}><Empty message="No records found" /></td></tr> :
                  filtered.map(r => (
                    <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="table-cell font-medium">{r.student_name}</td>
                      <td className="table-cell">{r.subject}</td>
                      <td className="table-cell"><Badge variant={r.status === 'present' ? 'green' : r.status === 'late' ? 'yellow' : 'red'}>{r.status}</Badge></td>
                      <td className="table-cell">{formatDate(r.date)}</td>
                      <td className="table-cell">{r.time}</td>
                      <td className="table-cell">{r.method}</td>
                      <td className="table-cell">{r.confidence ? `${(r.confidence * 100).toFixed(0)}%` : '-'}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}
