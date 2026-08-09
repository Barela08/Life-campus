import React, { useState } from 'react'
import AdminLayout from '../../components/AdminLayout'
import { PageHeader, Card } from '../../components/ui'
import { useAuth } from '../../store/auth'
import { useTheme } from '../../store/theme'
import toast from 'react-hot-toast'
import { ShieldCheck, Sun, Moon, Database, Mail, Lock } from 'lucide-react'

export default function Settings() {
  const { user, changePassword } = useAuth()
  const { dark, toggle } = useTheme()
  const [oldP, setOldP] = useState('')
  const [newP, setNewP] = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving] = useState(false)

  const submitPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (newP !== confirm) { toast.error('Passwords do not match'); return }
    setSaving(true)
    try { await changePassword(oldP, newP); toast.success('Password updated'); setOldP(''); setNewP(''); setConfirm('') }
    catch (err: any) { toast.error(err.response?.data?.detail || 'Failed') } finally { setSaving(false) }
  }

  return (
    <AdminLayout>
      <PageHeader title="Settings" subtitle="System configuration and preferences" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          <Card>
            <h3 className="font-semibold mb-4 flex items-center gap-2"><ShieldCheck size={18} className="text-primary-500" /> Security Settings</h3>
            <form onSubmit={submitPassword} className="space-y-4">
              <div><label className="label">Current Password</label><input type="password" className="input" value={oldP} onChange={e => setOldP(e.target.value)} required /></div>
              <div><label className="label">New Password</label><input type="password" className="input" value={newP} onChange={e => setNewP(e.target.value)} required /></div>
              <div><label className="label">Confirm New Password</label><input type="password" className="input" value={confirm} onChange={e => setConfirm(e.target.value)} required /></div>
              <button className="btn-primary flex items-center gap-2" disabled={saving}><Lock size={16} /> {saving ? 'Saving...' : 'Update Password'}</button>
            </form>
          </Card>
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
              <div className="flex justify-between"><span className="text-gray-400">Database</span><span className="font-medium">SQLite (Dev) / PostgreSQL (Prod)</span></div>
            </div>
          </Card>
          <Card>
            <h3 className="font-semibold mb-4 flex items-center gap-2"><Mail size={18} className="text-blue-500" /> Email Notifications</h3>
            <p className="text-sm text-gray-500 mb-3">Configure Gmail SMTP in the backend environment variables to enable automatic email notifications for:</p>
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
