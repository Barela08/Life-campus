import React, { useState } from 'react'
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../store/auth'
import { useTheme } from '../store/theme'
import { cn } from '../lib/utils'
import {
  LayoutDashboard, Users, GraduationCap, Building2, BookOpen, Layers,
  CalendarCheck, FileText, Bell, UserCircle, Settings,
  LogOut, Moon, Sun, Menu, X, ShieldCheck, AlertTriangle, Camera, BarChart3,
} from 'lucide-react'

interface NavItem { to: string; label: string; icon: React.ReactNode }

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { logout, user } = useAuth()
  const { dark, toggle } = useTheme()
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const [notifOpen, setNotifOpen] = useState(false)

  const navItems: NavItem[] = [
    { to: '/admin', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
    { to: '/admin/attendance', label: 'Attendance Monitor', icon: <CalendarCheck size={18} /> },
    { to: '/admin/students', label: 'Students', icon: <Users size={18} /> },
    { to: '/admin/teachers', label: 'Teachers', icon: <GraduationCap size={18} /> },
    { to: '/admin/departments', label: 'Departments', icon: <Building2 size={18} /> },
    { to: '/admin/courses', label: 'Courses & Subjects', icon: <BookOpen size={18} /> },
    { to: '/admin/classes', label: 'Classes, Semesters', icon: <Layers size={18} /> },
    { to: '/admin/face', label: 'Face Registration', icon: <Camera size={18} /> },
    { to: '/admin/unknowns', label: 'Unknown Alerts', icon: <AlertTriangle size={18} /> },
    { to: '/admin/reports', label: 'Reports', icon: <FileText size={18} /> },
    { to: '/admin/analytics', label: 'Analytics', icon: <BarChart3 size={18} /> },
    { to: '/admin/notifications', label: 'Notifications', icon: <Bell size={18} /> },
    { to: '/admin/settings', label: 'Settings', icon: <Settings size={18} /> },
  ]

  return (
    <div className="min-h-screen flex">
      <aside className={cn(
        'w-64 glass border-r border-gray-100 dark:border-gray-800 flex flex-col shrink-0 transition-all',
        'fixed lg:static inset-y-0 left-0 z-40 lg:z-auto',
        open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      )}>
        <div className="flex items-center gap-2 px-6 h-16 border-b border-gray-100 dark:border-gray-800">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-white font-bold">L</div>
          <div>
            <p className="font-bold leading-tight">LifeOS</p>
            <p className="text-[10px] text-gray-400 uppercase tracking-widest">Admin Panel</p>
          </div>
        </div>
        <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/admin'}
              onClick={() => setOpen(false)}
              className={({ isActive }) => cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all',
                isActive || location.pathname === item.to
                  ? 'bg-primary-50 dark:bg-primary-500/10 text-primary-700 dark:text-primary-400'
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
            <div className="lg:hidden font-bold"><span className="text-primary-600">LifeOS</span> Admin</div>
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
              <div className="w-8 h-8 rounded-full bg-primary-500 text-white flex items-center justify-center text-sm font-semibold">
                {(user?.full_name || 'A').charAt(0)}
              </div>
              <span className="hidden sm:block text-sm font-medium">{user?.full_name || 'Admin'}</span>
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
