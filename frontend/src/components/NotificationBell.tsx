import { Bell } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import api from '../lib/api'
import { useAuth } from '../store/auth'

export default function NotificationBell() {
  const { user } = useAuth()
  const [count, setCount] = useState(0)
  const [open, setOpen] = useState(false)
  useEffect(() => {
    let mounted = true
    const refresh = async () => { try { const response = await api.get('/notifications/unread-count'); if (mounted) setCount(response.data.count || 0) } catch { /* layout remains usable */ } }
    void refresh()
    const timer = window.setInterval(() => void refresh(), 5000)
    return () => { mounted = false; window.clearInterval(timer) }
  }, [])
  const href = user?.role === 'admin' ? '/admin/notifications' : user?.role === 'teacher' ? '/teacher/notifications' : '/student/notifications'
  return <div className="relative"><button onClick={() => setOpen(value => !value)} className="relative p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition" aria-label="Notifications"><Bell size={18} />{count > 0 && <span className="absolute -right-1 -top-1 min-w-4 rounded-full bg-red-500 px-1 text-[10px] font-bold leading-4 text-white">{count > 99 ? '99+' : count}</span>}</button>{open && <div className="absolute right-0 z-50 mt-2 w-64 card p-3 text-sm animate-slide-up"><p className="font-semibold">Notifications</p><p className="mt-1 text-xs text-gray-500">{count ? `${count} unread notification${count === 1 ? '' : 's'}` : 'You are all caught up.'}</p><Link to={href} onClick={() => setOpen(false)} className="mt-3 inline-block text-xs font-medium text-primary-600 hover:underline">View all notifications</Link></div>}</div>
}
