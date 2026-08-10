import React, { useEffect, useState } from 'react'
import api, { apiErrorMessage } from '../../lib/api'
import StudentLayout from '../../components/StudentLayout'
import { PageHeader, Card, Badge } from '../../components/ui'
import toast from 'react-hot-toast'
import { Mail, Phone, Building2, User, Hash, GraduationCap, Save, Loader } from 'lucide-react'

export default function StudentProfile() {
  const [profile, setProfile] = useState<any>(null)
  const [savingProfile, setSavingProfile] = useState(false)
  const [oldP, setOldP] = useState('')
  const [newP, setNewP] = useState('')
  const [confirm, setConfirm] = useState('')

  useEffect(() => {
    api.get('/student/profile').then(res => setProfile(res.data)).catch(() => {})
  }, [])

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setSavingProfile(true)
    try {
      await api.patch('/auth/me', {
        full_name: profile.full_name,
        email: profile.email,
        phone: profile.phone,
      })
      const res = await api.get('/student/profile')
      setProfile(res.data)
      toast.success('Profile updated successfully')
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

  if (!profile) return <StudentLayout><PageHeader title="Profile" subtitle="Your account information" /></StudentLayout>

  return (
    <StudentLayout>
      <PageHeader title="Profile" subtitle="Your account information" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 rounded-2xl bg-primary-500 text-white flex items-center justify-center text-2xl font-bold">{profile.full_name?.charAt(0)}</div>
            <div>
              <h3 className="text-lg font-semibold">{profile.full_name}</h3>
              <p className="text-sm text-gray-400">{profile.student_id}</p>
              <div className="mt-1"><Badge variant={profile.face_status === 'approved' ? 'green' : 'yellow'}>{profile.face_status}</Badge></div>
            </div>
          </div>
          <form onSubmit={saveProfile} className="space-y-4">
            <div><label className="label">Full Name</label><input className="input" required value={profile.full_name || ''} onChange={e => setProfile({ ...profile, full_name: e.target.value })} /></div>
            <div><label className="label">Email</label><input className="input" type="email" required value={profile.email || ''} onChange={e => setProfile({ ...profile, email: e.target.value })} /></div>
            <div><label className="label">Phone</label><input className="input" value={profile.phone || ''} onChange={e => setProfile({ ...profile, phone: e.target.value })} /></div>
            <button type="submit" disabled={savingProfile} className="btn-primary flex items-center gap-2">
              {savingProfile ? <Loader size={16} className="animate-spin" /> : <Save size={16} />}
              {savingProfile ? 'Saving...' : 'Save Changes'}
            </button>
          </form>
          <div className="space-y-3 mt-6">
            <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-300"><User size={16} className="text-gray-400" /> {profile.full_name}</div>
            <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-300"><Hash size={16} className="text-gray-400" /> Roll: {profile.roll_number}</div>
            <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-300"><Mail size={16} className="text-gray-400" /> {profile.email}</div>
            <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-300"><Phone size={16} className="text-gray-400" /> {profile.phone}</div>
            <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-300"><Building2 size={16} className="text-gray-400" /> {profile.department}</div>
            <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-300"><GraduationCap size={16} className="text-gray-400" /> {profile.course} • {profile.semester} • {profile.class_name}</div>
          </div>
        </Card>
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
    </StudentLayout>
  )
}
