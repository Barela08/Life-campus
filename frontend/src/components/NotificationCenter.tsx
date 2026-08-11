import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Bell, CheckCircle2, Mail, Send, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import api, { apiErrorMessage } from '../lib/api'
import { Badge, Empty, Loading, PageHeader } from './ui'

type Role = 'admin' | 'teacher' | 'student'
type Notification = { id: number; title: string; message: string; type: string; priority: string; sender_name: string; sender_role: string; is_read: boolean; created_at: string; email_status?: string }
type Recipient = { id: number; full_name: string; roll_number: string; student_id: string; section: string; recipient_role: string }

const types = ['general', 'attendance', 'announcement', 'assignment', 'exam', 'important', 'warning', 'system']

function badge(type: string): 'blue' | 'green' | 'yellow' | 'red' {
  if (type === 'warning' || type === 'important') return 'yellow'
  if (type === 'system') return 'red'
  if (type === 'attendance') return 'green'
  return 'blue'
}

export default function NotificationCenter({ role }: { role: Role }) {
  const [items, setItems] = useState<Notification[]>([])
  const [recipients, setRecipients] = useState<Recipient[]>([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<number[]>([])
  const [scope, setScope] = useState('selected')
  const [recipientKind, setRecipientKind] = useState('students')
  const [form, setForm] = useState({ title: '', message: '', type: 'announcement', priority: 'normal', send_email: false })
  const [filter, setFilter] = useState<'all' | 'unread'>('all')

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true)
    try { setItems((await api.get('/notifications', { params: { unread_only: filter === 'unread' } })).data) }
    catch (error) { if (!quiet) toast.error(apiErrorMessage(error, 'Failed to load notifications')) }
    finally { if (!quiet) setLoading(false) }
  }, [filter])

  const loadRecipients = useCallback(async () => {
    if (role === 'student') return
    try { setRecipients((await api.get('/notifications/recipients', { params: { recipient_kind: recipientKind, ...(search ? { query: search } : {}) } })).data) }
    catch (error) { toast.error(apiErrorMessage(error, 'Unable to load eligible recipients')) }
  }, [role, search, recipientKind])

  useEffect(() => { void load() }, [load])
  // The existing app uses FastAPI/SQLAlchemy rather than a browser Supabase client.
  // Polling the authenticated API keeps the inbox live without exposing database credentials.
  useEffect(() => { const timer = window.setInterval(() => void load(true), 5000); return () => window.clearInterval(timer) }, [load])
  useEffect(() => { const timer = window.setTimeout(() => void loadRecipients(), 250); return () => window.clearTimeout(timer) }, [loadRecipients])

  const visibleRecipients = useMemo(() => recipients, [recipients])
  const markRead = async (id: number) => {
    try { await api.patch(`/notifications/${id}/read`); setItems(current => current.map(n => n.id === id ? { ...n, is_read: true } : n)) }
    catch (error) { toast.error(apiErrorMessage(error, 'Could not mark notification as read')) }
  }
  const markAll = async () => {
    try { await api.post('/notifications/read-all'); setItems(current => current.map(n => ({ ...n, is_read: true }))); toast.success('All notifications marked as read') }
    catch (error) { toast.error(apiErrorMessage(error, 'Could not update notifications')) }
  }
  const remove = async (id: number) => {
    try { await api.delete(`/notifications/${id}`); setItems(current => current.filter(n => n.id !== id)) }
    catch (error) { toast.error(apiErrorMessage(error, 'Could not delete notification')) }
  }
  const toggleRecipient = (id: number) => setSelected(current => current.includes(id) ? current.filter(value => value !== id) : [...current, id])
  const selectVisible = () => setSelected(visibleRecipients.map(student => student.id))
  const send = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!form.title.trim() || !form.message.trim()) { toast.error('Title and message are required'); return }
    if (scope === 'selected' && selected.length === 0) { toast.error('Select at least one student'); return }
    setSending(true)
    try {
      const result = (await api.post('/notifications/send', { ...form, title: form.title.trim(), message: form.message.trim(), recipient_scope: scope, recipient_kind: recipientKind, recipient_ids: selected })).data
      toast.success(`Notification sent. In-app: ${result.notification_count}/${result.notification_count}${result.email_requested ? ` · Email: ${result.emails_sent}/${result.notification_count}` : ''}`)
      setForm({ title: '', message: '', type: 'announcement', priority: 'normal', send_email: false }); setSelected([])
    } catch (error) { toast.error(apiErrorMessage(error, 'Notification could not be sent')) }
    finally { setSending(false) }
  }

  return <div className="space-y-6">
    <PageHeader title="Notifications" subtitle={role === 'student' ? 'Your campus notifications update automatically.' : 'Send notifications and review your own inbox.'} actions={items.some(n => !n.is_read) ? <button className="btn-secondary" onClick={() => void markAll()}>Mark all as read</button> : undefined} />
    {role !== 'student' && <form className="card p-5 space-y-4" onSubmit={send}>
      <div className="flex items-center gap-2"><Send size={19} className="text-primary-600" /><h2 className="font-semibold text-lg">Send notification</h2></div>
      <div className="grid gap-4 md:grid-cols-2">
        <div><label className="label">Title</label><input className="input" maxLength={160} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required /></div>
        <div className="grid grid-cols-2 gap-3"><div><label className="label">Type</label><select className="input" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>{types.map(type => <option key={type}>{type}</option>)}</select></div><div><label className="label">Priority</label><select className="input" value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })}><option value="normal">Normal</option><option value="important">Important</option><option value="urgent">Urgent</option></select></div></div>
      </div>
      <div><label className="label">Message</label><textarea className="input min-h-28" maxLength={4000} value={form.message} onChange={e => setForm({ ...form, message: e.target.value })} required /></div>
      <div className="grid gap-3 md:grid-cols-[2fr_2fr_auto] items-end"><div>{role === 'admin' && <><label className="label">Recipient type</label><select className="input" value={recipientKind} onChange={e => { setRecipientKind(e.target.value); setSelected([]) }}><option value="students">Students</option><option value="teachers">Teachers</option><option value="students_teachers">Students + Teachers</option><option value="all_users">All users</option></select></>}</div><div><label className="label">Recipients</label><select className="input" value={scope} onChange={e => setScope(e.target.value)}><option value="selected">Selected {recipientKind.replace('_', ' + ')}</option><option value="all">All eligible {role === 'teacher' ? 'students in my department' : recipientKind.replace('_', ' + ')}</option></select></div><label className="flex items-center gap-2 pb-2 text-sm"><input type="checkbox" checked={form.send_email} onChange={e => setForm({ ...form, send_email: e.target.checked })} /><Mail size={16} /> Send email notification</label></div>
      {scope === 'selected' && <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-3"><div className="mb-3 flex flex-wrap items-center gap-2"><input className="input flex-1 min-w-48" value={search} placeholder="Search name, roll number, or campus ID" onChange={e => setSearch(e.target.value)} /><button type="button" className="btn-secondary" onClick={selectVisible}>Select all</button><button type="button" className="btn-secondary" onClick={() => setSelected([])}>Unselect all</button></div><p className="mb-2 text-sm text-gray-500">Selected: {selected.length} recipients</p><div className="max-h-52 space-y-1 overflow-y-auto">{visibleRecipients.map(person => <label key={`${person.recipient_role}-${person.id}`} className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 hover:bg-gray-50 dark:hover:bg-gray-800"><input type="checkbox" checked={selected.includes(person.id)} onChange={() => toggleRecipient(person.id)} /><span className="text-sm font-medium">{person.full_name}</span><span className="text-xs text-gray-500 capitalize">{person.recipient_role} · {person.roll_number || person.student_id}{person.section ? ` · ${person.section}` : ''}</span></label>)}{!visibleRecipients.length && <p className="py-3 text-sm text-gray-500">No eligible recipients found.</p>}</div></div>}
      <div className="flex justify-end"><button className="btn-primary" disabled={sending}>{sending ? 'Sending…' : 'Send notification'}</button></div>
    </form>}
    <section><div className="mb-3 flex items-center justify-between"><h2 className="font-semibold">Inbox</h2><div className="flex gap-2"><button className={filter === 'all' ? 'btn-primary' : 'btn-secondary'} onClick={() => setFilter('all')}>All</button><button className={filter === 'unread' ? 'btn-primary' : 'btn-secondary'} onClick={() => setFilter('unread')}>Unread</button></div></div>{loading ? <Loading /> : !items.length ? <Empty message="No notifications found." /> : <div className="space-y-3">{items.map(n => <article key={n.id} className={`card flex gap-3 p-4 ${n.is_read ? 'opacity-70' : 'border-l-4 border-l-primary-500'}`}><Bell className="mt-1 shrink-0 text-primary-600" size={19} /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">{n.title}</h3><Badge variant={badge(n.type)}>{n.type}</Badge>{n.priority !== 'normal' && <Badge variant={n.priority === 'urgent' ? 'red' : 'yellow'}>{n.priority}</Badge>}</div><p className="mt-1 whitespace-pre-wrap text-sm text-gray-600 dark:text-gray-300">{n.message}</p><p className="mt-2 text-xs text-gray-400">From: {n.sender_name || 'LifeOS Smart Campus'} · {new Date(n.created_at).toLocaleString()}</p></div><div className="flex shrink-0 gap-1">{!n.is_read && <button className="p-2 text-emerald-600" title="Mark as read" onClick={() => void markRead(n.id)}><CheckCircle2 size={18} /></button>}<button className="p-2 text-gray-400 hover:text-red-600" title="Delete notification" onClick={() => void remove(n.id)}><Trash2 size={17} /></button></div></article>)}</div>}</section>
  </div>
}
