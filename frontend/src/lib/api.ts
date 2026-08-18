import axios from 'axios'

const DEFAULT_LIVE_BACKEND = 'https://life-campus.onrender.com/api'
let envUrl = import.meta.env.VITE_API_BASE_URL
let rawBaseUrl = (envUrl && envUrl.trim() !== '' && envUrl !== '/api') 
  ? envUrl.trim() 
  : DEFAULT_LIVE_BACKEND

if (rawBaseUrl.startsWith('http') && !rawBaseUrl.endsWith('/api')) {
  rawBaseUrl = rawBaseUrl.replace(/\/+$/, '') + '/api'
}

const api = axios.create({
  baseURL: rawBaseUrl,
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('lifeos_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

let logoutCallback: (() => void) | null = null

export function registerLogoutCallback(cb: () => void) {
  logoutCallback = cb
}

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('lifeos_token')
      localStorage.removeItem('lifeos_user')
      if (logoutCallback) {
        try {
          logoutCallback()
        } catch (e) {
          console.error(e)
        }
      }
      // Don't redirect when on the attendance terminal — it has its own login popup
      const isAttendance = window.location.pathname === '/' || window.location.pathname === '/attendance'
      if (!window.location.pathname.includes('/login') && !isAttendance) {
        window.location.href = '/login'
      }
    }
    return Promise.reject(err)
  },
)

export default api

export function apiErrorMessage(err: any, fallback = 'Request failed') {
  const detail = err?.response?.data?.detail
  if (Array.isArray(detail)) {
    return detail.map((d: any) => d?.msg || JSON.stringify(d)).join(', ')
  }
  if (detail) return String(detail)
  return err?.response?.data?.message || err?.message || fallback
}
