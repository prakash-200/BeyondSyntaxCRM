import type { Role } from '@/constants/enums'
import type { Permission } from '@/constants/permissions'
import type { Id } from './common'

export type { Role, Permission }

export interface User {
  id: Id
  name: string
  email: string
  role: Role
  department: string
  avatarColor: string
}

export interface LoginRequest {
  email: string
  password: string
  remember: boolean
}

export interface AuthSession {
  accessToken: string
  refreshToken: string
  expiresAt: string
  user: User
  permissions: Permission[]
}

export interface RoleDefinition {
  role: Role
  label: string
  permissions: Permission[]
  employeeCount: number
}
