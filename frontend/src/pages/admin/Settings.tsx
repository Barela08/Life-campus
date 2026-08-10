import React, { useEffect, useState } from 'react'
import AdminLayout from '../../components/AdminLayout'
import { PageHeader, Card } from '../../components/ui'
import { useAuth } from '../../store/auth'
import { useTheme } from '../../store/theme'
import api from '../../lib/api'
import toast from 'react-hot-toast'
import { ShieldCheck, Sun, Moon, Database, Mail, Lock, User, Save, Loader } from 'lucide-react'

export default function Settings() {
  const { user, changePassword, updateProfile, refreshUser } = useAuth()
  const { dark, toggle } = useTheme()

  // Profile form
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [loadingProfile, setLoadingProfile] = useState(false)
  const [savingProfile, setSavingProfile] = useState(false)

  // Password form
  const [oldP, setOldP] = useState('')
  const [newP, setNewP] = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving] = useState(false)

  // Load current profile on mount
  useEffect(() => {
    setFullName(user?.full_name || '')
    setEmail(user?.email || '')
    setLoadingProfile(true)
    api.get('/auth/me')
      .then(res => {
        setFullName(res.data.full_name || '')
        setEmail(res.data.email || '')
        setPhone(res.data.phone || '')
      })
      .catch(() => {})
      .finally(() => setLoadingProfile(false))
  }, [user?.id])

  const submitProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setSavingProfile(true)
    try {
      await updateProfile({ full_name: fullName, email, phone })
      toast.success('✓ Profile updated successfully')
      await refreshUser()
    } catch (err: any) {
      toast.error(err.response?.data?.detail || '✕ Could not save changes')
    } finally {
      setSavingProfile(false)
    }
  }

  const submitPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (newP !== confirm) { toast.error('Passwords do not match'); return }
    if (newP.length < 4) { toast.error('New password must be at least 4 characters'); return }
    setSaving(true)
    try {
      await changePassword(oldP, newP)
      toast.success('✓ Password changed successfully')
      setOldP(''); setNewP(''); setConfirm('')
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <AdminLayout>
      <PageHeader title="Settings" subtitle="Profile, security and preferences" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          {/* Profile */}
          <Card>
            <h3 className="font-semibold mb-4 flex items-center gap-2"><User size={18} className="text-primary-500" /> Admin Profile</h3>
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
                <button type="submit" disabled={savingProfile || loadingProfile} className="btn-primary flex items-center gap-2">
                  {savingProfile ? <Loader size={16} className="animate-spin" /> : <Save size={16} />}
                  {savingProfile ? 'Saving...' : 'Save Changes'}
                </button>
                <button type="button" onClick={() => { setFullName(user?.full_name || ''); setEmail(user?.email || ''); setPhone('') }} className="btn-secondary">
                  Reset
                </button>
              </div>
              <p className="text-xs text-gray-400">Username: {user?.username} • Role: {user?.role}</p>
            </form>
          </Card>

          {/* Password */}
          <Card>
            <h3 className="font-semibold mb-4 flex items-center gap-2"><Lock size={18} className="text-red-500" /> Change Password</h3>
            <form onSubmit={submitPassword} className="space-y-4">
              <div><label className="label">Current Password</label><input type="password" className="input" value={oldP} onChange={e => setOldP(e.target.value)} required /></div>
              <div><label className="label">New Password</label><input type="password" className="input" value={newP} onChange={e => setNewP(e.target.value)} required /></div>
              <div><label className="label">Confirm New Password</label><input type="password" className="input" value={confirm} onChange={e => setConfirm(e.target.value)} required /></div>
              <button type="submit" disabled={saving} className="btn-primary flex items-center gap-2">
                {saving ? <Loader size={16} className="animate-spin" /> : <Lock size={16} />}
                {saving ? 'Saving...' : 'Change Password'}
              </button>
            </form>
          </Card>

          {/* Appearance */}
          <Card>
            <h3 className="font-semibold mb-4 flex items-center gap-2"><Sun size={18} className="text-amber-500" /> Appearance</h3>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">Theme</p>
                <p className="text-xs text-gray-400">{dark ? 'Dark mode active' : 'Light mode active'}</p>
              </div>
              <button onClick={toggle} className="btn-secondary flex items-center gap-2">{dark ? <Sun size={16} /> : <Moon size={16} />} Toggle</button>
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <h3 className="font-semibold mb-4 flex items-center gap-2"><Database size={18} className="text-emerald-500" /> System Information</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-gray-400">Application</span><span className="font-medium">LifeOS Smart Campus</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Version</span><span className="font-medium">v1.0</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Admin User</span><span className="font-medium">{user?.username}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Role</span><span className="font-medium capitalize">{user?.role}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Face Engine</span><span className="font-medium">InsightFace / dlib</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Database</span><span className="font-medium">PostgreSQL (Supabase)</span></div>
            </div>
          </Card>
          <Card>
            <h3 className="font-semibold mb-4 flex items-center gap-2"><Mail size={18} className="text-blue-500" /> Email Notifications</h3>
            <p className="text-sm text-gray-500 mb-3">SMTP is configured via backend environment variables. Automatic emails are sent for:</p>
            <ul className="text-sm text-gray-500 space-y-2">
              <li>• Attendance Marked</li>
              <li>• Attendance Missed</li>
              <li>• Low Attendance</li>
              <li>• Monthly Report</li>
              <li>• Password Changed</li>
            </ul>
          </Card>
        </div>
      </div>
    </AdminLayout>
  )
}