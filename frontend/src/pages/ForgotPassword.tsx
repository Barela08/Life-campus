import React, { useState } from 'react'
import api from '../lib/api'
import toast from 'react-hot-toast'
import { Loader2, ArrowLeft } from 'lucide-react'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await api.post('/auth/forgot-password', { email })
      setSent(true)
      toast.success('Reset link sent')
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to send reset link')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-primary-50 via-white to-indigo-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
      <div className="w-full max-w-md card p-8 animate-slide-up">
        <a href="/login" className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 mb-4">
          <ArrowLeft size={14} /> Back to login
        </a>
        <h1 className="text-2xl font-bold mb-1">Forgot Password</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Enter your email and we'll send you a reset link.</p>
        {sent ? (
          <div className="text-center py-6">
            <p className="text-emerald-600 font-medium mb-2">Reset link sent!</p>
            <p className="text-sm text-gray-500">Check your email inbox for instructions.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Email</label>
              <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2">
              {loading && <Loader2 size={16} className="animate-spin" />} Send Reset Link
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
