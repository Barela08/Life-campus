import React, { useState } from 'react'
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../store/auth'
import { useTheme } from '../store/theme'
import { cn } from '../lib/utils'
import {
  LayoutDashboard, CalendarCheck, FileText, Bell, UserCircle, Settings,
  LogOut, Moon, Sun, Menu, X, ShieldCheck, Camera, History, ClipboardCheck, CalendarClock,
} from 'lucide-react'

interface NavItem { to: string; label: string; icon: React.ReactNode }

export default function TeacherLayout({ children }: { children: React.ReactNode }) {
  const { logout, user } = useAuth()
  const { dark, toggle } = useTheme()
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const [notifOpen, setNotifOpen] = useState(false)

  const navItems: NavItem[] = [
    { to: '/teacher', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
    { to: '/attendance', label: 'Start Attendance', icon: <Camera size={18} /> },
    { to: '/teacher/classes', label: "Today's Classes", icon: <CalendarClock size={18} /> },
    { to: '/teacher/history', label: 'Attendance History', icon: <History size={18} /> },
    { to: '/teacher/corrections', label: 'Correct Attendance', icon: <ClipboardCheck size={18} /> },
    { to: '/teacher/leave', label: 'Approve Leave', icon: <CalendarCheck size={18} /> },
    { to: '/teacher/reports', label: 'Reports', icon: <FileText size={18} /> },
    { to: '/teacher/notifications', label: 'Notifications', icon: <Bell size={18} /> },
    { to: '/teacher/profile', label: 'Profile', icon: <UserCircle size={18} /> },
  ]

  return (
    <div className="min-h-screen flex">
      <aside className={cn(
        'w-64 glass border-r border-gray-100 dark:border-gray-800 flex flex-col shrink-0 transition-all',
        'fixed lg:static inset-y-0 left-0 z-40 lg:z-auto',
        open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      )}>
        <div className="flex items-center gap-2 px-6 h-16 border-b border-gray-100 dark:border-gray-800">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center text-white font-bold">T</div>
          <div>
            <p className="font-bold leading-tight">LifeOS</p>
            <p className="text-[10px] text-gray-400 uppercase tracking-widest">Teacher Portal</p>
          </div>
        </div>
        <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/teacher'}
              onClick={() => setOpen(false)}
              className={({ isActive }) => cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all',
                isActive || location.pathname === item.to
                  ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800',
              )}
            >
              {item.icon}
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-4 border-t border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <ShieldCheck size={14} className="text-emerald-500" />
            <span>JWT Secured</span>
          </div>
        </div>
      </aside>

      {open && <div className="fixed inset-0 bg-black/40 z-30 lg:hidden" onClick={() => setOpen(false)} />}

      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex items-center justify-between px-4 h-16 glass border-b border-gray-100 dark:border-gray-800 sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <button onClick={() => setOpen(!open)} className="lg:hidden p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
              {open ? <X size={20} /> : <Menu size={20} />}
            </button>
            <div className="lg:hidden font-bold"><span className="text-indigo-600">LifeOS</span> Teacher</div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={toggle} className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition">
              {dark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <div className="relative">
              <button onClick={() => setNotifOpen(!notifOpen)} className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition relative">
                <Bell size={18} />
              </button>
              {notifOpen && (
                <div className="absolute right-0 mt-2 w-72 card p-3 text-sm animate-slide-up">
                  <p className="font-semibold mb-2">Notifications</p>
                  <p className="text-gray-400 text-xs">No notifications yet</p>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 pl-2 border-l border-gray-200 dark:border-gray-700">
              <div className="w-8 h-8 rounded-full bg-indigo-500 text-white flex items-center justify-center text-sm font-semibold">
                {(user?.full_name || 'T').charAt(0)}
              </div>
              <span className="hidden sm:block text-sm font-medium">{user?.full_name || 'Teacher'}</span>
            </div>
            <button onClick={() => { logout(); navigate('/login') }} className="p-2 rounded-xl hover:bg-red-50 dark:hover:bg-red-500/10 text-red-500 transition">
              <LogOut size={18} />
            </button>
          </div>
        </div>

        <main className="flex-1 p-4 lg:p-6 max-w-[1400px] w-full mx-auto">{children}</main>
      </div>
    </div>
  )
}
