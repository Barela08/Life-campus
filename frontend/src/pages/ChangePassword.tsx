import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../store/auth'
import toast from 'react-hot-toast'
import { Loader2 } from 'lucide-react'

export default function ChangePassword() {
  const { changePassword, login, user } = useAuth()
  const navigate = useNavigate()
  const [oldP, setOldP] = useState('')
  const [newP, setNewP] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (newP !== confirm) {
      toast.error('Passwords do not match')
      return
    }
    if (newP.length < 4) {
      toast.error('Password must be at least 4 characters')
      return
    }
    setLoading(true)
    try {
      await changePassword(oldP, newP)
      toast.success('Password changed successfully')
      if (user?.role === 'admin') navigate('/admin')
      else if (user?.role === 'teacher') navigate('/teacher')
      else navigate('/student')
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to change password')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-primary-50 via-white to-indigo-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
      <div className="w-full max-w-md card p-8 animate-slide-up">
        <h1 className="text-2xl font-bold mb-1">Change Password</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">You must change your temporary password before continuing.</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Current Password</label>
            <input className="input" type="password" value={oldP} onChange={(e) => setOldP(e.target.value)} required />
          </div>
          <div>
            <label className="label">New Password</label>
            <input className="input" type="password" value={newP} onChange={(e) => setNewP(e.target.value)} required />
          </div>
          <div>
            <label className="label">Confirm New Password</label>
            <input className="input" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
          </div>
          <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2">
            {loading && <Loader2 size={16} className="animate-spin" />} Update Password
          </button>
        </form>
      </div>
    </div>
  )
}
