import type { Permission } from '@/constants/permissions'
import type {
  AppNotification,
  AppSettings,
  Application,
  ApplicationHistoryEntry,
  Assignment,
  AssignmentSubmission,
  Attendance,
  AuditLog,
  Batch,
  BatchStudent,
  Certificate,
  ClassSession,
  Course,
  CourseModule,
  Employee,
  FeePlan,
  FollowUp,
  Installment,
  Invoice,
  Lead,
  Payment,
  Refund,
  Role,
  StoredDocument,
  Student,
  StudentProgress,
} from '@/types'
import type { ApplicationStatus, AuditAction, EntityType } from '@/constants/enums'
import { APPLICATION_STATUSES } from '@/constants/enums'
import { nowIso } from '@/utils/clock'
import { buildSeed } from './seed'

export type StoredFeePlan = Pick<
  FeePlan,
  'id' | 'studentId' | 'courseId' | 'courseFee' | 'discount' | 'scholarship' | 'finalFee' | 'createdAt' | 'invoiceId'
>
export type StoredInvoice = Omit<Invoice, 'paid' | 'balance' | 'status' | 'studentName' | 'courseName'>

export interface Db {
  employees: Employee[]
  credentials: Record<string, string>
  rolePermissions: Record<Role, Permission[]>
  leads: Lead[]
  followUps: FollowUp[]
  applications: Application[]
  students: Student[]
  courses: Course[]
  modules: CourseModule[]
  batches: Batch[]
  batchStudents: BatchStudent[]
  sessions: ClassSession[]
  attendance: Attendance[]
  assignments: Assignment[]
  submissions: AssignmentSubmission[]
  progress: StudentProgress[]
  feePlans: StoredFeePlan[]
  installments: Installment[]
  payments: Payment[]
  invoices: StoredInvoice[]
  refunds: Refund[]
  certificates: Certificate[]
  documents: StoredDocument[]
  auditLogs: AuditLog[]
  notifications: AppNotification[]
  settings: AppSettings
  counters: Record<string, number>
}

let instance: Db | null = null

export function getDb(): Db {
  if (!instance) instance = buildSeed()
  return instance
}

/** Next sequential id, e.g. nextId(db, 'LEAD-', 4) → LEAD-0051 */
export function nextId(db: Db, prefix: string, width: number): string {
  const current = db.counters[prefix] ?? 0
  db.counters[prefix] = current + 1
  return `${prefix}${String(current + 1).padStart(width, '0')}`
}

/** Align counters with ids already present in seeded data. */
export function syncCounter(db: Db, prefix: string, ids: string[]) {
  let max = 0
  for (const id of ids) {
    if (!id.startsWith(prefix)) continue
    const n = Number(id.slice(prefix.length))
    if (Number.isFinite(n) && n > max) max = n
  }
  db.counters[prefix] = Math.max(db.counters[prefix] ?? 0, max)
}

export interface AuditInput {
  userId: string
  userName: string
  userRole?: Role
  action: AuditAction
  entityType: EntityType
  entityId: string
  entityLabel?: string
  description: string
  previousValue?: string | null
  newValue?: string | null
  reason?: string
  relatedIds?: string[]
  timestamp?: string
}

export function logAudit(db: Db, input: AuditInput): AuditLog {
  const entry: AuditLog = {
    id: nextId(db, 'LOG-', 5),
    userId: input.userId,
    userName: input.userName,
    userRole: input.userRole,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    entityLabel: input.entityLabel,
    description: input.description,
    previousValue: input.previousValue ?? null,
    newValue: input.newValue ?? null,
    reason: input.reason,
    timestamp: input.timestamp ?? nowIso(),
    ipAddress: '203.0.113.' + (10 + (db.auditLogs.length % 200)),
    userAgent: 'Chrome 129 / Windows 11 (mock metadata)',
    relatedIds: Array.from(new Set([input.entityId, ...(input.relatedIds ?? [])])),
  }
  db.auditLogs.push(entry)
  return entry
}

export function pushNotification(
  db: Db,
  n: Omit<AppNotification, 'id' | 'createdAt' | 'read'> & { createdAt?: string; read?: boolean },
) {
  db.notifications.push({
    id: nextId(db, 'NTF-', 4),
    createdAt: n.createdAt ?? nowIso(),
    read: n.read ?? false,
    type: n.type,
    title: n.title,
    message: n.message,
    link: n.link,
    roles: n.roles,
  })
}

const rank = (s: ApplicationStatus) => APPLICATION_STATUSES.indexOf(s)

/**
 * Record an application milestone. History is append-only; the headline status
 * only moves forward (except CANCELLED), so e.g. a late final payment cannot
 * pull an application back from BATCH_ASSIGNED.
 */
export function advanceApplication(
  app: Application,
  status: ApplicationStatus,
  by: { id: string; name: string },
  at: string = nowIso(),
  note?: string,
) {
  if (app.history.some((h) => h.status === status)) return false
  const entry: ApplicationHistoryEntry = { status, at, byId: by.id, byName: by.name, note }
  app.history.push(entry)
  app.history.sort((a, b) => a.at.localeCompare(b.at))
  if (status === 'CANCELLED') app.status = 'CANCELLED'
  else if (app.status === 'CANCELLED' || rank(status) > rank(app.status)) app.status = status
  return true
}
