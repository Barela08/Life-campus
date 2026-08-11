import React, { useEffect, useState } from 'react'
import api, { apiErrorMessage } from '../../lib/api'
import { StatCard, PageHeader, Loading, Badge } from '../../components/ui'
import { CalendarCheck, UserCheck, UserX, TrendingUp, Award } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../store/auth'

export default function StudentDashboard() {
  const { user } = useAuth()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    api.get('/student/dashboard')
      .then(res => setData(res.data))
      .catch(err => {
        console.error('Dashboard load error:', err)
        setError(apiErrorMessage(err, 'Failed to load dashboard data'))
      })
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <><PageHeader title="Dashboard" /><div className="text-center p-8">Loading...</div></>
  if (error) return <><PageHeader title="Dashboard" /><div className="text-center p-8 text-red-500">{error}</div></>
  if (!data) return <><PageHeader title="Dashboard" /><div className="text-center p-8">No data available.</div></>

  return (
    <>
      <PageHeader title="Student Dashboard" subtitle={`Welcome, ${user?.full_name || 'Student'}`} />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard icon={<CalendarCheck size={22} />} label="Total Classes" value={data.total} color="bg-primary-100 text-primary-600 dark:bg-primary-500/20 dark:text-primary-400" />
        <StatCard icon={<UserCheck size={22} />} label="Present" value={data.present} color="bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400" />
        <StatCard icon={<UserX size={22} />} label="Absent" value={data.absent} color="bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-400" />
        <StatCard icon={<TrendingUp size={22} />} label="Attendance %" value={`${data.percentage}%`} color="bg-purple-100 text-purple-600 dark:bg-purple-500/20 dark:text-purple-400" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold flex items-center gap-2"><Award size={18} className="text-amber-500" /> Subject Attendance</h3>
            <Link to="/student/attendance" className="text-sm text-primary-500 hover:underline">View All</Link>
          </div>
          {(data.subjects || []).length === 0 ? <p className="text-gray-400 text-sm text-center py-6">No subject data yet</p> : (
            <div className="space-y-3">
              {(data.subjects || []).map((s: any) => (
                <div key={s.name} className="flex items-center justify-between">
                  <span className="text-sm font-medium">{s.name}</span>
                  <div className="w-1/2">
                    <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-primary-500" style={{ width: `${s.percentage}%` }} />
                    </div>
                  </div>
                  <span className="text-sm font-semibold w-12 text-right">{s.percentage}%</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="card p-5">
          <h3 className="font-semibold mb-4">Recent Attendance</h3>
          {(data.history || []).length === 0 ? <p className="text-gray-400 text-sm text-center py-6">No recent attendance</p> : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead><tr className="border-b border-gray-100 dark:border-gray-800">
                  <th className="table-header">Subject</th><th className="table-header">Status</th><th className="table-header">Date</th>
                </tr></thead>
                <tbody>
                  {(data.history || []).map((r: any) => (
                    <tr key={r.id} className="border-b border-gray-50">
                      <td className="table-cell font-medium">{r.subject}</td>
                      <td className="table-cell"><Badge variant={r.status === 'present' ? 'green' : 'red'}>{r.status}</Badge></td>
                      <td className="table-cell">{r.date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
