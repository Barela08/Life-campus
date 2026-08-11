import { useEffect, useState } from 'react'
import api, { apiErrorMessage } from '../../lib/api'
import { Badge, Card, PageHeader } from '../../components/ui'
import AdminLayout from '../../components/AdminLayout'
import toast from 'react-hot-toast'

export default function LeaveManagement() {
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState('')
  const [role, setRole] = useState('')
  const load = async () => { setLoading(true); try { const q = new URLSearchParams(); if (status) q.set('status', status); if (role) q.set('role', role); setRows((await api.get(`/leave/review?${q}`)).data) } catch (e) { toast.error(apiErrorMessage(e, 'Unable to load leave requests')) } finally { setLoading(false) } }
  useEffect(() => { void load() }, [status, role])
  const decide = async (id: number, action: 'approve' | 'reject') => {
    const rejection_reason = action === 'reject' ? window.prompt('Rejection reason (required):') || '' : window.prompt('Approval note (optional):') || ''
    if (action === 'reject' && !rejection_reason.trim()) return
    try { await api.post(`/leave/${id}/review`, { action, rejection_reason }); toast.success(`Leave request ${action}d`); setRows(current => current.filter(row => row.id !== id)) }
    catch (e) { toast.error(apiErrorMessage(e, 'Unable to update leave request')) }
  }
  const color = (value: string) => value === 'approved' ? 'green' : value === 'rejected' ? 'red' : 'yellow'
  return <AdminLayout><PageHeader title="Leave Management" subtitle="Review student and staff leave requests" />
    <Card><div className="flex flex-wrap gap-3 mb-5"><select className="input max-w-44" value={role} onChange={e => setRole(e.target.value)}><option value="">All applicants</option><option value="student">Students</option><option value="teacher">Teachers / staff</option></select><select className="input max-w-44" value={status} onChange={e => setStatus(e.target.value)}><option value="">All statuses</option><option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option></select></div>
      {loading ? <p>Loading…</p> : rows.length === 0 ? <p className="text-gray-500">No leave requests match these filters.</p> : <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left"><th className="p-2">Applicant</th><th className="p-2">Role</th><th className="p-2">Dates</th><th className="p-2">Reason</th><th className="p-2">Status</th><th className="p-2">Action</th></tr></thead><tbody>{rows.map(row => <tr key={row.id} className="border-b"><td className="p-2">{row.applicant_name}</td><td className="p-2 capitalize">{row.applicant_role}</td><td className="p-2">{row.from_date} – {row.to_date}</td><td className="p-2 max-w-xs">{row.reason}{row.rejection_reason && <div className="text-red-600 mt-1">{row.rejection_reason}</div>}</td><td className="p-2"><Badge variant={color(row.status) as any}>{row.status}</Badge></td><td className="p-2">{row.status === 'pending' ? <div className="flex gap-2"><button className="btn-primary text-xs py-1 px-2" onClick={() => void decide(row.id, 'approve')}>Approve</button><button className="btn-danger text-xs py-1 px-2" onClick={() => void decide(row.id, 'reject')}>Reject</button></div> : row.reviewer || '—'}</td></tr>)}</tbody></table></div>}</Card>
  </AdminLayout>
}
