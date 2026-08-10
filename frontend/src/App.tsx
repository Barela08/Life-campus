import React, { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './store/auth'

import Login from './pages/Login'
import ChangePassword from './pages/ChangePassword'
import ForgotPassword from './pages/ForgotPassword'

// Admin
import AdminDashboard from './pages/admin/AdminDashboard'
import AdminAttendance from './pages/admin/AdminAttendance'
import Students from './pages/admin/Students'
import Teachers from './pages/admin/Teachers'
import Departments from './pages/admin/Departments'
import Courses from './pages/admin/Courses'
import AdminFace from './pages/admin/AdminFace'
import Reports from './pages/admin/Reports'
import Unknowns from './pages/admin/Unknowns'
import Analytics from './pages/admin/Analytics'
import AdminNotifications from './pages/admin/Notifications'
import Settings from './pages/admin/Settings'
import AdminLayout from './components/AdminLayout'

// Attendance terminal (teacher only)
import Attendance from './pages/attendance/Attendance'

// Teacher
import TeacherDashboard from './pages/teacher/TeacherDashboard'
import TeacherClasses from './pages/teacher/TeacherClasses'
import TeacherHistory from './pages/teacher/TeacherHistory'
import TeacherCorrections from './pages/teacher/TeacherCorrections'
import TeacherLeave from './pages/teacher/TeacherLeave'
import TeacherReports from './pages/teacher/TeacherReports'
import TeacherNotifications from './pages/teacher/TeacherNotifications'
import TeacherProfile from './pages/teacher/TeacherProfile'
import TeacherLayout from './components/TeacherLayout'

// Student
import StudentDashboard from './pages/student/StudentDashboard'
import StudentAttendance from './pages/student/StudentAttendance'
import StudentReport from './pages/student/StudentReport'
import StudentDownload from './pages/student/StudentDownload'
import StudentNotifications from './pages/student/StudentNotifications'
import StudentProfile from './pages/student/StudentProfile'
import StudentLayout from './components/StudentLayout'

function Protected({ role, children }: { role: 'admin' | 'teacher' | 'student'; children: React.ReactNode }) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  if (user.role !== role) return user.role === 'admin' ? <Navigate to="/admin" replace /> : user.role === 'teacher' ? <Navigate to="/teacher" replace /> : <Navigate to="/student" replace />
  return <>{children}</>
}

// Root landing page: always the Attendance module (fullscreen). If a teacher
// isn't logged in, the Attendance screen shows a login gate when starting.
function RootLanding() {
  return <Attendance />
}

export default function App() {
  const { refreshUser, token } = useAuth()
  useEffect(() => {
    if (token) refreshUser()
  }, [token])

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/change-password" element={<ChangePassword />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />

      {/* Admin Panel */}
      <Route path="/admin" element={<Protected role="admin"><AdminLayout><AdminDashboard /></AdminLayout></Protected>} />
      <Route path="/admin/attendance" element={<Protected role="admin"><AdminLayout><AdminAttendance /></AdminLayout></Protected>} />
      <Route path="/admin/students" element={<Protected role="admin"><AdminLayout><Students /></AdminLayout></Protected>} />
      <Route path="/admin/teachers" element={<Protected role="admin"><AdminLayout><Teachers /></AdminLayout></Protected>} />
      <Route path="/admin/departments" element={<Protected role="admin"><AdminLayout><Departments /></AdminLayout></Protected>} />
      <Route path="/admin/courses" element={<Protected role="admin"><AdminLayout><Courses /></AdminLayout></Protected>} />
      <Route path="/admin/face" element={<Protected role="admin"><AdminLayout><AdminFace /></AdminLayout></Protected>} />
      <Route path="/admin/reports" element={<Protected role="admin"><AdminLayout><Reports /></AdminLayout></Protected>} />

      <Route path="/admin/unknowns" element={<Protected role="admin"><AdminLayout><Unknowns /></AdminLayout></Protected>} />
      <Route path="/admin/analytics" element={<Protected role="admin"><AdminLayout><Analytics /></AdminLayout></Protected>} />
      <Route path="/admin/notifications" element={<Protected role="admin"><AdminLayout><AdminNotifications /></AdminLayout></Protected>} />
      <Route path="/admin/settings" element={<Protected role="admin"><AdminLayout><Settings /></AdminLayout></Protected>} />

      {/* Attendance terminal — teacher only */}
      <Route path="/attendance" element={<Protected role="teacher"><Attendance /></Protected>} />

      {/* Teacher Portal */}
      <Route path="/teacher" element={<Protected role="teacher"><TeacherLayout><TeacherDashboard /></TeacherLayout></Protected>} />
      <Route path="/teacher/classes" element={<Protected role="teacher"><TeacherLayout><TeacherClasses /></TeacherLayout></Protected>} />
      <Route path="/teacher/history" element={<Protected role="teacher"><TeacherLayout><TeacherHistory /></TeacherLayout></Protected>} />
      <Route path="/teacher/corrections" element={<Protected role="teacher"><TeacherLayout><TeacherCorrections /></TeacherLayout></Protected>} />
      <Route path="/teacher/leave" element={<Protected role="teacher"><TeacherLayout><TeacherLeave /></TeacherLayout></Protected>} />
      <Route path="/teacher/reports" element={<Protected role="teacher"><TeacherLayout><TeacherReports /></TeacherLayout></Protected>} />
      <Route path="/teacher/notifications" element={<Protected role="teacher"><TeacherLayout><TeacherNotifications /></TeacherLayout></Protected>} />
      <Route path="/teacher/profile" element={<Protected role="teacher"><TeacherLayout><TeacherProfile /></TeacherLayout></Protected>} />

      {/* Student Portal */}
      <Route path="/student" element={<Protected role="student"><StudentLayout><StudentDashboard /></StudentLayout></Protected>} />
      <Route path="/student/attendance" element={<Protected role="student"><StudentLayout><StudentAttendance /></StudentLayout></Protected>} />
      <Route path="/student/report" element={<Protected role="student"><StudentLayout><StudentReport /></StudentLayout></Protected>} />
      <Route path="/student/download" element={<Protected role="student"><StudentLayout><StudentDownload /></StudentLayout></Protected>} />
      <Route path="/student/notifications" element={<Protected role="student"><StudentLayout><StudentNotifications /></StudentLayout></Protected>} />
      <Route path="/student/profile" element={<Protected role="student"><StudentLayout><StudentProfile /></StudentLayout></Protected>} />

{/* Default landing page = Attendance module */}
      <Route path="/" element={<RootLanding />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
