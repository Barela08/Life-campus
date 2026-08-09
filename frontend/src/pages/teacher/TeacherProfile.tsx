import React, { useEffect, useState } from 'react'
import api from '../../lib/api'
import TeacherLayout from '../../components/TeacherLayout'
import { PageHeader, Card } from '../../components/ui'
import { useAuth } from '../../store/auth'
import toast from 'react-hot-toast'
import { Mail, Phone, Building2, User } from 'lucide-react'

export default function TeacherProfile() {
  const { user } = useAuth()
  const [profile, setProfile] = useState<any>(null)
  const [oldP, setOldP] = useState('')
  const [newP, setNewP] = useState('')
  const [confirm, setConfirm] = useState('')

  useEffect(() => {
    api.get('/teacher/dashboard').then(res => setProfile(res.data)).catch(() => {})
  }, [])

  const changePwd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (newP !== confirm) { toast.error('Passwords do not match'); return }
    try { await api.post('/auth/change-password', { old_password: oldP, new_password: newP }); toast.success('Password changed'); setOldP(''); setNewP(''); setConfirm('') }
    catch (err: any) { toast.error(err.response?.data?.detail || 'Failed') }
  }

  return (
    <TeacherLayout>
      <PageHeader title="Profile" subtitle="Your account information" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 rounded-2xl bg-primary-500 text-white flex items-center justify-center text-2xl font-bold">{profile?.full_name?.charAt(0) || 'T'}</div>
            <div>
              <h3 className="text-lg font-semibold">{profile?.full_name}</h3>
              <p className="text-sm text-gray-400">{profile?.teacher_id}</p>
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-300"><User size={16} className="text-gray-400" /> {user?.full_name}</div>
            <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-300"><Mail size={16} className="text-gray-400" /> {user?.email || '—'}</div>
            <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-300"><Building2 size={16} className="text-gray-400" /> Role: Teacher</div>
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
        <Card>
          <h3 className="font-semibold mb-4">Notifications</h3>
          <p className="text-sm text-gray-500">You'll receive notifications for attendance sessions and unknown face alerts.</p>
        </Card>
      </div>
    </TeacherLayout>
  )
}
