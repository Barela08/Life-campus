import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('lifeos_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('lifeos_token')
      localStorage.removeItem('lifeos_user')
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
