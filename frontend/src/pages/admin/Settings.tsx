import React, { useEffect, useState } from 'react'
import AdminLayout from '../../components/AdminLayout'
import { PageHeader, Card } from '../../components/ui'
import { useAuth } from '../../store/auth'
import { useTheme } from '../../store/theme'
import { useBranding } from '../../store/branding'
import api from '../../lib/api'
import toast from 'react-hot-toast'
import { ShieldCheck, Sun, Moon, Database, Mail, Lock, User, Save, Loader, Building2, ShieldAlert, Upload } from 'lucide-react'

export default function Settings() {
  const { user, changePassword, updateProfile, refreshUser } = useAuth()
  const { dark, toggle } = useTheme()
  const { systemName, systemLogo, maintenanceMode, refreshBranding } = useBranding()

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

  // Branding & System Config form
  const [systemNameInput, setSystemNameInput] = useState('')
  const [logoPreview, setLogoPreview] = useState('')
  const [maintMode, setMaintMode] = useState(false)
  const [thresholdInput, setThresholdInput] = useState('0.6')
  const [savingBranding, setSavingBranding] = useState(false)
  const [smtp, setSmtp] = useState({ smtp_host: '', smtp_port: 587, smtp_username: '', smtp_password: '', smtp_from_email: '', smtp_from_name: '', smtp_use_tls: true, email_enabled: true, smtp_password_configured: false })
  const [savingSmtp, setSavingSmtp] = useState(false)
  const [testEmail, setTestEmail] = useState('')

  // Load current profile & branding settings on mount
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

  function formatLogo(url: string) {
    if (!url) return ''
    if (url.startsWith('data:') || url.startsWith('http')) return url
    return `https://life-campus.onrender.com${url.startsWith('/') ? '' : '/'}${url}`
  }

    // Load admin settings
    api.get('/admin/settings')
      .then(res => {
        if (res.data.system_name) setSystemNameInput(res.data.system_name)
        if (res.data.system_logo) setLogoPreview(formatLogo(res.data.system_logo))
        if (res.data.maintenance_mode !== undefined) {
          setMaintMode(String(res.data.maintenance_mode).toLowerCase() === 'true' || String(res.data.maintenance_mode) === '1')
        }
        if (res.data.face_match_threshold) setThresholdInput(String(res.data.face_match_threshold))
      })
      .catch(() => {})
    api.get('/admin/settings/email').then(res => setSmtp(current => ({ ...current, ...res.data, smtp_password: '' }))).catch(() => {})
  }, [user?.id])

  const saveSmtp = async (event: React.FormEvent) => {
    event.preventDefault(); setSavingSmtp(true)
    try { await api.put('/admin/settings/email', smtp); setSmtp(current => ({ ...current, smtp_password: '', smtp_password_configured: Boolean(current.smtp_password) || current.smtp_password_configured })); toast.success('SMTP settings saved') }
    catch (err: any) { toast.error(err.response?.data?.detail || 'Could not save SMTP settings') }
    finally { setSavingSmtp(false) }
  }
  const sendTestEmail = async () => {
    if (!testEmail) { toast.error('Enter a test recipient email'); return }
    try { const res = await api.post('/admin/settings/email/test', { to_email: testEmail }); res.data.success ? toast.success(res.data.message) : toast.error(res.data.message) }
    catch (err: any) { toast.error(err.response?.data?.detail || 'Test email failed. Please verify SMTP settings.') }
  }

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const formData = new FormData()
    formData.append('file', file)
    try {
      const res = await api.post('/admin/settings/logo', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      setLogoPreview(formatLogo(res.data.logo_url))
      toast.success('✓ Logo uploaded successfully')
      await refreshBranding()
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Logo upload failed')
    }
  }

  const saveBrandingSettings = async (e: React.FormEvent) => {
    e.preventDefault()
    setSavingBranding(true)
    try {
      await api.post('/admin/settings', {
        system_name: systemNameInput,
        maintenance_mode: maintMode ? 'true' : 'false',
        face_match_threshold: thresholdInput,
      })
      toast.success('✓ Settings updated successfully')
      await refreshBranding()
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to update settings')
    } finally {
      setSavingBranding(false)
    }
  }


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
          {/* System Branding & Maintenance Mode Settings */}
          <Card>

            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Building2 size={18} className="text-purple-500" /> System Branding & Maintenance Mode
            </h3>
            <form onSubmit={saveBrandingSettings} className="space-y-4">
              <div>
                <label className="label">System Name</label>
                <input
                  className="input"
                  value={systemNameInput}
                  onChange={e => setSystemNameInput(e.target.value)}
                  placeholder="System Name (e.g. LifeOS Smart Campus)"
                  required
                />
              </div>

              <div>
                <label className="label">System Logo</label>
                <div className="flex items-center gap-4">
                  {logoPreview ? (
                    <img src={logoPreview} alt="Logo" className="w-12 h-12 object-contain rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 p-1" />
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-400 text-xs font-semibold">
                      No Logo
                    </div>
                  )}
                  <label className="btn-secondary text-xs cursor-pointer flex items-center gap-2">
                    <Upload size={14} /> Upload New Logo
                    <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                  </label>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200/50 dark:border-amber-500/20">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <p className="font-semibold text-sm flex items-center gap-1.5 text-amber-900 dark:text-amber-300">
                      <ShieldAlert size={16} /> Maintenance Mode
                    </p>
                    <p className="text-xs text-amber-700 dark:text-amber-400">
                      When enabled, non-admin users are blocked from accessing student/teacher portals.
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={maintMode}
                      onChange={e => setMaintMode(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600"></div>
                  </label>
                </div>
              </div>

              <div>
                <label className="label">Face Match Similarity Threshold (0.10 - 0.99)</label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="0.1"
                    max="0.95"
                    step="0.05"
                    value={thresholdInput}
                    onChange={e => setThresholdInput(e.target.value)}
                    className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                  />
                  <span className="font-mono text-sm font-semibold w-12 text-right">{thresholdInput}</span>
                </div>
              </div>

              <button type="submit" disabled={savingBranding} className="btn-primary w-full flex items-center justify-center gap-2">
                {savingBranding ? <Loader size={16} className="animate-spin" /> : <Save size={16} />}
                {savingBranding ? 'Saving Settings...' : 'Save Branding & System Settings'}
              </button>
            </form>
          </Card>

          <Card>
            <h3 className="font-semibold mb-4 flex items-center gap-2"><Database size={18} className="text-emerald-500" /> System Information</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-gray-400">Application</span><span className="font-medium">{systemNameInput || 'LifeOS Smart Campus'}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Version</span><span className="font-medium">v1.0</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Admin User</span><span className="font-medium">{user?.username}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Role</span><span className="font-medium capitalize">{user?.role}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Face Engine</span><span className="font-medium">InsightFace / dlib</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Database</span><span className="font-medium">PostgreSQL (Supabase)</span></div>
            </div>
          </Card>
          <Card>
            <h3 className="font-semibold mb-4 flex items-center gap-2"><Mail size={18} className="text-blue-500" /> Email / SMTP Settings</h3>
            <form className="space-y-3 mb-5" onSubmit={saveSmtp}>
              <div className="grid grid-cols-2 gap-3"><div><label className="label">SMTP Host</label><input className="input" value={smtp.smtp_host} onChange={e => setSmtp({ ...smtp, smtp_host: e.target.value })} /></div><div><label className="label">SMTP Port</label><input className="input" type="number" value={smtp.smtp_port} onChange={e => setSmtp({ ...smtp, smtp_port: Number(e.target.value) })} /></div></div>
              <div><label className="label">SMTP Username / Email</label><input className="input" value={smtp.smtp_username} onChange={e => setSmtp({ ...smtp, smtp_username: e.target.value })} /></div>
              <div><label className="label">SMTP Password / App Password {smtp.smtp_password_configured && <span className="text-xs text-emerald-600">(configured)</span>}</label><input className="input" type="password" autoComplete="new-password" placeholder="Leave blank to keep current password" value={smtp.smtp_password} onChange={e => setSmtp({ ...smtp, smtp_password: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3"><div><label className="label">From Email</label><input className="input" type="email" value={smtp.smtp_from_email} onChange={e => setSmtp({ ...smtp, smtp_from_email: e.target.value })} /></div><div><label className="label">From Name</label><input className="input" value={smtp.smtp_from_name} onChange={e => setSmtp({ ...smtp, smtp_from_name: e.target.value })} /></div></div>
              <div className="flex gap-5 text-sm"><label className="flex items-center gap-2"><input type="checkbox" checked={smtp.smtp_use_tls} onChange={e => setSmtp({ ...smtp, smtp_use_tls: e.target.checked })} /> TLS enabled</label><label className="flex items-center gap-2"><input type="checkbox" checked={smtp.email_enabled} onChange={e => setSmtp({ ...smtp, email_enabled: e.target.checked })} /> Email enabled</label></div>
              <div className="flex gap-2"><button className="btn-primary" disabled={savingSmtp}>{savingSmtp ? 'Saving…' : 'Save Settings'}</button><input className="input flex-1" type="email" placeholder="Test recipient email" value={testEmail} onChange={e => setTestEmail(e.target.value)} /><button type="button" className="btn-secondary" onClick={() => void sendTestEmail()}>Test Email</button></div>
            </form>
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
