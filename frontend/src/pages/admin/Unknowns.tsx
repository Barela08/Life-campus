import React, { useEffect, useState } from 'react'
import api from '../../lib/api'
import AdminLayout from '../../components/AdminLayout'
import { PageHeader, Badge, Empty, Loading } from '../../components/ui'
import { AlertTriangle, Camera, User, BookOpen, Building2, Layers, ShieldAlert, RefreshCw, Trash2, ZoomIn, X } from 'lucide-react'
import toast from 'react-hot-toast'

export default function Unknowns() {
  const [logs, setLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedImg, setSelectedImg] = useState<string | null>(null)
  const [imgErrors, setImgErrors] = useState<Record<number, boolean>>({})

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

  const handleDelete = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this unknown face alert?')) return
    try {
      await api.delete(`/admin/unknowns/${id}`)
      toast.success('Unknown face log deleted')
      setLogs(prev => prev.filter(l => l.id !== id))
    } catch {
      toast.error('Failed to delete record')
    }
  }

  const handleClearAll = async () => {
    if (!window.confirm('Are you sure you want to delete ALL unknown face alerts?')) return
    try {
      await api.delete('/admin/unknowns')
      toast.success('All unknown face alerts cleared')
      setLogs([])
    } catch {
      toast.error('Failed to clear unknown face logs')
    }
  }

  const getSnapshotUrl = (snapshot?: string) => {
    if (!snapshot) return null
    if (snapshot.startsWith('data:image') || snapshot.startsWith('http://') || snapshot.startsWith('https://')) {
      return snapshot
    }
    const clean = snapshot.replace(/\\/g, '/')
    if (clean.startsWith('/uploads/')) return clean
    const filename = clean.split('/').pop()
    if (!filename) return null
    if (clean.includes('unknowns')) {
      return `/uploads/unknowns/${filename}`
    }
    return `/uploads/${filename}`
  }

  return (
    <AdminLayout>
      <PageHeader
        title="Unknown Face Alerts"
        subtitle="Faces detected that were not recognized or fell below match threshold"
        actions={
          <div className="flex items-center gap-2">
            {logs.length > 0 && (
              <button onClick={handleClearAll} className="btn-danger flex items-center gap-1.5 text-xs py-2 px-3">
                <Trash2 size={15} /> Clear All
              </button>
            )}
            <button onClick={load} className="btn-secondary flex items-center gap-2 py-2 px-3 text-xs">
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Refresh
            </button>
          </div>
        }
      />

      {loading ? (
        <Loading />
      ) : logs.length === 0 ? (
        <Empty message="No unknown faces detected" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {logs.map(l => {
            const imgUrl = getSnapshotUrl(l.snapshot)
            const hasError = imgErrors[l.id]

            return (
              <div key={l.id} className="card overflow-hidden hover:shadow-xl transition-all border border-amber-200/50 dark:border-amber-900/20 group">
                <div className="relative h-52 bg-slate-900 flex items-center justify-center overflow-hidden">
                  {imgUrl && !hasError ? (
                    <>
                      <img
                        src={imgUrl}
                        alt="Unknown Face"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 cursor-pointer"
                        onClick={() => setSelectedImg(imgUrl)}
                        onError={() => {
                          setImgErrors(prev => ({ ...prev, [l.id]: true }))
                        }}
                      />
                      <button
                        onClick={() => setSelectedImg(imgUrl)}
                        className="absolute bottom-3 right-3 p-1.5 rounded-lg bg-black/60 backdrop-blur text-white hover:bg-black/80 transition-colors opacity-0 group-hover:opacity-100"
                        title="Zoom Image"
                      >
                        <ZoomIn size={16} />
                      </button>
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center gap-2 text-amber-400/80 p-4 text-center">
                      <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-400">
                        <AlertTriangle size={24} />
                      </div>
                      <span className="text-xs font-medium text-slate-300">
                        {hasError ? 'Image Frame Unavailable' : 'No Image Frame'}
                      </span>
                    </div>
                  )}

                  <div className="absolute top-3 right-3 flex items-center gap-2">
                    <Badge variant={l.status === 'Low Confidence' ? 'yellow' : 'red'}>
                      {l.status || 'Unrecognized'}
                    </Badge>
                  </div>

                  <div className="absolute top-3 left-3">
                    <button
                      onClick={() => handleDelete(l.id)}
                      className="p-1.5 rounded-lg bg-red-600/80 hover:bg-red-600 text-white backdrop-blur transition-all shadow-md"
                      title="Delete Record"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>

                  {l.confidence > 0 && (
                    <div className="absolute bottom-3 left-3 px-2.5 py-1 rounded-md bg-black/75 backdrop-blur text-[11px] font-mono text-emerald-400 border border-emerald-500/30">
                      Score: {(l.confidence * 100).toFixed(1)}%
                    </div>
                  )}
                </div>

                <div className="p-5 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="font-bold text-gray-900 dark:text-white flex items-center gap-1.5 text-sm">
                        <ShieldAlert size={16} className="text-amber-500 shrink-0" />
                        {l.reason || 'Unrecognized Face'}
                      </h4>
                      <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                        <Camera size={12} /> Camera: <span className="font-mono text-gray-300">{l.camera_id || 'Terminal 1'}</span>
                      </p>
                    </div>
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
            )
          })}
        </div>
      )}

      {/* Image Preview Modal */}
      {selectedImg && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setSelectedImg(null)}
        >
          <div className="relative max-w-3xl max-h-[90vh] bg-slate-900 rounded-2xl overflow-hidden p-2 border border-slate-700 shadow-2xl">
            <button
              onClick={() => setSelectedImg(null)}
              className="absolute top-4 right-4 p-2 rounded-full bg-black/60 hover:bg-black text-white z-10"
            >
              <X size={20} />
            </button>
            <img
              src={selectedImg}
              alt="Detected Unknown Face Full View"
              className="w-full h-auto max-h-[85vh] object-contain rounded-xl"
            />
          </div>
        </div>
      )}
    </AdminLayout>
  )
}
