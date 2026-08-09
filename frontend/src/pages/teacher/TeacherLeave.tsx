import React, { useEffect, useState } from 'react'
import api from '../../lib/api'
import TeacherLayout from '../../components/TeacherLayout'
import { PageHeader, Badge, Loading } from '../../components/ui'
import toast from 'react-hot-toast'
import { CalendarOff } from 'lucide-react'

export default function TeacherLeave() {
  const [requests, setRequests] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try { setRequests((await api.get('/admin/leave-requests')).data) }
    catch { setRequests([]) } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const decide = async (id: number, status: string) => {
    try {
      await api.post(`/admin/leave-requests/${id}/decide`, { status })
      toast.success(`Leave ${status}`)
      load()
    } catch (err: any) { toast.error(err.response?.data?.detail || 'Failed') }
  }

  return (
    <TeacherLayout>
      <PageHeader title="Leave Requests" subtitle="Approve or reject student leave requests" />
      {loading ? <Loading /> : requests.length === 0 ? (
        <div className="card p-8 text-center text-gray-400"><CalendarOff size={32} className="mx-auto mb-3 opacity-40" /><p>No leave requests</p></div>
      ) : (
        <div className="card p-5">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr className="border-b border-gray-100 dark:border-gray-800">
                <th className="table-header">Student</th><th className="table-header">Subject</th><th className="table-header">Reason</th>
                <th className="table-header">Date</th><th className="table-header">Status</th><th className="table-header">Actions</th>
              </tr></thead>
              <tbody>
                {requests.map((r: any) => (
                  <tr key={r.id} className="border-b border-gray-50">
                    <td className="table-cell font-medium">{r.student_name || '-'}</td>
                    <td className="table-cell">{r.subject || '-'}</td>
                    <td className="table-cell">{r.reason}</td>
                    <td className="table-cell">{r.date}</td>
                    <td className="table-cell"><Badge variant={r.status === 'approved' ? 'green' : r.status === 'rejected' ? 'red' : 'yellow'}>{r.status}</Badge></td>
                    <td className="table-cell">
                      {r.status === 'pending' && (
                        <div className="flex gap-2">
                          <button onClick={() => decide(r.id, 'approved')} className="btn-primary text-sm py-1 px-3">Approve</button>
                          <button onClick={() => decide(r.id, 'rejected')} className="btn-danger text-sm py-1 px-3">Reject</button>
                        </div>
                      )}
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
