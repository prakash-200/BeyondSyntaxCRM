import type { ReactNode } from 'react'
import { useAuth } from '@/features/auth/AuthContext'
import type { Permission } from '@/constants/permissions'

/**
 * UI-level permission gate. This only improves UX — authorisation is enforced
 * by the API (the mock server rejects unauthorised calls with 403 as well).
 */
export function Can({ permission, children, fallback = null }: { permission: Permission | Permission[]; children: ReactNode; fallback?: ReactNode }) {
  const { can } = useAuth()
  return <>{can(permission) ? children : fallback}</>
}
