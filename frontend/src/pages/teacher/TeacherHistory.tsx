import React, { useEffect, useState } from 'react'
import api from '../../lib/api'
import TeacherLayout from '../../components/TeacherLayout'
import { PageHeader, Badge, Loading } from '../../components/ui'
import toast from 'react-hot-toast'
import { History, Search } from 'lucide-react'

export default function TeacherHistory() {
  const [records, setRecords] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const load = async () => {
    setLoading(true)
    try { setRecords((await api.get('/teacher/reports')).data) }
    catch { toast.error('Failed to load') } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const filtered = records.filter(r => (r.student_name || '').toLowerCase().includes(search.toLowerCase()) || (r.subject || '').toLowerCase().includes(search.toLowerCase()))

  return (
    <TeacherLayout>
      <PageHeader title="Attendance History" subtitle="Complete record of your attendance sessions" />
      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input className="input pl-9" placeholder="Search by student or subject..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>
      {loading ? <Loading /> : filtered.length === 0 ? (
        <div className="card p-8 text-center text-gray-400"><History size={32} className="mx-auto mb-3 opacity-40" /><p>No attendance history yet</p></div>
      ) : (
        <div className="card p-5">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr className="border-b border-gray-100 dark:border-gray-800">
                <th className="table-header">Student</th><th className="table-header">Subject</th><th className="table-header">Class</th>
                <th className="table-header">Status</th><th className="table-header">Date</th><th className="table-header">Time</th><th className="table-header">Method</th>
              </tr></thead>
              <tbody>
                {filtered.map(r => (
                  <tr key={r.id} className="border-b border-gray-50">
                    <td className="table-cell font-medium">{r.student_name}</td>
                    <td className="table-cell">{r.subject}</td>
                    <td className="table-cell">{r.class_name}</td>
                    <td className="table-cell"><Badge variant={r.status === 'present' ? 'green' : 'red'}>{r.status}</Badge></td>
                    <td className="table-cell">{r.date}</td>
                    <td className="table-cell">{r.time}</td>
                    <td className="table-cell">{r.method}</td>
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
