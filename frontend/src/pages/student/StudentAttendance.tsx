import React, { useEffect, useState } from 'react'
import api, { apiErrorMessage } from '../../lib/api'
import { PageHeader, Badge, Empty, Loading, SearchInput } from '../../components/ui'
import toast from 'react-hot-toast'
import { FileText, Download, Loader } from 'lucide-react'

export default function StudentAttendance() {
  const [records, setRecords] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [downloading, setDownloading] = useState(false)

  const load = async () => {
    setLoading(true)
    try { 
      const res = await api.get('/student/attendance')
      setRecords(res.data)
    } catch (err) { 
      toast.error(apiErrorMessage(err, 'Failed to load attendance records')) 
    } finally { 
      setLoading(false) 
    }
  }
  useEffect(() => { load() }, [])

  const filtered = records.filter(r => (r.subject || '').toLowerCase().includes(search.toLowerCase()))

  const download = async () => {
    setDownloading(true)
    try {
      const res = await api.get('/export/student-report?format=pdf', { responseType: 'blob' })
      const url = window.URL.createObjectURL(new Blob([res.data]))

      const link = document.createElement('a')
      link.href = url
      const disp = res.headers['content-disposition']
      const filename = disp ? disp.split('filename=')[1].replace(/"/g, '') : 'student-report.pdf'
      link.setAttribute('download', filename)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Failed to download report'))
    } finally {
      setDownloading(false)
    }
  }

  return (
    <>
      <PageHeader
        title="My Attendance"
        subtitle="Your complete attendance record"
        actions={<button onClick={download} disabled={downloading} className="btn-secondary flex items-center gap-2">
          {downloading ? <Loader size={16} className="animate-spin" /> : <Download size={16} />}
          {downloading ? 'Downloading...' : 'Download Report'}
        </button>}
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
    </>
  )
}
