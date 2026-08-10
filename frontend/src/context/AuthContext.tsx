import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { api, TOKEN_KEY } from '../lib/api'
import type { User } from '../lib/types'

interface AuthContextValue {
  user: User | null
  permissions: string[]
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  refresh: () => Promise<void>
  hasRole: (...roles: string[]) => boolean
  can: (permission: string) => boolean
  setUser: (user: User) => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [permissions, setPermissions] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    const token = localStorage.getItem(TOKEN_KEY)
    if (!token) {
      setLoading(false)
      return
    }
    try {
      const res = await api.get<{ user: User; permissions: string[] }>('/auth/me')
      setUser(res.data.user)
      setPermissions(res.data.permissions)
    } catch {
      localStorage.removeItem(TOKEN_KEY)
      setUser(null)
      setPermissions([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.post<{ user: User; token: string | null }>('/auth/login', {
      email,
      password,
      device_name: 'web',
    })
    if (res.data.token) {
      localStorage.setItem(TOKEN_KEY, res.data.token)
    }
    setUser(res.data.user)
    const me = await api.get<{ user: User; permissions: string[] }>('/auth/me')
    setUser(me.data.user)
    setPermissions(me.data.permissions)
  }, [])

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout')
    } catch {
      // ignore network errors on logout
    }
    localStorage.removeItem(TOKEN_KEY)
    setUser(null)
    setPermissions([])
  }, [])

  const hasRole = useCallback(
    (...roles: string[]) => {
      if (!user?.roles) return false
      return roles.some((r) => user.roles!.some((role) => role.name === r))
    },
    [user],
  )

  const can = useCallback(
    (permission: string) => permissions.includes(permission),
    [permissions],
  )

  const value = useMemo(
    () => ({ user, permissions, loading, login, logout, refresh, hasRole, can, setUser }),
    [user, permissions, loading, login, logout, refresh, hasRole, can],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return ctx
}

export function roleOf(user: User | null): string {
  if (!user?.roles?.length) return 'admin'
  const names = user.roles.map((r) => r.name)
  if (names.includes('super_admin')) return 'admin'
  if (names.includes('teacher')) return 'teacher'
  if (names.includes('student')) return 'student'
  if (names.includes('parent')) return 'parent'
  if (names.includes('accountant')) return 'accountant'
  return 'admin'
}
