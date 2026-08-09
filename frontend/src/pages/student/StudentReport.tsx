import React, { useEffect, useState } from 'react'
import api from '../../lib/api'
import StudentLayout from '../../components/StudentLayout'
import { PageHeader, Badge, Loading } from '../../components/ui'
import toast from 'react-hot-toast'
import { PieChart, TrendingUp, CalendarDays } from 'lucide-react'

export default function StudentReport() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [month, setMonth] = useState(new Date().getMonth() + 1)
  const [year, setYear] = useState(new Date().getFullYear())

  const load = async () => {
    setLoading(true)
    try {
      const res = await api.get('/student/monthly', { params: { month, year } })
      setData(res.data)
    } catch { toast.error('Failed to load') } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [month, year])

  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

  return (
    <StudentLayout>
      <PageHeader title="Monthly Attendance Report" subtitle="Track your attendance month by month" />
      <div className="flex flex-wrap gap-3 mb-6">
        <select className="input" value={month} onChange={e => setMonth(+e.target.value)}>
          {months.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
        </select>
        <select className="input" value={year} onChange={e => setYear(+e.target.value)}>
          {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>
      {loading ? <Loading /> : data && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="card p-5 flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-primary-50 dark:bg-primary-500/10 flex items-center justify-center"><PieChart size={22} className="text-primary-600" /></div>
              <div><p className="text-2xl font-bold">{data.present}</p><p className="text-xs text-gray-400">Present</p></div>
            </div>
            <div className="card p-5 flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-red-50 dark:bg-red-500/10 flex items-center justify-center"><CalendarDays size={22} className="text-red-600" /></div>
              <div><p className="text-2xl font-bold">{data.absent}</p><p className="text-xs text-gray-400">Absent</p></div>
            </div>
            <div className="card p-5 flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center"><TrendingUp size={22} className="text-emerald-600" /></div>
              <div><p className="text-2xl font-bold">{data.percentage}%</p><p className="text-xs text-gray-400">Attendance %</p></div>
            </div>
          </div>
          <div className="card p-5">
            <h3 className="font-semibold mb-4">Records — {months[data.month - 1]} {data.year}</h3>
            {data.records.length === 0 ? <p className="text-gray-400 text-sm text-center py-8">No records for this month</p> : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead><tr className="border-b border-gray-100 dark:border-gray-800">
                    <th className="table-header">Date</th><th className="table-header">Subject</th><th className="table-header">Status</th>
                  </tr></thead>
                  <tbody>
                    {data.records.map((r: any, i: number) => (
                      <tr key={i} className="border-b border-gray-50">
                        <td className="table-cell">{r.date}</td>
                        <td className="table-cell">{r.subject}</td>
                        <td className="table-cell"><Badge variant={r.status === 'present' ? 'green' : 'red'}>{r.status}</Badge></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </StudentLayout>
  )
}
