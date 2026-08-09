import React, { useEffect, useState } from 'react'
import api from '../../lib/api'
import AdminLayout from '../../components/AdminLayout'
import { PageHeader, Badge, Empty, Loading } from '../../components/ui'
import { AlertTriangle } from 'lucide-react'
import toast from 'react-hot-toast'

export default function Unknowns() {
  const [logs, setLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try { setLogs((await api.get('/admin/unknowns')).data) } catch { toast.error('Failed') } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  return (
    <AdminLayout>
      <PageHeader title="Unknown Face Alerts" subtitle="Faces detected that were not recognized" />
      {loading ? <Loading /> : logs.length === 0 ? <Empty message="No unknown faces detected" /> : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {logs.map(l => (
            <div key={l.id} className="card p-4 animate-fade-in">
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-lg bg-orange-100 dark:bg-orange-500/20 flex items-center justify-center overflow-hidden">
                  {l.snapshot ? <img src={`/uploads/${l.snapshot.split('/').pop()}`} className="w-full h-full object-cover" /> : <AlertTriangle className="text-orange-600" size={20} />}
                </div>
                <div className="flex-1">
                  <p className="font-medium text-sm">Unknown Person</p>
                  <p className="text-xs text-gray-400">Camera: {l.camera_id}</p>
                  <p className="text-xs text-gray-400 mt-1">{new Date(l.detected_at).toLocaleString()}</p>
                  <div className="mt-2"><Badge variant="yellow">Notified</Badge></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </AdminLayout>
  )
}
