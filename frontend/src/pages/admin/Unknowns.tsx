import React, { useEffect, useState } from 'react'
import api from '../../lib/api'
import AdminLayout from '../../components/AdminLayout'
import { PageHeader, Badge, Empty, Loading } from '../../components/ui'
import { AlertTriangle, Camera, User, BookOpen, Building2, Layers, ShieldAlert, RefreshCw } from 'lucide-react'
import toast from 'react-hot-toast'

export default function Unknowns() {
  const [logs, setLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try {
      const res = await api.get('/admin/unknowns')
      setLogs(res.data)
    } catch {
      toast.error('Failed to load unknown face logs')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  return (
    <AdminLayout>
      <PageHeader
        title="Unknown Face Alerts"
        subtitle="Faces detected that were not recognized or fell below match threshold"
        actions={
          <button onClick={load} className="btn-secondary flex items-center gap-2">
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        }
      />

      {loading ? (
        <Loading />
      ) : logs.length === 0 ? (
        <Empty message="No unknown faces detected" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {logs.map(l => (
            <div key={l.id} className="card overflow-hidden hover:shadow-xl transition-all border border-amber-200/50 dark:border-amber-900/20">
              <div className="relative h-48 bg-gray-950 flex items-center justify-center overflow-hidden">
                {l.snapshot ? (
                  <img
                    src={l.snapshot.startsWith('/') ? l.snapshot : `/uploads/${l.snapshot.split('/').pop()}`}
                    alt="Unknown Face"
                    className="w-full h-full object-contain"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none'
                    }}
                  />
                ) : (
                  <div className="flex flex-col items-center gap-2 text-amber-500/60">
                    <AlertTriangle size={48} />
                    <span className="text-xs font-mono">No Image Frame</span>
                  </div>
                )}
                <div className="absolute top-3 right-3">
                  <Badge variant={l.status === 'Low Confidence' ? 'yellow' : 'red'}>
                    {l.status || 'Unrecognized'}
                  </Badge>
                </div>
                {l.confidence > 0 && (
                  <div className="absolute bottom-3 left-3 px-2.5 py-1 rounded-md bg-black/70 backdrop-blur text-[11px] font-mono text-white">
                    Score: {(l.confidence * 100).toFixed(1)}%
                  </div>
                )}
              </div>

              <div className="p-5 space-y-3">
                <div>
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-gray-900 dark:text-white flex items-center gap-1.5 text-base">
                      <ShieldAlert size={16} className="text-amber-500 shrink-0" />
                      {l.reason || 'Unrecognized Face'}
                    </h4>
                  </div>
                  <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                    <Camera size={12} /> Camera: <span className="font-mono">{l.camera_id || 'Terminal 1'}</span>
                  </p>
                </div>

                <div className="space-y-1.5 text-xs text-gray-600 dark:text-gray-300 pt-2 border-t border-gray-100 dark:border-gray-800">
                  {l.department && (
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400 flex items-center gap-1"><Building2 size={12} /> Dept:</span>
                      <span className="font-medium truncate max-w-[180px]">{l.department}</span>
                    </div>
                  )}
                  {l.class_name && (
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400 flex items-center gap-1"><Layers size={12} /> Class:</span>
                      <span className="font-medium truncate max-w-[180px]">{l.class_name}</span>
                    </div>
                  )}
                  {l.subject && (
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400 flex items-center gap-1"><BookOpen size={12} /> Subject:</span>
                      <span className="font-medium truncate max-w-[180px]">{l.subject}</span>
                    </div>
                  )}
                  {l.teacher && (
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400 flex items-center gap-1"><User size={12} /> Teacher:</span>
                      <span className="font-medium truncate max-w-[180px]">{l.teacher}</span>
                    </div>
                  )}
                </div>

                <div className="pt-2 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between text-[11px] text-gray-400">
                  <span>Detected At:</span>
                  <span className="font-mono text-gray-600 dark:text-gray-300 font-medium">
                    {new Date(l.detected_at).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </AdminLayout>
  )
}
