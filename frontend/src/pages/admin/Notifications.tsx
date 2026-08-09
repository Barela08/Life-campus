import React, { useEffect, useState } from 'react'
import api from '../../lib/api'
import AdminLayout from '../../components/AdminLayout'
import { PageHeader, Empty, Loading, Badge } from '../../components/ui'
import { Bell, CheckCircle2 } from 'lucide-react'
import toast from 'react-hot-toast'

export default function AdminNotifications() {
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try { setItems((await api.get('/admin/notifications')).data) } catch { toast.error('Failed') } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const markRead = async (id: number) => {
    try { await api.post(`/admin/notifications/${id}/read`, {}); load() } catch {}
  }

  return (
    <AdminLayout>
      <PageHeader title="Notifications" subtitle="System notifications" />
      {loading ? <Loading /> : items.length === 0 ? <Empty message="No notifications" /> : (
        <div className="space-y-3">
          {items.map(n => (
            <div key={n.id} className={`card p-4 flex items-start gap-3 animate-fade-in ${n.is_read ? 'opacity-60' : ''}`}>
              <div className="w-9 h-9 rounded-lg bg-primary-100 dark:bg-primary-500/20 flex items-center justify-center text-primary-600 shrink-0"><Bell size={16} /></div>
              <div className="flex-1">
                <p className="font-medium text-sm">{n.title}</p>
                <p className="text-sm text-gray-500">{n.message}</p>
                <p className="text-xs text-gray-400 mt-1">{new Date(n.created_at).toLocaleString()}</p>
              </div>
              <Badge variant={n.type === 'success' ? 'green' : n.type === 'warning' ? 'yellow' : 'blue'}>{n.type}</Badge>
              {!n.is_read && <button onClick={() => markRead(n.id)} title="Mark read" className="p-1.5 rounded-lg hover:bg-emerald-50 text-emerald-600"><CheckCircle2 size={16} /></button>}
            </div>
          ))}
        </div>
      )}
    </AdminLayout>
  )
}
