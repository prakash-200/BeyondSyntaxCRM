import { useQueryClient } from '@tanstack/react-query'
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { AUTH_EXPIRED_EVENT } from '@/api/apiClient'
import { authApi } from '@/api/authApi'
import { tokenStore } from '@/api/tokenStore'
import type { Permission } from '@/constants/permissions'
import type { AuthSession, LoginRequest, User } from '@/types'

type Status = 'loading' | 'authenticated' | 'unauthenticated'

interface AuthContextValue {
  status: Status
  user: User | null
  permissions: Permission[]
  login: (credentials: LoginRequest) => Promise<void>
  logout: () => Promise<void>
  /** Re-read the session (e.g. after the permission matrix changed). */
  refresh: () => Promise<void>
  can: (permission: Permission | Permission[]) => boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const stored = tokenStore.get()
  const [status, setStatus] = useState<Status>(stored ? 'loading' : 'unauthenticated')
  const [user, setUser] = useState<User | null>(stored?.user ?? null)
  const [permissions, setPermissions] = useState<Permission[]>(stored?.permissions ?? [])

  const apply = useCallback((session: AuthSession | null) => {
    setUser(session?.user ?? null)
    setPermissions(session?.permissions ?? [])
    setStatus(session ? 'authenticated' : 'unauthenticated')
  }, [])

  // Validate the persisted session on startup and pick up permission changes.
  useEffect(() => {
    if (!stored) return
    let cancelled = false
    authApi
      .me()
      .then((session) => {
        if (cancelled) return
        tokenStore.update({ ...tokenStore.get()!, user: session.user, permissions: session.permissions })
        apply(session)
      })
      .catch(() => {
        if (cancelled) return
        tokenStore.clear()
        apply(null)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const onExpired = () => {
      queryClient.clear()
      apply(null)
    }
    window.addEventListener(AUTH_EXPIRED_EVENT, onExpired)
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, onExpired)
  }, [apply, queryClient])

  const login = useCallback(
    async (credentials: LoginRequest) => {
      const session = await authApi.login(credentials)
      queryClient.clear()
      tokenStore.set(session, credentials.remember)
      apply(session)
    },
    [apply, queryClient],
  )

  const logout = useCallback(async () => {
    try {
      await authApi.logout()
    } catch {
      /* token may already be invalid */
    }
    tokenStore.clear()
    queryClient.clear()
    apply(null)
  }, [apply, queryClient])

  const refresh = useCallback(async () => {
    const session = await authApi.me()
    tokenStore.update({ ...tokenStore.get()!, user: session.user, permissions: session.permissions })
    apply(session)
  }, [apply])

  const can = useCallback(
    (permission: Permission | Permission[]) => {
      const needed = Array.isArray(permission) ? permission : [permission]
      return needed.some((p) => permissions.includes(p))
    },
    [permissions],
  )

  const value = useMemo(() => ({ status, user, permissions, login, logout, refresh, can }), [status, user, permissions, login, logout, refresh, can])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}

/** Shorthand for permission checks in components. */
export function useCan() {
  return useAuth().can
}
