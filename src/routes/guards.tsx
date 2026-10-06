import type { ReactNode } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { ForbiddenState, LoadingState } from '@/components/common/States'
import type { Permission } from '@/constants/permissions'
import { useAuth } from '@/features/auth/AuthContext'

/** Redirects anonymous visitors to /login and remembers where they were going. */
export function RequireAuth() {
  const { status } = useAuth()
  const location = useLocation()
  if (status === 'loading') return <LoadingState label="Restoring your session…" className="min-h-dvh" />
  if (status === 'unauthenticated') return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  return <Outlet />
}

/** Signed-in users do not need the login screen. */
export function PublicOnly({ children }: { children: ReactNode }) {
  const { status } = useAuth()
  if (status === 'loading') return <LoadingState label="Loading…" className="min-h-dvh" />
  if (status === 'authenticated') return <Navigate to="/dashboard" replace />
  return <>{children}</>
}

/** Route-level authorisation. The API enforces the same rules independently. */
export function RequirePermission({ permission, children }: { permission: Permission | Permission[]; children: ReactNode }) {
  const { can } = useAuth()
  if (!can(permission)) return <ForbiddenState />
  return <>{children}</>
}
