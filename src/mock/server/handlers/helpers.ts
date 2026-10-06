import type { Employee } from '@/types'
import { logAudit, type AuditInput } from '../../db'
import type { Ctx } from '../router'

export function audit(ctx: Ctx, input: Omit<AuditInput, 'userId' | 'userName' | 'userRole'>) {
  return logAudit(ctx.db, { ...input, userId: ctx.user.id, userName: ctx.user.name, userRole: ctx.user.role })
}

export const actor = (ctx: Ctx) => ({ id: ctx.user.id, name: ctx.user.name })

const COLORS = ['#4f46e5', '#0891b2', '#059669', '#d97706', '#db2777', '#7c3aed', '#2563eb', '#dc2626']
export function avatarColor(id: string) {
  let h = 0
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return COLORS[h % COLORS.length]
}

export function toUser(e: Employee) {
  return { id: e.id, name: e.name, email: e.email, role: e.role, department: e.department, avatarColor: avatarColor(e.id) }
}

/** Student ids a trainer may see (students in their batches). */
export function trainerBatchIds(ctx: Ctx): string[] {
  return ctx.db.batches.filter((b) => b.trainerId === ctx.user.id).map((b) => b.id)
}

export function trainerStudentIds(ctx: Ctx): Set<string> {
  const batchIds = new Set(trainerBatchIds(ctx))
  return new Set(ctx.db.batchStudents.filter((x) => batchIds.has(x.batchId) && x.status === 'ACTIVE').map((x) => x.studentId))
}

export const isTrainer = (ctx: Ctx) => ctx.user.role === 'TRAINER'
export const isCounselor = (ctx: Ctx) => ctx.user.role === 'COUNSELOR'

export const money = (n: number) => `₹${n.toLocaleString('en-IN')}`
