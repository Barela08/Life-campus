import React from 'react'
import api, { apiErrorMessage } from '../../lib/api'
import StudentLayout from '../../components/StudentLayout'
import { PageHeader } from '../../components/ui'
import toast from 'react-hot-toast'
import { FileText, FileSpreadsheet, FileDown, Download } from 'lucide-react'

export default function StudentDownload() {
  const download = async (format: string) => {
    try {
      const res = await api.get(`/export/student-report?format=${format}`, {
        responseType: 'blob',
      })
      const url = window.URL.createObjectURL(new Blob([res.data]))
      const a = document.createElement('a')
      a.href = url
      a.download = `student-report.${format}`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
      toast.success(`Downloaded ${format.toUpperCase()} report`)
    } catch (err: any) { 
      toast.error(apiErrorMessage(err, 'Download failed')) 
    }
  }

  const cards = [
    { format: 'pdf', title: 'PDF Report', desc: 'Download your attendance as a formatted PDF document', icon: <FileText size={24} />, color: 'text-red-500 bg-red-50 dark:bg-red-500/10' },
    { format: 'xlsx', title: 'Excel Report', desc: 'Download your attendance as an Excel spreadsheet', icon: <FileSpreadsheet size={24} />, color: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10' },
    { format: 'csv', title: 'CSV Report', desc: 'Download your attendance as a CSV file', icon: <FileDown size={24} />, color: 'text-blue-500 bg-blue-50 dark:bg-blue-500/10' },
  ]

  return (
    <StudentLayout>
      <PageHeader title="Download Reports" subtitle="Export your attendance records" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {cards.map(c => (
          <button key={c.format} onClick={() => download(c.format)} className="card p-6 text-left hover:shadow-lg transition-all group">
            <div className={`w-12 h-12 rounded-xl ${c.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>{c.icon}</div>
            <h3 className="font-semibold mb-1">{c.title}</h3>
            <p className="text-sm text-gray-400 mb-4">{c.desc}</p>
            <span className="btn-primary inline-flex items-center gap-2 text-sm"><Download size={16} /> Download</span>
          </button>
        ))}
      </div>
    </StudentLayout>
  )
}
