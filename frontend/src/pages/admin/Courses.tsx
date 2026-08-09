import React, { useEffect, useState } from 'react'
import api from '../../lib/api'
import AdminLayout from '../../components/AdminLayout'
import { PageHeader, Modal, Empty, Loading, Badge } from '../../components/ui'
import toast from 'react-hot-toast'
import { Plus, Trash2, BookOpen, Layers } from 'lucide-react'

export default function Courses() {
  const [courses, setCourses] = useState<any[]>([])
  const [subjects, setSubjects] = useState<any[]>([])
  const [semesters, setSemesters] = useState<any[]>([])
  const [classes, setClasses] = useState<any[]>([])
  const [depts, setDepts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'courses' | 'subjects' | 'semesters' | 'classes'>('courses')
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState<any>({})

  const load = async () => {
    setLoading(true)
    try {
      const [c, s, se, cl, d] = await Promise.all([
        api.get('/admin/courses'), api.get('/admin/subjects'), api.get('/admin/semesters'),
        api.get('/admin/classes'), api.get('/admin/departments'),
      ])
      setCourses(c.data); setSubjects(s.data); setSemesters(se.data); setClasses(cl.data); setDepts(d.data)
    } catch { toast.error('Failed') } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (tab === 'courses') await api.post('/admin/courses', form)
      else if (tab === 'subjects') await api.post('/admin/subjects', form)
      else if (tab === 'semesters') await api.post('/admin/semesters', form)
      else await api.post('/admin/classes', form)
      toast.success('Created'); setModal(false); load()
    } catch (err: any) { toast.error(err.response?.data?.detail || 'Failed') }
  }

  const remove = async (kind: string, id: number) => {
    if (!confirm('Delete?')) return
    try { await api.delete(`/admin/${kind}/${id}`); toast.success('Deleted'); load() } catch { toast.error('Failed') }
  }

  const tabs = [
    { key: 'courses', label: 'Courses', count: courses.length },
    { key: 'subjects', label: 'Subjects', count: subjects.length },
    { key: 'semesters', label: 'Semesters', count: semesters.length },
    { key: 'classes', label: 'Classes', count: classes.length },
  ]

  const deptName = (id: number) => depts.find(d => d.id === id)?.name || '-'

  return (
    <AdminLayout>
      <PageHeader
        title="Courses & Subjects"
        subtitle="Manage academic structure"
        actions={<button onClick={() => { setForm({}); setModal(true) }} className="btn-primary flex items-center gap-2"><Plus size={16} /> Add</button>}
      />
      <div className="flex gap-2 mb-4 flex-wrap">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key as any)} className={`px-4 py-2 rounded-xl text-sm font-medium transition ${tab === t.key ? 'bg-primary-600 text-white' : 'bg-gray-100 dark:bg-gray-800 hover:bg-gray-200'}`}>
            {t.label} <span className="ml-1 opacity-70">({t.count})</span>
          </button>
        ))}
      </div>
      {loading ? <Loading /> : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
                <th className="table-header">Name</th><th className="table-header">Code</th>
                {tab === 'courses' && <th className="table-header">Department</th>}
                {tab === 'subjects' && <th className="table-header">Department</th>}
                {tab === 'classes' && <th className="table-header">Course</th>}
                <th className="table-header text-right">Actions</th></tr></thead>
              <tbody>
                {tab === 'courses' && courses.map(c => (
                  <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="table-cell font-medium">{c.name}</td><td className="table-cell">{c.code}</td>
                    <td className="table-cell">{deptName(c.department_id)}</td>
                    <td className="table-cell text-right"><button onClick={() => remove('courses', c.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-500"><Trash2 size={16} /></button></td>
                  </tr>
                ))}
                {tab === 'subjects' && subjects.map(s => (
                  <tr key={s.id} className="border-b border-gray-50 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="table-cell font-medium">{s.name}</td><td className="table-cell">{s.code}</td>
                    <td className="table-cell">{deptName(s.department_id)}</td>
                    <td className="table-cell text-right"><button onClick={() => remove('subjects', s.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-500"><Trash2 size={16} /></button></td>
                  </tr>
                ))}
                {tab === 'semesters' && semesters.map(s => (
                  <tr key={s.id} className="border-b border-gray-50 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="table-cell font-medium">{s.name}</td><td className="table-cell">{s.code}</td>
                    <td className="table-cell">{s.order}</td>
                    <td className="table-cell text-right"><button onClick={() => remove('semesters', s.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-500"><Trash2 size={16} /></button></td>
                  </tr>
                ))}
                {tab === 'classes' && classes.map(c => (
                  <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="table-cell font-medium">{c.name}</td><td className="table-cell">{c.code}</td>
                    <td className="table-cell">{courses.find(co => co.id === c.course_id)?.name || '-'}</td>
                    <td className="table-cell text-right"><button onClick={() => remove('classes', c.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-500"><Trash2 size={16} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title={`Add ${tab.slice(0, -1)}`}>
        <form onSubmit={save} className="space-y-4">
          <div><label className="label">Name</label><input className="input" required value={form.name || ''} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
          <div><label className="label">Code</label><input className="input" required value={form.code || ''} onChange={e => setForm({ ...form, code: e.target.value })} /></div>
          {(tab === 'courses' || tab === 'subjects') && (
            <div><label className="label">Department</label>
              <select className="input" required value={form.department_id || ''} onChange={e => setForm({ ...form, department_id: e.target.value })}>
                <option value="">Select</option>{depts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select></div>
          )}
          {tab === 'courses' && <div><label className="label">Duration</label><input className="input" value={form.duration || ''} onChange={e => setForm({ ...form, duration: e.target.value })} /></div>}
          {tab === 'semesters' && <div><label className="label">Order</label><input className="input" type="number" value={form.order || 1} onChange={e => setForm({ ...form, order: e.target.value })} /></div>}
          {tab === 'classes' && (
            <>
              <div><label className="label">Course</label>
                <select className="input" required value={form.course_id || ''} onChange={e => setForm({ ...form, course_id: e.target.value })}>
                  <option value="">Select</option>{courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select></div>
              <div><label className="label">Semester</label>
                <select className="input" required value={form.semester_id || ''} onChange={e => setForm({ ...form, semester_id: e.target.value })}>
                  <option value="">Select</option>{semesters.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select></div>
            </>
          )}
          <div className="flex justify-end gap-2"><button type="button" onClick={() => setModal(false)} className="btn-secondary">Cancel</button><button className="btn-primary">Save</button></div>
        </form>
      </Modal>
    </AdminLayout>
  )
}
