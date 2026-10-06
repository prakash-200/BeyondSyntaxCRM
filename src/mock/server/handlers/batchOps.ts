import type { Batch, BatchStudent, Student } from '@/types'
import { nowIso } from '@/utils/clock'
import { advanceApplication, nextId } from '../../db'
import { badRequest, conflict, type Ctx } from '../router'
import { activeBatchStudents, batchOf } from '../present'
import { actor, audit } from './helpers'

function assertAssignable(ctx: Ctx, student: Student, batch: Batch) {
  if (batch.status === 'COMPLETED' || batch.status === 'CANCELLED')
    throw conflict(`${batch.name} is ${batch.status.toLowerCase()}. Students cannot be assigned to a completed or cancelled batch.`)
  if (student.status !== 'ACTIVE') throw conflict('Only active students can be assigned to a batch.')
  if (student.courseId !== batch.courseId) throw conflict('The batch belongs to a different course than the student’s enrolled course.')
  if (activeBatchStudents(ctx.db, batch.id).length >= batch.capacity) throw conflict(`${batch.name} is full (capacity ${batch.capacity}).`)
}

function activeMembership(ctx: Ctx, studentId: string) {
  return ctx.db.batchStudents.find((x) => x.studentId === studentId && x.status === 'ACTIVE')
}

export function enrollStudent(ctx: Ctx, student: Student, batch: Batch): BatchStudent {
  const current = activeMembership(ctx, student.id)
  if (current?.batchId === batch.id) throw conflict(`${student.fullName} is already in ${batch.name}.`)
  if (current) throw conflict(`${student.fullName} is already assigned to ${batchOf(ctx.db, current.batchId)?.name}. Use “Transfer” to change batches.`)
  assertAssignable(ctx, student, batch)
  const row: BatchStudent = { id: nextId(ctx.db, 'BS-', 4), batchId: batch.id, studentId: student.id, joinedAt: nowIso(), status: 'ACTIVE' }
  ctx.db.batchStudents.push(row)
  student.batchId = batch.id
  const app = ctx.db.applications.find((a) => a.id === student.applicationId)
  if (app) advanceApplication(app, 'BATCH_ASSIGNED', actor(ctx), nowIso(), `Assigned to ${batch.name}.`)
  audit(ctx, { action: 'BATCH_ASSIGNED', entityType: 'BATCH', entityId: batch.id, entityLabel: batch.name, description: `${student.fullName} assigned to ${batch.name}`, newValue: batch.name, relatedIds: [student.id, student.applicationId ?? ''].filter(Boolean) })
  return row
}

export function transferStudent(ctx: Ctx, student: Student, target: Batch, reason: string): BatchStudent {
  const current = activeMembership(ctx, student.id)
  if (!current) throw conflict(`${student.fullName} is not in a batch yet. Assign a batch instead.`)
  if (current.batchId === target.id) throw conflict('Choose a different batch to transfer to.')
  if (!reason?.trim()) throw badRequest('Validation failed', { reason: ['A reason is required for batch transfers'] })
  assertAssignable(ctx, student, target)
  const from = batchOf(ctx.db, current.batchId)!
  current.status = 'TRANSFERRED'
  current.reason = reason.trim()
  const row: BatchStudent = { id: nextId(ctx.db, 'BS-', 4), batchId: target.id, studentId: student.id, joinedAt: nowIso(), status: 'ACTIVE', fromBatchId: from.id, reason: reason.trim() }
  ctx.db.batchStudents.push(row)
  student.batchId = target.id
  audit(ctx, { action: 'BATCH_CHANGED', entityType: 'BATCH', entityId: target.id, entityLabel: target.name, description: `${student.fullName} transferred from ${from.name} to ${target.name}`, previousValue: from.name, newValue: target.name, reason: reason.trim(), relatedIds: [student.id, from.id, student.applicationId ?? ''].filter(Boolean) })
  return row
}

export function unenrollStudent(ctx: Ctx, student: Student, reason: string) {
  const current = activeMembership(ctx, student.id)
  if (!current) throw conflict(`${student.fullName} is not in an active batch.`)
  if (!reason?.trim()) throw badRequest('Validation failed', { reason: ['A reason is required to remove a student from a batch'] })
  const batch = batchOf(ctx.db, current.batchId)!
  current.status = 'REMOVED'
  current.reason = reason.trim()
  student.batchId = null
  audit(ctx, { action: 'BATCH_REMOVED', entityType: 'BATCH', entityId: batch.id, entityLabel: batch.name, description: `${student.fullName} removed from ${batch.name}`, previousValue: batch.name, newValue: null, reason: reason.trim(), relatedIds: [student.id, student.applicationId ?? ''].filter(Boolean) })
}
