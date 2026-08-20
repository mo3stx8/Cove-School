import { lazy, Suspense, type ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, roleOf, useAuth } from './context/AuthContext'
import { Spinner } from './components/ui'
import { ToastProvider } from './components/Toast'
import AppLayout from './components/layout/AppLayout'
import LoginPage from './pages/LoginPage'
import SetupWizard from './pages/SetupWizard'
import ActivatePage from './pages/ActivatePage'

const Dashboard = lazy(() => import('./pages/Dashboard'))
const StudentsPage = lazy(() => import('./pages/StudentsPage'))
const TeachersPage = lazy(() => import('./pages/TeachersPage'))
const ClassesPage = lazy(() => import('./pages/ClassesPage'))
const AcademicPage = lazy(() => import('./pages/AcademicPage'))
const AttendancePage = lazy(() => import('./pages/AttendancePage'))
const ExamsPage = lazy(() => import('./pages/ExamsPage'))
const AssignmentsPage = lazy(() => import('./pages/AssignmentsPage'))
const FeesPage = lazy(() => import('./pages/FeesPage'))
const AnnouncementsPage = lazy(() => import('./pages/AnnouncementsPage'))
const ReportsPage = lazy(() => import('./pages/ReportsPage'))
const NotificationsPage = lazy(() => import('./pages/NotificationsPage'))
const PortalPage = lazy(() => import('./pages/PortalPage'))
const UsersPage = lazy(() => import('./pages/UsersPage'))
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'))

function Protected({ roles, children }: { roles?: string[]; children: ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) {
    return <Spinner />
  }
  if (!user) {
    return <Navigate to="/login" replace />
  }
  const role = roleOf(user)
  if (roles && !roles.includes('*') && !roles.includes(role)) {
    return <Navigate to="/dashboard" replace />
  }
  return <>{children}</>
}

function RootRedirect() {
  const { user, loading } = useAuth()
  if (loading) {
    return <Spinner />
  }
  if (!user) {
    return <Navigate to="/login" replace />
  }
  return <Navigate to="/dashboard" replace />
}

function AppRoutes() {
  return (
    <Suspense fallback={<Spinner />}>
      <Routes>
        <Route path="/" element={<RootRedirect />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/setup" element={<SetupWizard />} />
        <Route path="/activate" element={<ActivatePage />} />
        <Route
          element={
            <Protected>
              <AppLayout />
            </Protected>
          }
        >
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/portal" element={<PortalPage />} />
          <Route path="/users" element={<UsersPage />} />
          <Route path="/students" element={<StudentsPage />} />
          <Route path="/teachers" element={<TeachersPage />} />
          <Route path="/classes" element={<ClassesPage />} />
          <Route path="/academic" element={<AcademicPage />} />
          <Route path="/attendance" element={<AttendancePage />} />
          <Route path="/exams" element={<ExamsPage />} />
          <Route path="/assignments" element={<AssignmentsPage />} />
          <Route path="/fees" element={<FeesPage />} />
          <Route path="/announcements" element={<AnnouncementsPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </Suspense>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <AppRoutes />
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
