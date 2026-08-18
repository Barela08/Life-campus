import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../store/auth'
import { useTheme } from '../store/theme'
import { useBranding } from '../store/branding'
import { LogOut, Moon, Sun, Maximize2, Minimize2, Camera, Shield } from 'lucide-react'

export default function AttendanceLayout({ children }: { children: React.ReactNode }) {
  const { logout, user } = useAuth()
  const { dark, toggle } = useTheme()
  const { systemName, systemLogo } = useBranding()
  const navigate = useNavigate()
  const [fullscreen, setFullscreen] = useState(false)

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen()
      setFullscreen(true)
    } else {
      document.exitFullscreen()
      setFullscreen(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-white flex flex-col">
      {/* Minimal glass top bar */}
      <div className="flex items-center justify-between px-4 sm:px-6 h-14 bg-white/70 dark:bg-gray-900/70 border-b border-gray-200/60 dark:border-gray-800/60 sticky top-0 z-30 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          {systemLogo ? (
            <img src={systemLogo} alt={systemName} className="h-9 w-auto object-contain rounded-xl shadow-sm" />
          ) : (
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-500 via-violet-500 to-primary-600 flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-primary-500/20">
              <Camera size={18} />
            </div>
          )}
          <div>
            <p className="font-bold leading-tight text-sm tracking-tight truncate max-w-[200px] sm:max-w-xs">
              {systemName} <span className="text-primary-500 dark:text-primary-400 font-mono text-xs">| Attendance</span>
            </p>
            <p className="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-widest font-medium">
              Classroom Terminal
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2">
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-gray-100/80 dark:bg-gray-800/80 text-xs text-gray-600 dark:text-gray-300 border border-gray-200/50 dark:border-gray-700/50">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            System Online
          </div>
          <button
            onClick={toggle}
            className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            title={dark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {dark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            title="Toggle Fullscreen"
          >
            {fullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
          </button>
          <button
            onClick={() => { localStorage.clear(); window.location.href = '/login' }}
            className="px-2.5 py-1 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 text-xs font-semibold transition"
            title="Reset Local Cache & Session"
          >
            Reset Session
          </button>
          {user && (
            <div className="flex items-center gap-2 pl-2 border-l border-gray-200 dark:border-gray-700 ml-1">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-500 to-violet-500 flex items-center justify-center text-xs font-semibold text-white shadow-md shadow-primary-500/20">
                {(user?.full_name || 'T').charAt(0)}
              </div>
              <span className="hidden sm:block text-sm font-medium text-gray-700 dark:text-gray-200">
                {user?.full_name}
              </span>
            </div>
          )}
          {user && (
            <button
              onClick={() => { logout(); navigate('/login') }}
              className="p-2 rounded-xl hover:bg-red-500/10 text-red-500 transition-colors"
              title="Logout"
            >
              <LogOut size={18} />
            </button>
          )}
        </div>
      </div>

      <main className="flex-1">{children}</main>

      {/* Footer */}
      <div className="px-6 py-3 border-t border-gray-200/50 dark:border-gray-800/50 flex items-center justify-center gap-2 text-xs text-gray-400 dark:text-gray-500">
        <Shield size={12} />
        <span>Protected by AI Face Recognition & Liveness Detection</span>
      </div>
    </div>
  )
}