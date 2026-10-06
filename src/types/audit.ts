import type { AuditAction, EntityType, NotificationType, Role } from '@/constants/enums'
import type { DateTimeString, Id } from './common'

export interface AuditLog {
  id: Id
  userId: Id
  userName: string
  userRole?: Role
  action: AuditAction
  entityType: EntityType
  entityId: Id
  entityLabel?: string
  /** Human-readable description used by the activity timeline. */
  description: string
  previousValue?: string | null
  newValue?: string | null
  reason?: string
  timestamp: DateTimeString
  ipAddress: string
  userAgent: string
  /** Ids of every record this event should appear under (student, lead, ...). */
  relatedIds: Id[]
}

export interface AppNotification {
  id: Id
  type: NotificationType
  title: string
  message: string
  createdAt: DateTimeString
  read: boolean
  link?: string
  roles: Role[]
}
