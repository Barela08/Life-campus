import React, { createContext, useContext, useState } from 'react'
import api from '../lib/api'

interface User {
  id: number
  username: string
  email: string
  full_name: string
  role: string
  must_change_password?: boolean
}

interface AuthCtx {
  user: User | null
  token: string | null
  login: (username: string, password: string) => Promise<User>
  logout: () => void
  changePassword: (oldP: string, newP: string) => Promise<void>
}

const Ctx = createContext<AuthCtx>({
  user: null,
  token: null,
  login: async () => ({ id: 0, username: '', email: '', full_name: '', role: '' }),
  logout: () => {},
  changePassword: async () => {},
})

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    try {
      return JSON.parse(localStorage.getItem('lifeos_user') || 'null')
    } catch {
      return null
    }
  })
  const [token] = useState<string | null>(() => localStorage.getItem('lifeos_token'))

  const login = async (username: string, password: string) => {
    const res = await api.post('/auth/login', { username, password })
    const data = res.data
    localStorage.setItem('lifeos_token', data.access_token)
    localStorage.setItem('lifeos_refresh', data.refresh_token)
    const u: User = {
      id: data.user_id,
      username,
      email: '',
      full_name: data.full_name,
      role: data.role,
      must_change_password: data.must_change_password,
    }
    localStorage.setItem('lifeos_user', JSON.stringify(u))
    setUser(u)
    return u
  }

  const logout = () => {
    localStorage.removeItem('lifeos_token')
    localStorage.removeItem('lifeos_refresh')
    localStorage.removeItem('lifeos_user')
    setUser(null)
  }

  const changePassword = async (oldP: string, newP: string) => {
    await api.post('/auth/change-password', { old_password: oldP, new_password: newP })
    if (user) {
      const updated = { ...user, must_change_password: false }
      localStorage.setItem('lifeos_user', JSON.stringify(updated))
      setUser(updated)
    }
  }

  return (
    <Ctx.Provider value={{ user, token, login, logout, changePassword }}>
      {children}
    </Ctx.Provider>
  )
}

export const useAuth = () => useContext(Ctx)
