import React, { useEffect, useState } from 'react'
import api, { apiErrorMessage } from '../../lib/api'
import AdminLayout from '../../components/AdminLayout'
import { PageHeader, Modal, Empty, Loading } from '../../components/ui'
import toast from 'react-hot-toast'
import { Plus, Trash2, Pencil, BookOpen, Layers, GraduationCap, Building2, CalendarRange, Users } from 'lucide-react'

export default function Courses() {
  const [courses, setCourses] = useState<any[]>([])
  const [subjects, setSubjects] = useState<any[]>([])
  const [classes, setClasses] = useState<any[]>([])
  const [depts, setDepts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'courses' | 'subjects' | 'classes'>('courses')
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState<any>({})

  const load = async () => {
    setLoading(true)
    try {
      const [c, s, cl, d] = await Promise.all([
        api.get('/admin/courses'),
        api.get('/admin/subjects'),
        api.get('/admin/classes'),
        api.get('/admin/departments'),
      ])
      setCourses(c.data)
      setSubjects(s.data)
      setClasses(cl.data)
      setDepts(d.data)
    } catch {
      toast.error('Failed to load academic data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const tabLabel = (key: string) => {
    if (key === 'courses') return 'Course'
    if (key === 'subjects') return 'Subject'
    if (key === 'classes') return 'Class'
    return 'Item'
  }

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const payload = { ...form }
      if ('department_id' in payload) payload.department_id = +payload.department_id
      if ('course_id' in payload) payload.course_id = +payload.course_id

      // Auto-generate code from name if missing
      if (!payload.code && payload.name) {
        payload.code = payload.name.toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-+|-+$/g, '')
      }

      if (tab === 'courses' && payload.total_semesters) {
        payload.duration = payload.duration || `${payload.total_semesters} Semesters`
      }

      if (tab === 'classes' && !payload.section) {
        payload.section = 'Section A'
      }

      if (form.id) {
        const { id, ...body } = payload
        await api.put(`/admin/${tab}/${id}`, body)
        toast.success(`${tabLabel(tab)} updated successfully`)
      } else {
        await api.post(`/admin/${tab}`, payload)
        toast.success(`${tabLabel(tab)} created successfully`)
      }
      setModal(false)
      load()
    } catch (err: any) {
      toast.error(apiErrorMessage(err, 'Failed to save record'))
    }
  }

  const remove = async (kind: string, id: number) => {
    if (!confirm('Are you sure you want to delete this record?')) return
    try {
      await api.delete(`/admin/${kind}/${id}`)
      toast.success('Deleted successfully')
      load()
    } catch (err: any) {
      toast.error(apiErrorMessage(err, 'Failed to delete record'))
    }
  }

  const tabs = [
    { key: 'courses', label: 'Courses', count: courses.length, icon: <GraduationCap size={16} /> },
    { key: 'subjects', label: 'Subjects', count: subjects.length, icon: <BookOpen size={16} /> },
    { key: 'classes', label: 'Classes', count: classes.length, icon: <Layers size={16} /> },
  ]

  const deptName = (id: number) => depts.find(d => d.id === id)?.name || '-'

  return (
    <AdminLayout>
      <PageHeader
        title="Courses & Subjects Management"
        subtitle="Manage academic courses, subjects, class sections, and departments"
        actions={
          <button
            onClick={() => { setForm({}); setModal(true) }}
            className="btn-primary flex items-center gap-2 shadow-lg shadow-primary-500/20"
          >
            <Plus size={16} /> Add {tabLabel(tab)}
          </button>
        }
      />

      {/* Navigation Tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key as any)}
            className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 flex items-center gap-2.5 ${
              tab === t.key
                ? 'bg-primary-600 text-white shadow-lg shadow-primary-600/25 scale-[1.02]'
                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750'
            }`}
          >
            {t.icon}
            {t.label}
            <span className={`px-2 py-0.5 rounded-full text-xs font-mono font-bold ${
              tab === t.key ? 'bg-white/20 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
            }`}>
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {loading ? (
        <Loading />
      ) : (
        <div className="card overflow-hidden border border-gray-200 dark:border-gray-800 shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50/80 dark:bg-gray-800/50 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  <th className="px-5 py-3.5">Name</th>
                  {tab === 'courses' && (
                    <>
                      <th className="px-5 py-3.5">Department</th>
                      <th className="px-5 py-3.5">Semesters / Duration</th>
                    </>
                  )}
                  {tab === 'subjects' && (
                    <th className="px-5 py-3.5">Department</th>
                  )}
                  {tab === 'classes' && (
                    <>
                      <th className="px-5 py-3.5">Course</th>
                      <th className="px-5 py-3.5">Section(s)</th>
                    </>
                  )}
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800 text-sm">
                {tab === 'courses' && (
                  courses.length === 0 ? (
                    <tr><td colSpan={4}><Empty message="No courses found. Click Add Course to create one." /></td></tr>
                  ) : (
                    courses.map(c => (
                      <tr key={c.id} className="hover:bg-gray-50/80 dark:hover:bg-gray-800/40 transition-colors">
                        <td className="px-5 py-4 font-bold text-gray-900 dark:text-white flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-primary-500/10 dark:bg-primary-500/20 text-primary-600 dark:text-primary-400 flex items-center justify-center shrink-0">
                            <GraduationCap size={18} />
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900 dark:text-white">{c.name}</p>
                          </div>
                        </td>
                        <td className="px-5 py-4 text-gray-600 dark:text-gray-300 font-medium">{deptName(c.department_id)}</td>
                        <td className="px-5 py-4">
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 font-medium text-xs border border-blue-200 dark:border-blue-500/20">
                            <CalendarRange size={13} />
                            {c.duration || 'Standard Course'}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => { setForm(c); setModal(true) }}
                              className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300 transition-colors"
                              title="Edit Course"
                            >
                              <Pencil size={15} />
                            </button>
                            <button
                              onClick={() => remove('courses', c.id)}
                              className="p-2 rounded-xl hover:bg-red-50 dark:hover:bg-red-500/10 text-red-500 transition-colors"
                              title="Delete Course"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )
                )}

                {tab === 'subjects' && (
                  subjects.length === 0 ? (
                    <tr><td colSpan={3}><Empty message="No subjects found. Click Add Subject to create one." /></td></tr>
                  ) : (
                    subjects.map(s => (
                      <tr key={s.id} className="hover:bg-gray-50/80 dark:hover:bg-gray-800/40 transition-colors">
                        <td className="px-5 py-4 font-medium text-gray-900 dark:text-white flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                            <BookOpen size={18} />
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900 dark:text-white">{s.name}</p>
                          </div>
                        </td>
                        <td className="px-5 py-4 text-gray-600 dark:text-gray-300 font-medium">
                          {courses.find(c => c.id === s.course_id)?.name ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold text-xs border border-emerald-200 dark:border-emerald-500/20">
                              <BookOpen size={12} />
                              {courses.find(c => c.id === s.course_id)?.name}
                            </span>
                          ) : (
                            deptName(s.department_id)
                          )}
                        </td>
                        <td className="px-5 py-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => { setForm(s); setModal(true) }}
                              className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300 transition-colors"
                              title="Edit Subject"
                            >
                              <Pencil size={15} />
                            </button>
                            <button
                              onClick={() => remove('subjects', s.id)}
                              className="p-2 rounded-xl hover:bg-red-50 dark:hover:bg-red-500/10 text-red-500 transition-colors"
                              title="Delete Subject"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )
                )}

                {tab === 'classes' && (
                  classes.length === 0 ? (
                    <tr><td colSpan={4}><Empty message="No classes found. Click Add Class to create one." /></td></tr>
                  ) : (
                    classes.map(c => (
                      <tr key={c.id} className="hover:bg-gray-50/80 dark:hover:bg-gray-800/40 transition-colors">
                        <td className="px-5 py-4 font-medium text-gray-900 dark:text-white flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                            <Layers size={18} />
                          </div>
                          <span className="font-semibold text-gray-900 dark:text-white">{c.name}</span>
                        </td>
                        <td className="px-5 py-4 text-gray-600 dark:text-gray-300 font-medium">{courses.find(co => co.id === c.course_id)?.name || '-'}</td>
                        <td className="px-5 py-4">
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 font-medium text-xs border border-purple-200 dark:border-purple-500/20">
                            <Users size={12} />
                            {c.section || 'Section A'}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => { setForm(c); setModal(true) }}
                              className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300 transition-colors"
                            >
                              <Pencil size={15} />
                            </button>
                            <button
                              onClick={() => remove('classes', c.id)}
                              className="p-2 rounded-xl hover:bg-red-50 dark:hover:bg-red-500/10 text-red-500 transition-colors"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add / Edit Modal */}
      <Modal open={modal} onClose={() => setModal(false)} title={`${form.id ? 'Edit' : 'Add'} ${tabLabel(tab)}`}>
        <form onSubmit={save} className="space-y-4">
          <div>
            <label className="label">Name *</label>
            <input
              className="input w-full"
              required
              placeholder={
                tab === 'courses' ? 'e.g. B.Tech Computer Science' :
                tab === 'subjects' ? 'e.g. Data Structures & Algorithms' : 'e.g. B.Tech IT'
              }
              value={form.name || ''}
              onChange={e => setForm({ ...form, name: e.target.value })}
            />
          </div>

          {(tab === 'courses' || tab === 'subjects') && (
            <div>
              <label className="label flex items-center gap-1">
                <Building2 size={13} /> Department *
              </label>
              <select
                className="input w-full"
                required
                value={form.department_id || ''}
                onChange={e => setForm({ ...form, department_id: e.target.value })}
              >
                <option value="">Select Department</option>
                {depts.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
          )}

          {tab === 'subjects' && (
            <div>
              <label className="label flex items-center gap-1">
                <BookOpen size={13} /> Associated Course
              </label>
              <select
                className="input w-full"
                value={form.course_id || ''}
                onChange={e => {
                  const cId = e.target.value
                  const foundCourse = courses.find(c => String(c.id) === String(cId))
                  setForm({
                    ...form,
                    course_id: cId,
                    department_id: foundCourse ? foundCourse.department_id : form.department_id
                  })
                }}
              >
                <option value="">Select Course</option>
                {courses.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          )}

          {tab === 'courses' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Total Semesters Count</label>
                <select
                  className="input w-full"
                  value={form.total_semesters || ''}
                  onChange={e => {
                    const count = e.target.value
                    setForm({
                      ...form,
                      total_semesters: count,
                      duration: count ? `${count} Semesters` : form.duration
                    })
                  }}
                >
                  <option value="">Select Semesters Count</option>
                  <option value="2">2 Semesters (1 Year)</option>
                  <option value="4">4 Semesters (2 Years)</option>
                  <option value="6">6 Semesters (3 Years)</option>
                  <option value="8">8 Semesters (4 Years)</option>
                  <option value="10">10 Semesters (5 Years)</option>
                </select>
              </div>
              <div>
                <label className="label">Custom Duration</label>
                <input
                  className="input w-full"
                  placeholder="e.g. 4 Years / 8 Semesters"
                  value={form.duration || ''}
                  onChange={e => setForm({ ...form, duration: e.target.value })}
                />
              </div>
            </div>
          )}

          {tab === 'classes' && (
            <>
              <div>
                <label className="label">Course *</label>
                <select
                  className="input w-full"
                  required
                  value={form.course_id || ''}
                  onChange={e => setForm({ ...form, course_id: e.target.value })}
                >
                  <option value="">Select Course</option>
                  {courses.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="label flex items-center justify-between">
                  <span className="flex items-center gap-1"><Users size={13} className="text-purple-500" /> Section(s)</span>
                  <span className="text-xs text-gray-400 font-normal">e.g. Section A, Section B</span>
                </label>
                <input
                  className="input w-full"
                  placeholder="e.g. Section A, Section B"
                  value={form.section || ''}
                  onChange={e => setForm({ ...form, section: e.target.value })}
                />
                <div className="flex gap-1.5 mt-2 flex-wrap text-xs">
                  {['Section A', 'Section B', 'Section C', 'Section A, Section B'].map(sec => (
                    <button
                      key={sec}
                      type="button"
                      onClick={() => setForm({ ...form, section: sec })}
                      className="px-2.5 py-1 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-primary-50 dark:hover:bg-primary-900/30 hover:text-primary-600 transition"
                    >
                      + {sec}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          <div className="flex justify-end gap-2 pt-4 border-t border-gray-100 dark:border-gray-800">
            <button
              type="button"
              onClick={() => setModal(false)}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button type="submit" className="btn-primary">
              Save {tabLabel(tab)}
            </button>
          </div>
        </form>
      </Modal>
    </AdminLayout>
  )
}
