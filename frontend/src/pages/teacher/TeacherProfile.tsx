import React, { useEffect, useState } from 'react'
import api from '../../lib/api'
import TeacherLayout from '../../components/TeacherLayout'
import { PageHeader, Card } from '../../components/ui'
import { useAuth } from '../../store/auth'
import toast from 'react-hot-toast'
import { Mail, Phone, Building2, User, Save, Lock, Loader } from 'lucide-react'

export default function TeacherProfile() {
  const { user, changePassword, updateProfile, refreshUser } = useAuth()

  // Profile form
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Password form
  const [oldP, setOldP] = useState('')
  const [newP, setNewP] = useState('')
  const [confirm, setConfirm] = useState('')
  const [pwdSaving, setPwdSaving] = useState(false)

  useEffect(() => {
    setFullName(user?.full_name || '')
    setEmail(user?.email || '')
    setPhone(user?.phone || '')
    api.get('/auth/me').then(res => {
      setFullName(res.data.full_name || '')
      setEmail(res.data.email || '')
      setPhone(res.data.phone || '')
    }).catch(() => {}).finally(() => setLoading(false))
  }, [user?.id])

  const submitProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await updateProfile({ full_name: fullName, email, phone })
      toast.success('Profile change request submitted successfully')
      await refreshUser()
    } catch (err: any) {
      toast.error(err.response?.data?.detail || '✕ Could not save changes')
    } finally {
      setSaving(false)
    }
  }

  const changePwd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (newP !== confirm) { toast.error('Passwords do not match'); return }
    if (newP.length < 4) { toast.error('New password must be at least 4 characters'); return }
    setPwdSaving(true)
    try {
      await changePassword(oldP, newP)
      toast.success('✓ Password changed successfully')
      setOldP(''); setNewP(''); setConfirm('')
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed')
    } finally {
      setPwdSaving(false)
    }
  }

  return (
    <TeacherLayout>
      <PageHeader title="Profile" subtitle="Your account information" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 rounded-2xl bg-primary-500 text-white flex items-center justify-center text-2xl font-bold">{fullName?.charAt(0) || 'T'}</div>
            <div>
              <h3 className="text-lg font-semibold">{fullName || 'Teacher'}</h3>
              <p className="text-sm text-gray-400">{user?.teacher_id}</p>
            </div>
          </div>
          <form onSubmit={submitProfile} className="space-y-4">
            <div>
              <label className="label">Full Name</label>
              <input className="input" value={fullName} onChange={e => setFullName(e.target.value)} required />
            </div>
            <div>
              <label className="label">Email</label>
              <input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
            </div>
            <div>
              <label className="label">Phone Number</label>
              <input className="input" value={phone} onChange={e => setPhone(e.target.value)} />
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={saving || loading} className="btn-primary flex items-center gap-2">
                {saving ? <Loader size={16} className="animate-spin" /> : <Save size={16} />}
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
              <button type="button" onClick={() => { setFullName(user?.full_name || ''); setEmail(user?.email || ''); setPhone(user?.phone || '') }} className="btn-secondary">
                Reset
              </button>
            </div>
            <p className="text-xs text-gray-400 flex items-center gap-2"><Building2 size={14} /> Role: Teacher (cannot be changed)</p>
          </form>
        </Card>
        <Card>
          <h3 className="font-semibold mb-4 flex items-center gap-2"><Lock size={18} className="text-red-500" /> Change Password</h3>
          <form onSubmit={changePwd} className="space-y-4">
            <div><label className="label">Current Password</label><input type="password" className="input" value={oldP} onChange={e => setOldP(e.target.value)} required /></div>
            <div><label className="label">New Password</label><input type="password" className="input" value={newP} onChange={e => setNewP(e.target.value)} required /></div>
            <div><label className="label">Confirm New Password</label><input type="password" className="input" value={confirm} onChange={e => setConfirm(e.target.value)} required /></div>
            <button type="submit" disabled={pwdSaving} className="btn-primary w-full flex items-center justify-center gap-2">
              {pwdSaving ? <Loader size={16} className="animate-spin" /> : <Lock size={16} />}
              {pwdSaving ? 'Updating...' : 'Update Password'}
            </button>
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
