 import React, { useEffect, useState } from 'react'
import api from '../../lib/api'
import AdminLayout from '../../components/AdminLayout'
import { StatCard, Badge, Loading, PageHeader } from '../../components/ui'
import { Users, GraduationCap, Building2, BookOpen, CalendarCheck, AlertTriangle, UserCheck, UserX, Clock } from 'lucide-react'
import { formatDate } from '../../lib/utils'

interface DashboardData {
  overview: { present: number; absent: number; late: number; total: number; today_present: number; today_absent: number }
  counts: { students: number; teachers: number; departments: number; classes: number; subjects: number }
  unknown_alerts: number
  pending_faces: number
  recent_attendance: any[]
}

export default function AdminDashboard() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try {
      const res = await api.get('/admin/dashboard')
      setData(res.data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  // Realtime updates — poll every 3s so attendance shows up immediately
  useEffect(() => {
    const i = setInterval(() => { load() }, 3000)
    return () => clearInterval(i)
  }, [])

  if (loading || !data) return <AdminLayout><Loading /></AdminLayout>

  const o = data.overview

  return (
    <AdminLayout>
      <PageHeader title="Admin Dashboard" subtitle="Overview of your campus" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard icon={<Users size={22} />} label="Total Students" value={data.counts.students} color="bg-primary-100 text-primary-600 dark:bg-primary-500/20 dark:text-primary-400" />
        <StatCard icon={<GraduationCap size={22} />} label="Teachers" value={data.counts.teachers} color="bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400" />
        <StatCard icon={<Building2 size={22} />} label="Departments" value={data.counts.departments} color="bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400" />
        <StatCard icon={<BookOpen size={22} />} label="Subjects" value={data.counts.subjects} color="bg-purple-100 text-purple-600 dark:bg-purple-500/20 dark:text-purple-400" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard icon={<UserCheck size={22} />} label="Total Present" value={o.present} color="bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400" />
        <StatCard icon={<UserX size={22} />} label="Total Absent" value={o.absent} color="bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-400" />
        <StatCard icon={<Clock size={22} />} label="Total Late" value={o.late} color="bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400" />
        <StatCard icon={<AlertTriangle size={22} />} label="Unknown Alerts" value={data.unknown_alerts} color="bg-orange-100 text-orange-600 dark:bg-orange-500/20 dark:text-orange-400" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Recent Attendance</h3>
            <Badge variant="blue">{data.pending_faces} pending face regs</Badge>
          </div>
          {data.recent_attendance.length === 0 ? (
            <p className="text-gray-400 text-sm py-8 text-center">No attendance records yet</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-800">
                    <th className="table-header">Student</th>
                    <th className="table-header">Subject</th>
                    <th className="table-header">Status</th>
                    <th className="table-header">Date</th>
                    <th className="table-header">Time</th>
                    <th className="table-header">Confidence</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recent_attendance.map((r) => (
                    <tr key={r.id} className="border-b border-gray-50 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="table-cell font-medium">{r.student_name}</td>
                      <td className="table-cell">{r.subject}</td>
                      <td className="table-cell">
                        <Badge variant={r.status === 'present' ? 'green' : r.status === 'late' ? 'yellow' : 'red'}>{r.status}</Badge>
                      </td>
                      <td className="table-cell">{formatDate(r.date)}</td>
                      <td className="table-cell">{r.time}</td>
                      <td className="table-cell">{r.confidence ? `${(r.confidence * 100).toFixed(0)}%` : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <div className="card p-5">
          <h3 className="font-semibold mb-4">Today's Overview</h3>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-1"><span>Present</span><span className="font-semibold">{o.today_present}</span></div>
              <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${o.total ? (o.today_present / o.total * 100) : 0}%` }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1"><span>Absent</span><span className="font-semibold">{o.today_absent}</span></div>
              <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                <div className="h-full bg-red-500 rounded-full" style={{ width: `${o.total ? (o.today_absent / o.total * 100) : 0}%` }} />
              </div>
            </div>
            <div className="pt-4 border-t border-gray-100 dark:border-gray-800">
              <p className="text-sm text-gray-500">Total records</p>
              <p className="text-2xl font-bold">{o.total}</p>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}
