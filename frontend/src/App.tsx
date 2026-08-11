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
import LeaveManagement from './pages/admin/LeaveManagement'
import RolesPermissions from './pages/admin/RolesPermissions'
import StaffManagement from './pages/admin/StaffManagement'

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
import StudentLeaveRequests from './pages/teacher/StudentLeaveRequests'

// Student
import StudentDashboard from './pages/student/StudentDashboard'
import StudentAttendance from './pages/student/StudentAttendance'
import StudentReport from './pages/student/StudentReport'
import StudentDownload from './pages/student/StudentDownload'
import StudentNotifications from './pages/student/StudentNotifications'
import StudentProfile from './pages/student/StudentProfile'
import StudentLayout from './components/StudentLayout'
import TeacherLayout from './components/TeacherLayout'
import AdminLayout from './components/AdminLayout'
import ApprovalRequests from './pages/ApprovalRequests'
import LeavePage from './pages/LeavePage'

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
      <Route path="/admin" element={<Protected role="admin"><AdminDashboard /></Protected>} />
      <Route path="/admin/attendance" element={<Protected role="admin"><AdminAttendance /></Protected>} />
      <Route path="/admin/students" element={<Protected role="admin"><Students /></Protected>} />
      <Route path="/admin/teachers" element={<Protected role="admin"><Teachers /></Protected>} />
      <Route path="/admin/departments" element={<Protected role="admin"><Departments /></Protected>} />
      <Route path="/admin/courses" element={<Protected role="admin"><Courses /></Protected>} />
      <Route path="/admin/face" element={<Protected role="admin"><AdminFace /></Protected>} />
      <Route path="/admin/reports" element={<Protected role="admin"><Reports /></Protected>} />

      <Route path="/admin/unknowns" element={<Protected role="admin"><Unknowns /></Protected>} />
      <Route path="/admin/analytics" element={<Protected role="admin"><Analytics /></Protected>} />
      <Route path="/admin/notifications" element={<Protected role="admin"><AdminNotifications /></Protected>} />
      <Route path="/admin/settings" element={<Protected role="admin"><Settings /></Protected>} />
      <Route path="/admin/leave" element={<Protected role="admin"><LeaveManagement /></Protected>} />
      <Route path="/admin/roles" element={<Protected role="admin"><RolesPermissions /></Protected>} />
      <Route path="/admin/staff" element={<Protected role="admin"><StaffManagement /></Protected>} />
      <Route path="/admin/requests" element={<Protected role="admin"><AdminLayout><ApprovalRequests mode="admin" /></AdminLayout></Protected>} />

      {/* Attendance terminal — teacher only */}
      <Route path="/attendance" element={<Protected role="teacher"><Attendance /></Protected>} />

      {/* Teacher Portal */}
      <Route path="/teacher" element={<Protected role="teacher"><TeacherDashboard /></Protected>} />
      <Route path="/teacher/classes" element={<Protected role="teacher"><TeacherClasses /></Protected>} />
      <Route path="/teacher/history" element={<Protected role="teacher"><TeacherHistory /></Protected>} />
      <Route path="/teacher/corrections" element={<Protected role="teacher"><TeacherCorrections /></Protected>} />
      <Route path="/teacher/leave" element={<Protected role="teacher"><TeacherLeave /></Protected>} />
      <Route path="/teacher/reports" element={<Protected role="teacher"><TeacherReports /></Protected>} />
      <Route path="/teacher/notifications" element={<Protected role="teacher"><TeacherNotifications /></Protected>} />
      <Route path="/teacher/profile" element={<Protected role="teacher"><TeacherProfile /></Protected>} />
      <Route path="/teacher/requests" element={<Protected role="teacher"><StudentLeaveRequests /></Protected>} />

      {/* Student Portal */}
      <Route path="/student" element={<Protected role="student"><StudentLayout><StudentDashboard /></StudentLayout></Protected>} />
      <Route path="/student/attendance" element={<Protected role="student"><StudentLayout><StudentAttendance /></StudentLayout></Protected>} />
      <Route path="/student/report" element={<Protected role="student"><StudentLayout><StudentReport /></StudentLayout></Protected>} />
      <Route path="/student/download" element={<Protected role="student"><StudentLayout><StudentDownload /></StudentLayout></Protected>} />
      <Route path="/student/notifications" element={<Protected role="student"><StudentLayout><StudentNotifications /></StudentLayout></Protected>} />
      <Route path="/student/profile" element={<Protected role="student"><StudentLayout><StudentProfile /></StudentLayout></Protected>} />
      <Route path="/student/requests" element={<Protected role="student"><StudentLayout><ApprovalRequests mode="student" /></StudentLayout></Protected>} />
      <Route path="/student/leave" element={<Protected role="student"><StudentLayout><LeavePage role="student" /></StudentLayout></Protected>} />

{/* Default landing page = Attendance module */}
      <Route path="/" element={<RootLanding />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
