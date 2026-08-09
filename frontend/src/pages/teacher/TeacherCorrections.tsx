import React, { useEffect, useState } from 'react'
import api from '../../lib/api'
import TeacherLayout from '../../components/TeacherLayout'
import { PageHeader, Badge, Loading } from '../../components/ui'
import toast from 'react-hot-toast'
import { ClipboardCheck, Search } from 'lucide-react'

export default function TeacherCorrections() {
  const [records, setRecords] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const load = async () => {
    setLoading(true)
    try { setRecords((await api.get('/teacher/reports')).data) }
    catch { toast.error('Failed to load') } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const correct = async (id: number, status: string) => {
    try {
      await api.put(`/attendance/records/${id}`, { status })
      toast.success('Attendance corrected')
      load()
    } catch (err: any) { toast.error(err.response?.data?.detail || 'Failed to correct') }
  }

  const filtered = records.filter(r => (r.student_name || '').toLowerCase().includes(search.toLowerCase()))

  return (
    <TeacherLayout>
      <PageHeader title="Correct Attendance" subtitle="Manually correct student attendance records" />
      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input className="input pl-9" placeholder="Search by student..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>
      {loading ? <Loading /> : filtered.length === 0 ? (
        <div className="card p-8 text-center text-gray-400"><ClipboardCheck size={32} className="mx-auto mb-3 opacity-40" /><p>No records to correct</p></div>
      ) : (
        <div className="card p-5">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr className="border-b border-gray-100 dark:border-gray-800">
                <th className="table-header">Student</th><th className="table-header">Subject</th><th className="table-header">Status</th>
                <th className="table-header">Date</th><th className="table-header">Actions</th>
              </tr></thead>
              <tbody>
                {filtered.map(r => (
                  <tr key={r.id} className="border-b border-gray-50">
                    <td className="table-cell font-medium">{r.student_name}</td>
                    <td className="table-cell">{r.subject}</td>
                    <td className="table-cell"><Badge variant={r.status === 'present' ? 'green' : 'red'}>{r.status}</Badge></td>
                    <td className="table-cell">{r.date}</td>
                    <td className="table-cell">
                      <div className="flex gap-2">
                        <button onClick={() => correct(r.id, 'present')} className="btn-primary text-sm py-1 px-3">Present</button>
                        <button onClick={() => correct(r.id, 'absent')} className="btn-danger text-sm py-1 px-3">Absent</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
</TeacherLayout>
  )
}
