import React, { createContext, useContext, useState, useEffect } from 'react'
import api, { registerLogoutCallback } from '../lib/api'

interface User {
  id: number
  username: string
  email: string
  full_name: string
  role: string
  phone?: string
  teacher_id?: string
  student_id?: string
  department_id?: number
  must_change_password?: boolean
}

export interface ProfileChangeData {
  full_name?: string
  email?: string
  phone?: string
  roll_number?: string
  section?: string
  department_id?: number
  course_id?: number
  semester_id?: number
  class_id?: number
}

interface AuthCtx {
  user: User | null
  token: string | null
  login: (username: string, password: string) => Promise<User>
  logout: () => void
  changePassword: (oldP: string, newP: string) => Promise<void>
  updateProfile: (data: ProfileChangeData) => Promise<unknown>
  refreshUser: () => Promise<void>
}

const Ctx = createContext<AuthCtx>({
  user: null,
  token: null,
  login: async () => ({ id: 0, username: '', email: '', full_name: '', role: '' }),
  logout: () => {},
  changePassword: async () => {},
  updateProfile: async () => null,
  refreshUser: async () => {},
})

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    try {
      return JSON.parse(localStorage.getItem('lifeos_user') || 'null')
    } catch {
      return null
    }
  })
  const [token, setTokenState] = useState<string | null>(() => localStorage.getItem('lifeos_token'))

  useEffect(() => {
    registerLogoutCallback(() => {
      setUser(null)
      setTokenState(null)
    })
  }, [])

  const login = async (username: string, password: string) => {
    const res = await api.post('/auth/login', { username, password })
    const data = res.data
    localStorage.setItem('lifeos_token', data.access_token)
    localStorage.setItem('lifeos_refresh', data.refresh_token)
    const u: User = {
      id: data.user_id,
      username,
      email: data.email || '',
      full_name: data.full_name,
      role: data.role,
      must_change_password: data.must_change_password,
    }
    localStorage.setItem('lifeos_user', JSON.stringify(u))
    setUser(u)
    setTokenState(data.access_token)
    // Refresh to get role-specific data (student/teacher details)
    setTimeout(() => refreshUser(), 0)
    return u
  }

  const logout = () => {
    localStorage.removeItem('lifeos_token')
    localStorage.removeItem('lifeos_refresh')
    localStorage.removeItem('lifeos_user')
    setUser(null)
    setTokenState(null)
  }

  const changePassword = async (oldP: string, newP: string) => {
    await api.post('/auth/change-password', { old_password: oldP, new_password: newP })
    if (user) {
      const updated = { ...user, must_change_password: false }
      localStorage.setItem('lifeos_user', JSON.stringify(updated))
      setUser(updated)
    }
  }

  const updateProfile = async (data: ProfileChangeData) => {
    const res = await api.patch('/auth/me', data)
    // Student and teacher profile edits require admin approval.  Keep the
    // current local profile until that request has been approved.
    if (res.data?.request) return res.data
    const updated = { ...user!, ...data, ...res.data }
    localStorage.setItem('lifeos_user', JSON.stringify(updated))
    setUser(updated)
    return updated
  }

  const refreshUser = async () => {
    try {
      const res = await api.get('/auth/me')
      const current = user || { id: res.data.id, username: res.data.username, role: res.data.role }
      const updated = { ...current, ...res.data }
      localStorage.setItem('lifeos_user', JSON.stringify(updated))
      setUser(updated)
    } catch {
      // ignore
    }
  }

  return (
    <Ctx.Provider value={{ user, token, login, logout, changePassword, updateProfile, refreshUser }}>
      {children}
    </Ctx.Provider>
  )
}

export const useAuth = () => useContext(Ctx)
