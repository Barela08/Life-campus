import React, { useEffect, useState } from 'react'
import api, { apiErrorMessage } from '../lib/api'
import { Badge, Card, PageHeader } from '../components/ui'
import toast from 'react-hot-toast'

type Props = { mode: 'student' | 'teacher' | 'admin' }
const variant = (status: string) => status === 'approved' ? 'green' : status === 'rejected' ? 'red' : 'yellow'

export default function ApprovalRequests({ mode }: Props) {
  const [rows, setRows] = useState<any[]>([]); const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState(''); const [reviewing, setReviewing] = useState<number | null>(null)
  const load = async () => { setLoading(true); try { const url = mode === 'student' ? '/approvals/mine' : `/approvals/review${status ? `?status=${status}` : ''}`; setRows((await api.get(url)).data) } catch (err) { toast.error(apiErrorMessage(err, 'Unable to load requests')) } finally { setLoading(false) } }
  useEffect(() => { load() }, [mode, status])
  const review = async (id: number, action: 'approve' | 'reject') => { let rejection_reason: string | undefined; if (action === 'reject') { rejection_reason = window.prompt('Enter the rejection reason:') || ''; if (!rejection_reason.trim()) return }; setReviewing(id); try { await api.post(`/approvals/${id}/review`, { action, rejection_reason }); toast.success(`Request ${action}d successfully`); await load() } catch (err) { toast.error(apiErrorMessage(err, 'Unable to review request')) } finally { setReviewing(null) } }
  const title = mode === 'student' ? 'My Requests' : mode === 'teacher' ? 'Student Change Requests' : 'Change Requests'
  return <><PageHeader title={title} subtitle={mode === 'student' ? 'Track profile changes awaiting review' : 'Review profile change requests'} />
    {mode !== 'student' && <div className="mb-4"><select className="input max-w-48" value={status} onChange={e => setStatus(e.target.value)}><option value="">All statuses</option><option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option></select></div>}
    <Card>{loading ? <p className="p-4 text-gray-500">Loading requests…</p> : rows.length === 0 ? <p className="p-4 text-gray-500">No requests found.</p> : <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left text-gray-500"><th className="p-3">Requester</th><th className="p-3">Change</th><th className="p-3">Submitted</th><th className="p-3">Status</th>{mode !== 'student' && <th className="p-3">Actions</th>}</tr></thead><tbody>{rows.map(row => <tr className="border-b last:border-0" key={row.id}><td className="p-3"><div className="font-medium">{row.requester_name}</div><div className="text-xs text-gray-500">{row.roll_number || row.requester_role}</div></td><td className="p-3">{Object.entries(row.requested_changes).map(([k, v]) => <div key={k}><b>{k.replace('_', ' ')}:</b> {String(row.old_values?.[k] ?? '—')} → {String(v)}</div>)}{row.rejection_reason && <p className="mt-1 text-red-600">Reason: {row.rejection_reason}</p>}</td><td className="p-3">{row.submitted_at ? new Date(row.submitted_at).toLocaleString() : '—'}</td><td className="p-3"><Badge variant={variant(row.status) as any}>{row.status}</Badge></td>{mode !== 'student' && <td className="p-3 whitespace-nowrap">{row.status === 'pending' && <><button disabled={reviewing === row.id} onClick={() => review(row.id, 'approve')} className="btn-primary mr-2">Approve</button><button disabled={reviewing === row.id} onClick={() => review(row.id, 'reject')} className="btn-secondary text-red-600">Reject</button></>}</td>}</tr>)}</tbody></table></div>}</Card></>
}
