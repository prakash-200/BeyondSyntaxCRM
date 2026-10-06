import type { AuditLog } from '@/types'
import type { Db } from '../../db'
import type { Ctx } from '../router'

const FINANCIAL: AuditLog['entityType'][] = ['PAYMENT', 'FEE_PLAN', 'REFUND', 'INVOICE']

/** Audit events related to an entity (newest first). Trainers never see financial events. */
export function activityFor(ctx: Ctx, entityId: string | (string | null | undefined)[], limit = 100): AuditLog[] {
  const ids = (Array.isArray(entityId) ? entityId : [entityId]).filter((x): x is string => !!x)
  const db: Db = ctx.db
  return db.auditLogs
    .filter((l) => ids.some((id) => l.relatedIds.includes(id)))
    .filter((l) => ctx.user.role !== 'TRAINER' || !FINANCIAL.includes(l.entityType))
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .slice(0, limit)
}
