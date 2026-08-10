import React, { useEffect, useState } from 'react'
import api, { apiErrorMessage } from '../../lib/api'
import AdminLayout from '../../components/AdminLayout'
import { PageHeader, Modal, Empty, Loading, SearchInput } from '../../components/ui'
import toast from 'react-hot-toast'
import { Plus, Trash2, GraduationCap, Pencil } from 'lucide-react'

export default function Teachers() {
  const [teachers, setTeachers] = useState<any[]>([])
  const [depts, setDepts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState<any>({ password: '1234' })

  const load = async () => {
    setLoading(true)
    try {
      const [t, d] = await Promise.all([api.get('/admin/teachers'), api.get('/admin/departments')])
      setTeachers(t.data); setDepts(d.data)
    } catch { toast.error('Failed') } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (form.id) {
        const payload: any = {
          full_name: form.full_name,
          teacher_id: form.teacher_id,
          email: form.email,
          phone: form.phone,
          department_id: +form.department_id,
        }
        if (form.password) payload.password = form.password
        const res = await api.put(`/admin/teachers/${form.id}`, payload)
        setTeachers(prev => prev.map(t => (t.id === form.id ? res.data : t)))
        toast.success('Teacher updated')
      } else {
        const res = await api.post('/admin/teachers', { ...form, department_id: +form.department_id })
        setTeachers(prev => [res.data, ...prev])
        toast.success('Teacher added')
      }
      setModal(false)
      await load()
    }
    catch (err: any) { toast.error(apiErrorMessage(err, 'Failed to save')) }
  }

  const remove = async (id: number) => {
    if (!confirm('Delete teacher?')) return
    try { await api.delete(`/admin/teachers/${id}`); toast.success('Deleted'); setTeachers(prev => prev.filter(t => t.id !== id)); load() } catch (err: any) { toast.error(apiErrorMessage(err, 'Failed to delete')) }
  }

  const filtered = teachers.filter(t => t.full_name.toLowerCase().includes(search.toLowerCase()) || t.teacher_id.toLowerCase().includes(search.toLowerCase()))

  return (
    <AdminLayout>
      <PageHeader
        title="Teachers"
        subtitle="Manage teaching staff"
        actions={<button onClick={() => { setForm({ password: '1234' }); setModal(true) }} className="btn-primary flex items-center gap-2"><Plus size={16} /> Add Teacher</button>}
      />
      <div className="mb-4"><SearchInput value={search} onChange={setSearch} placeholder="Search teachers..." /></div>
      {loading ? <Loading /> : filtered.length === 0 ? <Empty message="No teachers found" /> : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(t => (
            <div key={t.id} className="card p-5 flex items-start justify-between animate-fade-in">
              <div className="flex gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center text-emerald-600"><GraduationCap size={18} /></div>
                <div>
                  <p className="font-semibold">{t.full_name}</p>
                  <p className="text-xs text-gray-400">{t.teacher_id}</p>
                  <p className="text-xs text-gray-500 mt-1">{t.email}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{depts.find(d => d.id === t.department_id)?.name || '-'}</p>
                </div>
              </div>
              <div className="flex gap-1">
                <button onClick={() => { setForm({ ...t, password: '' }); setModal(true) }} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"><Pencil size={16} /></button>
                <button onClick={() => remove(t.id)} className="p-2 rounded-lg hover:bg-red-50 text-red-500"><Trash2 size={16} /></button>
              </div>
            </div>
          ))}
        </div>
      )}
      <Modal open={modal} onClose={() => setModal(false)} title={form.id ? 'Edit Teacher' : 'Add Teacher'}>
        <form onSubmit={save} className="space-y-4">
          <div><label className="label">Full Name</label><input className="input" required value={form.full_name || ''} onChange={e => setForm({ ...form, full_name: e.target.value })} /></div>
          <div><label className="label">Teacher ID</label><input className="input" required value={form.teacher_id || ''} onChange={e => setForm({ ...form, teacher_id: e.target.value })} /></div>
          <div><label className="label">Email</label><input className="input" type="email" required value={form.email || ''} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
          <div><label className="label">Phone</label><input className="input" value={form.phone || ''} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
          <div><label className="label">Department</label>
            <select className="input" required value={form.department_id || ''} onChange={e => setForm({ ...form, department_id: e.target.value })}>
              <option value="">Select</option>{depts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select></div>
          <div><label className="label">{form.id ? 'New Password (optional)' : 'Password'}</label><input className="input" type="password" value={form.password || ''} placeholder={form.id ? 'Leave blank to keep current password' : '1234'} onChange={e => setForm({ ...form, password: e.target.value })} /></div>
          <div className="flex justify-end gap-2"><button type="button" onClick={() => setModal(false)} className="btn-secondary">Cancel</button><button className="btn-primary">Save</button></div>
        </form>
      </Modal>
    </AdminLayout>
  )
}
