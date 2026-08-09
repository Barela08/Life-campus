import React, { useEffect, useState } from 'react'
import api from '../../lib/api'
import TeacherLayout from '../../components/TeacherLayout'
import { PageHeader, Badge, Empty, Loading, SearchInput } from '../../components/ui'
import toast from 'react-hot-toast'

export default function TeacherStudents() {
  const [students, setStudents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const load = async () => {
    setLoading(true)
    try { setStudents((await api.get('/teacher/students')).data) } catch { toast.error('Failed') } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const filtered = students.filter(s => s.full_name.toLowerCase().includes(search.toLowerCase()) || s.student_id.toLowerCase().includes(search.toLowerCase()))

  return (
    <TeacherLayout>
      <PageHeader title="Students" subtitle="Students in your department" />
      <div className="mb-4"><SearchInput value={search} onChange={setSearch} placeholder="Search students..." /></div>
      {loading ? <Loading /> : filtered.length === 0 ? <Empty message="No students found" /> : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
                <th className="table-header">Student</th><th className="table-header">ID</th><th className="table-header">Roll</th><th className="table-header">Email</th><th className="table-header">Face Status</th>
              </tr></thead>
              <tbody>
                {filtered.map(s => (
                  <tr key={s.id} className="border-b border-gray-50 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="table-cell font-medium">{s.full_name}</td>
                    <td className="table-cell">{s.student_id}</td>
                    <td className="table-cell">{s.roll_number}</td>
                    <td className="table-cell">{s.email}</td>
                    <td className="table-cell"><Badge variant={s.face_status === 'approved' ? 'green' : s.face_status === 'pending' ? 'yellow' : 'red'}>{s.face_status}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </TeacherLayout>
  )
}
