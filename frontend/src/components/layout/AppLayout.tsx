import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth, roleOf } from '../../context/AuthContext'
import { setLanguage } from '../../i18n'
import { api } from '../../lib/api'
import { cn } from '../../lib/cn'

interface NavItem {
  to: string
  key: string
  roles: string[]
  icon: string
}

const navItems: NavItem[] = [
  { to: '/dashboard', key: 'nav.dashboard', roles: ['*'], icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
  { to: '/portal', key: 'nav.portal', roles: ['student', 'parent'], icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' },
  { to: '/students', key: 'nav.students', roles: ['admin', 'accountant'], icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z' },
  { to: '/teachers', key: 'nav.teachers', roles: ['admin'], icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z' },
  { to: '/classes', key: 'nav.classes', roles: ['admin'], icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4' },
  { to: '/academic', key: 'nav.academic', roles: ['admin'], icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253' },
  { to: '/attendance', key: 'nav.attendance', roles: ['admin', 'teacher', 'accountant'], icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
  { to: '/exams', key: 'nav.exams', roles: ['admin', 'teacher'], icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4' },
  { to: '/assignments', key: 'nav.assignments', roles: ['admin', 'teacher'], icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2' },
  { to: '/fees', key: 'nav.fees', roles: ['admin', 'accountant'], icon: 'M3 10h18M7 15h2m4 0h4M5 6h14a1 1 0 011 1v10a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1z' },
  { to: '/announcements', key: 'nav.announcements', roles: ['admin', 'teacher', 'accountant'], icon: 'M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z' },
  { to: '/reports', key: 'nav.reports', roles: ['admin', 'accountant'], icon: 'M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
  { to: '/notifications', key: 'nav.notifications', roles: ['*'], icon: 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9' },
]

export default function AppLayout() {
  const { t } = useTranslation()
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('cove_sidebar_collapsed') === '1')
  const [lang, setLang] = useState(localStorage.getItem('cove_locale') ?? 'en')
  const [unread, setUnread] = useState(0)

  const role = roleOf(user)

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      localStorage.setItem('cove_sidebar_collapsed', prev ? '0' : '1')
      return !prev
    })
  }

  const items = navItems.filter(
    (item) => item.roles.includes('*') || item.roles.includes(role),
  )

  const switchLanguage = () => {
    const next = lang === 'en' ? 'ar' : 'en'
    setLang(next)
    setLanguage(next)
  }

  const loadUnread = async () => {
    try {
      const res = await api.get<{ count: number }>('/notifications/unread-count')
      setUnread(res.data.count)
    } catch {
      setUnread(0)
    }
  }

  void loadUnread()

  const onLogout = async () => {
    await logout()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 z-40 w-64 bg-gray-900 text-gray-100 transition-[inset-inline-start,width] duration-300 lg:start-0',
          collapsed ? 'lg:w-20' : 'lg:w-64',
          sidebarOpen ? 'start-0' : '-start-full',
        )}
      >
        <div className={cn('flex h-16 items-center gap-2 border-b border-gray-800 px-5', collapsed ? 'lg:justify-center lg:px-0' : '')}>
          <img
            src="/Cove-Logo2-NBG.png"
            alt={t('appName')}
            className={cn('h-9 w-9 rounded-lg object-contain', collapsed ? 'lg:h-10 lg:w-10' : '')}
          />
          <div className={cn(collapsed ? 'lg:hidden' : '')}>
            <p className="text-sm font-semibold leading-tight">{t('appName')}</p>
            <p className="text-[11px] text-gray-400">{t('tagline')}</p>
          </div>
        </div>
        <nav className="px-3 py-4">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setSidebarOpen(false)}
              title={collapsed ? t(item.key) : undefined}
              className={({ isActive }) =>
                cn(
                  'mb-1 flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  collapsed ? 'lg:justify-center lg:px-0' : '',
                  isActive ? 'bg-indigo-600 text-white' : 'text-gray-300 hover:bg-gray-800 hover:text-white',
                )
              }
            >
              <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
              </svg>
              <span className={cn(collapsed ? 'lg:hidden' : '')}>{t(item.key)}</span>
            </NavLink>
          ))}
        </nav>
      </aside>
      {sidebarOpen && <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      {/* Main */}
      <div className={cn(collapsed ? 'lg:ms-20' : 'lg:ms-64')}>
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-gray-200 bg-white px-4 lg:px-8">
          <div className="flex items-center gap-3">
            <button
              className="rounded-md p-2 text-gray-500 hover:bg-gray-100 lg:hidden"
              onClick={() => setSidebarOpen(true)}
              aria-label="Menu"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <button
              className="hidden rounded-md p-2 text-gray-500 hover:bg-gray-100 lg:block"
              onClick={toggleCollapsed}
              aria-label="Toggle sidebar"
              title={collapsed ? t('common.expand') : t('common.collapse')}
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                {collapsed ? (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11 5l-7 7 7 7M19 5l-7 7 7 7" />
                )}
              </svg>
            </button>
            <p className="hidden text-sm font-medium text-gray-500 sm:block">
              {user?.school?.name ?? ''}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={switchLanguage}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
            >
              {lang === 'en' ? 'العربية' : 'English'}
            </button>
            <button
              onClick={() => navigate('/notifications')}
              className="relative rounded-lg p-2 text-gray-500 hover:bg-gray-100"
              aria-label="Notifications"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              {unread > 0 && (
                <span className="absolute -top-0.5 -end-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                  {unread}
                </span>
              )}
            </button>
            <div className="flex items-center gap-2 border-s border-gray-200 ps-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-100 text-sm font-semibold text-indigo-700">
                {(user?.name ?? '?').charAt(0).toUpperCase()}
              </div>
              <div className="hidden sm:block">
                <p className="text-sm font-medium text-gray-800">{user?.name}</p>
                <p className="text-[11px] capitalize text-gray-400">{role}</p>
              </div>
              <button
                onClick={() => void onLogout()}
                className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                aria-label="Logout"
                title={t('common.logout')}
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                  />
                </svg>
              </button>
            </div>
          </div>
        </header>
        <main className="p-4 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
