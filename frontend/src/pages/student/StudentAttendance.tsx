import React, { useEffect, useState } from 'react'
import api from '../../lib/api'
import StudentLayout from '../../components/StudentLayout'
import { PageHeader, Badge, Empty, Loading, SearchInput } from '../../components/ui'
import toast from 'react-hot-toast'
import { FileText, Download } from 'lucide-react'

export default function StudentAttendance() {
  const [records, setRecords] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const load = async () => {
    setLoading(true)
    try { setRecords((await api.get('/student/attendance')).data) } catch { toast.error('Failed') } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const filtered = records.filter(r => (r.subject || '').toLowerCase().includes(search.toLowerCase()))

  const download = () => {
    const token = localStorage.getItem('lifeos_token')
    window.open('/api/export/student-report', '_blank')
  }

  return (
    <StudentLayout>
      <PageHeader
        title="My Attendance"
        subtitle="Your complete attendance record"
        actions={<button onClick={download} className="btn-secondary flex items-center gap-2"><Download size={16} /> Download Report</button>}
      />
      <div className="mb-4"><SearchInput value={search} onChange={setSearch} placeholder="Search by subject..." /></div>
      {loading ? <Loading /> : filtered.length === 0 ? <Empty message="No attendance records" /> : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
                <th className="table-header">Subject</th><th className="table-header">Status</th><th className="table-header">Date</th>
                <th className="table-header">Time</th><th className="table-header">Method</th><th className="table-header">Confidence</th>
              </tr></thead>
              <tbody>
                {filtered.map(r => (
                  <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="table-cell font-medium">{r.subject}</td>
                    <td className="table-cell"><Badge variant={r.status === 'present' ? 'green' : 'red'}>{r.status}</Badge></td>
                    <td className="table-cell">{r.date}</td>
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
    </StudentLayout>
  )
}
