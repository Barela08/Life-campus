import React, { useEffect, useState } from 'react'
import api, { apiErrorMessage } from '../../lib/api'
import { PageHeader, Card, Badge } from '../../components/ui'
import toast from 'react-hot-toast'
import { Mail, Phone, Building2, User, Hash, GraduationCap, Save, Loader, Percent } from 'lucide-react'
import { useAuth } from '../../store/auth'

export default function StudentProfile() {
  const { user, updateProfile, refreshUser } = useAuth()
  const [profile, setProfile] = useState<any>(null)
  const [options, setOptions] = useState<any>({ departments: [], courses: [], semesters: [], classes: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)
  const [oldP, setOldP] = useState('')
  const [newP, setNewP] = useState('')
  const [confirm, setConfirm] = useState('')

  useEffect(() => {
    Promise.all([api.get('/student/profile'), api.get('/approvals/profile/options')])
      .then(([profileRes, optionsRes]) => { setProfile(profileRes.data); setOptions(optionsRes.data) })
      .catch(err => setError(apiErrorMessage(err, 'Failed to load profile')))
      .finally(() => setLoading(false))
  }, [])

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setSavingProfile(true)
    try {
      await updateProfile({
        full_name: profile.full_name,
        email: profile.email,
        phone: profile.phone,
        roll_number: profile.roll_number,
        department_id: Number(profile.department_id),
        course_id: Number(profile.course_id),
        semester_id: Number(profile.semester_id),
        class_id: Number(profile.class_id),
        section: profile.section,
      })
      await refreshUser() // Refresh user from token
      const res = await api.get('/student/profile') // Re-fetch student-specific profile data
      setProfile(res.data)
      toast.success('Profile change request submitted successfully')
    } catch (err: any) {
      toast.error(apiErrorMessage(err, 'Could not save profile'))
    } finally {
      setSavingProfile(false)
    }
  }

  const changePwd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (newP !== confirm) { toast.error('Passwords do not match'); return }
    try { await api.post('/auth/change-password', { old_password: oldP, new_password: newP }); toast.success('Password changed'); setOldP(''); setNewP(''); setConfirm('') }
    catch (err: any) { toast.error(err.response?.data?.detail || 'Failed') }
  }

  if (loading) return <><PageHeader title="Profile" /><div className="text-center p-8">Loading...</div></>
  if (error) return <><PageHeader title="Profile" /><div className="text-center p-8 text-red-500">{error}</div></>
  if (!profile) return <PageHeader title="Profile" subtitle="Your account information" />

  return (
    <>
      <PageHeader title="Profile" subtitle="Your account information" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card>
            <div className="flex items-center gap-4 mb-6">
              <img src={profile.profile_photo || `https://ui-avatars.com/api/?name=${profile.full_name}&background=random`} alt="Profile" className="w-16 h-16 rounded-2xl object-cover" />
              <div>
                <h3 className="text-lg font-semibold">{profile.full_name || 'Not available'}</h3>
                <p className="text-sm text-gray-400">{profile.student_id || 'Not available'}</p>
                <div className="mt-1"><Badge variant={profile.face_status === 'approved' ? 'green' : 'yellow'}>{profile.face_status || 'Not available'}</Badge></div>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 mb-6">
              <div className="flex items-center gap-3 text-sm"><User size={16} className="text-gray-400 shrink-0" /> <span className="font-semibold">Name:</span> {profile.full_name || 'Not available'}</div>
              <div className="flex items-center gap-3 text-sm"><Hash size={16} className="text-gray-400 shrink-0" /> <span className="font-semibold">Roll No:</span> {profile.roll_number || 'Not available'}</div>
              <div className="flex items-center gap-3 text-sm"><Mail size={16} className="text-gray-400 shrink-0" /> <span className="font-semibold">Email:</span> {profile.email || 'Not available'}</div>
              <div className="flex items-center gap-3 text-sm"><Phone size={16} className="text-gray-400 shrink-0" /> <span className="font-semibold">Phone:</span> {profile.phone || 'Not available'}</div>
              <div className="flex items-center gap-3 text-sm"><Building2 size={16} className="text-gray-400 shrink-0" /> <span className="font-semibold">Department:</span> {profile.department || 'Not available'}</div>
              <div className="flex items-center gap-3 text-sm"><GraduationCap size={16} className="text-gray-400 shrink-0" /> <span className="font-semibold">Course:</span> {profile.course || 'Not available'}</div>
              <div className="flex items-center gap-3 text-sm"><GraduationCap size={16} className="text-gray-400 shrink-0" /> <span className="font-semibold">Semester:</span> {profile.semester || 'Not available'}</div>
              <div className="flex items-center gap-3 text-sm"><GraduationCap size={16} className="text-gray-400 shrink-0" /> <span className="font-semibold">Class:</span> {profile.class_name || 'Not available'}</div>
              <div className="flex items-center gap-3 text-sm"><GraduationCap size={16} className="text-gray-400 shrink-0" /> <span className="font-semibold">Section:</span> {profile.section || 'Not available'}</div>
              <div className="flex items-center gap-3 text-sm"><Percent size={16} className="text-gray-400 shrink-0" /> <span className="font-semibold">Attendance:</span> {profile.attendance_percentage ?? 'Not available'}%</div>
            </div>

            <form onSubmit={saveProfile} className="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <p className="text-sm font-semibold">Edit Profile</p>
              <p className="text-xs text-gray-500 -mt-2">All changes are sent to the admin for approval. Attendance and Student ID cannot be edited.</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><label className="label">Full Name</label><input className="input" required value={profile.full_name || ''} onChange={e => setProfile({ ...profile, full_name: e.target.value })} /></div>
                <div><label className="label">Roll No.</label><input className="input" required value={profile.roll_number || ''} onChange={e => setProfile({ ...profile, roll_number: e.target.value })} /></div>
                <div><label className="label">Email</label><input className="input" type="email" required value={profile.email || ''} onChange={e => setProfile({ ...profile, email: e.target.value })} /></div>
                <div><label className="label">Phone</label><input className="input" value={profile.phone || ''} onChange={e => setProfile({ ...profile, phone: e.target.value })} /></div>
                <div><label className="label">Department</label><select className="input" required value={profile.department_id || ''} onChange={e => setProfile({ ...profile, department_id: +e.target.value, course_id: '', class_id: '' })}><option value="">Select department</option>{options.departments.map((item: any) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
                <div><label className="label">Course</label><select className="input" required value={profile.course_id || ''} onChange={e => setProfile({ ...profile, course_id: +e.target.value, class_id: '' })}><option value="">Select course</option>{options.courses.filter((item: any) => item.department_id === +profile.department_id).map((item: any) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
                <div><label className="label">Semester</label><select className="input" required value={profile.semester_id || ''} onChange={e => setProfile({ ...profile, semester_id: +e.target.value, class_id: '' })}><option value="">Select semester</option>{options.semesters.map((item: any) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
                <div><label className="label">Class</label><select className="input" required value={profile.class_id || ''} onChange={e => setProfile({ ...profile, class_id: +e.target.value })}><option value="">Select class</option>{options.classes.filter((item: any) => item.course_id === +profile.course_id && item.semester_id === +profile.semester_id).map((item: any) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
                <div><label className="label">Section</label><input className="input" required value={profile.section || ''} onChange={e => setProfile({ ...profile, section: e.target.value })} /></div>
              </div>
              <button type="submit" disabled={savingProfile} className="btn-primary flex items-center gap-2">
                {savingProfile ? <Loader size={16} className="animate-spin" /> : <Save size={16} />}
                {savingProfile ? 'Saving...' : 'Save Changes'}
              </button>
            </form>
          </Card>
        </div>
        <div>
          <Card>
            <h3 className="font-semibold mb-4">Change Password</h3>
            <form onSubmit={changePwd} className="space-y-4">
              <div><label className="label">Current Password</label><input type="password" className="input" value={oldP} onChange={e => setOldP(e.target.value)} required /></div>
              <div><label className="label">New Password</label><input type="password" className="input" value={newP} onChange={e => setNewP(e.target.value)} required /></div>
              <div><label className="label">Confirm New Password</label><input type="password" className="input" value={confirm} onChange={e => setConfirm(e.target.value)} required /></div>
              <button className="btn-primary w-full">Update Password</button>
            </form>
          </Card>
        </div>
      </div>
    </>
  )
}

