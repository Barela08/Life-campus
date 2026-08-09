import React, { useEffect, useState } from 'react'
import api from '../../lib/api'
import AdminLayout from '../../components/AdminLayout'
import { PageHeader, Modal, Empty, Loading } from '../../components/ui'
import toast from 'react-hot-toast'
import { Plus, Trash2, Building2 } from 'lucide-react'

export default function Departments() {
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({ name: '', code: '', description: '' })

  const load = async () => { setLoading(true); try { setItems((await api.get('/admin/departments')).data) } catch { toast.error('Failed') } finally { setLoading(false) } }
  useEffect(() => { load() }, [])

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    try { await api.post('/admin/departments', form); toast.success('Department added'); setModal(false); load() }
    catch (err: any) { toast.error(err.response?.data?.detail || 'Failed') }
  }

  const remove = async (id: number) => {
    if (!confirm('Delete this department?')) return
    try { await api.delete(`/admin/departments/${id}`); toast.success('Deleted'); load() } catch { toast.error('Failed to delete') }
  }

  return (
    <AdminLayout>
      <PageHeader title="Departments" subtitle="Manage departments" actions={<button onClick={() => setModal(true)} className="btn-primary flex items-center gap-2"><Plus size={16} /> Add Department</button>} />
      {loading ? <Loading /> : items.length === 0 ? <Empty message="No departments yet" /> : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map(d => (
            <div key={d.id} className="card p-5 flex items-start justify-between animate-fade-in">
              <div className="flex gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary-100 dark:bg-primary-500/20 flex items-center justify-center text-primary-600"><Building2 size={18} /></div>
                <div>
                  <p className="font-semibold">{d.name}</p>
                  <p className="text-xs text-gray-400">{d.code}</p>
                  {d.description && <p className="text-xs text-gray-500 mt-1">{d.description}</p>}
                </div>
              </div>
              <button onClick={() => remove(d.id)} className="p-2 rounded-lg hover:bg-red-50 text-red-500"><Trash2 size={16} /></button>
            </div>
          ))}
        </div>
      )}
      <Modal open={modal} onClose={() => setModal(false)} title="Add Department">
        <form onSubmit={save} className="space-y-4">
          <div><label className="label">Name</label><input className="input" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
          <div><label className="label">Code</label><input className="input" required value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} /></div>
          <div><label className="label">Description</label><textarea className="input" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
          <div className="flex justify-end gap-2"><button type="button" onClick={() => setModal(false)} className="btn-secondary">Cancel</button><button className="btn-primary">Save</button></div>
        </form>
      </Modal>
    </AdminLayout>
  )
}
