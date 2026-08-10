import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../store/auth'
import { useBranding } from '../store/branding'
import toast from 'react-hot-toast'
import { ShieldCheck, Eye, EyeOff, Loader2 } from 'lucide-react'
import { useTheme } from '../store/theme'
import { Moon, Sun } from 'lucide-react'

export default function Login() {
  const { login } = useAuth()
  const { dark, toggle } = useTheme()
  const { systemName, systemLogo } = useBranding()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!username || !password) {
      toast.error('Please enter username and password')
      return
    }
    setLoading(true)
    try {
      const u = await login(username, password)
      toast.success(`Welcome, ${u.full_name}!`)
      if (u.must_change_password) {
        navigate('/change-password')
      } else if (u.role === 'admin') {
        navigate('/admin')
      } else if (u.role === 'teacher') {
        navigate('/teacher')
      } else {
        navigate('/student')
      }
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-primary-50 via-white to-indigo-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
      <button onClick={toggle} className="absolute top-4 right-4 p-2 rounded-xl bg-white/60 dark:bg-gray-800 shadow-card hover:scale-105 transition">
        {dark ? <Sun size={18} /> : <Moon size={18} />}
      </button>
      <div className="w-full max-w-md animate-slide-up">
        <div className="card p-8">
          <div className="flex flex-col items-center mb-8">
            {systemLogo ? (
              <img src={systemLogo} alt="System Logo" className="w-16 h-16 object-contain rounded-2xl mb-4 shadow-md" />
            ) : (
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-white text-2xl font-bold shadow-lg mb-4">
                {systemName.charAt(0)}
              </div>
            )}
            <h1 className="text-2xl font-bold tracking-tight text-center">{systemName}</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 text-center">AI Face Recognition Attendance System</p>
          </div>


          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Username</label>
              <input
                className="input"
                placeholder="Enter username (e.g. admin)"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoFocus
              />
            </div>
            <div>
              <label className="label">Password</label>
              <div className="relative">
                <input
                  className="input pr-10"
                  type={show ? 'text' : 'password'}
                  placeholder="Enter password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button type="button" onClick={() => setShow(!show)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                  {show ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2">
              {loading && <Loader2 size={16} className="animate-spin" />}
              Sign In
            </button>
          </form>

          <div className="mt-6 flex items-center justify-between text-sm">
            <a href="/forgot-password" className="text-primary-600 hover:underline">Forgot password?</a>
            <span className="text-gray-400 text-xs flex items-center gap-1"><ShieldCheck size={12} /> JWT Secured</span>
          </div>
        </div>
        <p className="text-center text-xs text-gray-400 mt-6">LifeOS Smart Campus v1.0</p>
      </div>
    </div>
  )
}
