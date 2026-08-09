import React, { useEffect, useState } from 'react'
import api from '../../lib/api'
import AdminLayout from '../../components/AdminLayout'
import { PageHeader, Loading, StatCard } from '../../components/ui'
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts'
import { Users, UserCheck, UserX, TrendingUp } from 'lucide-react'

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4']

export default function Analytics() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try { setData((await api.get('/admin/analytics')).data) } catch (e) { console.error(e) } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  if (loading || !data) return <AdminLayout><Loading /></AdminLayout>

  return (
    <AdminLayout>
      <PageHeader title="Analytics" subtitle="Attendance statistics and trends" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard icon={<Users size={22} />} label="Total Students" value={data.total_students} color="bg-primary-100 text-primary-600 dark:bg-primary-500/20 dark:text-primary-400" />
        <StatCard icon={<UserCheck size={22} />} label="Total Present" value={data.total_present} color="bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400" />
        <StatCard icon={<UserX size={22} />} label="Total Absent" value={data.total_absent} color="bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-400" />
        <StatCard icon={<TrendingUp size={22} />} label="Overall %" value={`${data.overall_percentage}%`} color="bg-purple-100 text-purple-600 dark:bg-purple-500/20 dark:text-purple-400" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-5">
          <h3 className="font-semibold mb-4">Department Distribution</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={data.department_distribution} dataKey="students" nameKey="name" cx="50%" cy="50%" outerRadius={100} label>
                {data.department_distribution.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="card p-5">
          <h3 className="font-semibold mb-4">Attendance Trend (Last 7 Days)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data.trend}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="present" fill="#10b981" />
              <Bar dataKey="absent" fill="#ef4444" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </AdminLayout>
  )
}
