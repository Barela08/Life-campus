import React, { useEffect, useState } from 'react'
import api from '../../lib/api'
import TeacherLayout from '../../components/TeacherLayout'
import { PageHeader, Badge, Empty, Loading, SearchInput } from '../../components/ui'
import toast from 'react-hot-toast'
import { FileText, FileSpreadsheet, Download } from 'lucide-react'
import { formatDate } from '../../lib/utils'

export default function TeacherReports() {
  const [records, setRecords] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const load = async () => {
    setLoading(true)
    try { setRecords((await api.get('/teacher/reports')).data) } catch { toast.error('Failed') } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const filtered = records.filter(r => r.student_name.toLowerCase().includes(search.toLowerCase()))

  const exportFile = (fmt: string) => {
    const token = localStorage.getItem('lifeos_token')
    window.open(`/api/export/${fmt}`, '_blank')
  }

  return (
    <TeacherLayout>
      <PageHeader
        title="Attendance Reports"
        subtitle="Your attendance records"
        actions={<>
          <button onClick={() => exportFile('pdf')} className="btn-secondary flex items-center gap-2"><FileText size={16} /> PDF</button>
          <button onClick={() => exportFile('excel')} className="btn-secondary flex items-center gap-2"><FileSpreadsheet size={16} /> Excel</button>
          <button onClick={() => exportFile('csv')} className="btn-secondary flex items-center gap-2"><Download size={16} /> CSV</button>
        </>}
      />
      <div className="mb-4"><SearchInput value={search} onChange={setSearch} placeholder="Search by student..." /></div>
      {loading ? <Loading /> : filtered.length === 0 ? <Empty message="No records yet" /> : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
                <th className="table-header">Student</th><th className="table-header">Subject</th><th className="table-header">Status</th>
                <th className="table-header">Date</th><th className="table-header">Time</th><th className="table-header">Method</th>
              </tr></thead>
              <tbody>
                {filtered.map(r => (
                  <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="table-cell font-medium">{r.student_name}</td>
                    <td className="table-cell">{r.subject}</td>
                    <td className="table-cell"><Badge variant={r.status === 'present' ? 'green' : r.status === 'late' ? 'yellow' : 'red'}>{r.status}</Badge></td>
                    <td className="table-cell">{formatDate(r.date)}</td>
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
