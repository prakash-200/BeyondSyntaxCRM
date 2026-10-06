import type { AttendanceStatus } from '@/constants/enums'
import { ATTENDANCE_STATUSES } from '@/constants/enums'
import { humanize } from '@/constants/labels'
import type { Assignment, AssignmentSubmission, AttendanceSessionDetail, AttendanceSummaryRow, ClassSession } from '@/types'
import { today, nowIso } from '@/utils/clock'
import { advanceApplication, nextId, type Db } from '../../db'
import { actor, audit, isTrainer } from './helpers'
import { badRequest, conflict, del, get, listResponse, notFound, post, put, requireFields, type Ctx } from '../router'
import { activeBatchStudents, attendanceStatsFor, batchOf, courseOf, employeeName, studentOf } from '../present'

function accessibleBatch(ctx: Ctx, batchId: string) {
  const b = batchOf(ctx.db, batchId)
  if (!b || (isTrainer(ctx) && b.trainerId !== ctx.user.id)) throw notFound('Batch')
  return b
}

function sessionView(db: Db, s: ClassSession): ClassSession {
  const batch = batchOf(db, s.batchId)
  const recs = db.attendance.filter((a) => a.sessionId === s.id)
  return {
    ...s,
    batchName: batch?.name,
    courseName: courseOf(db, batch?.courseId)?.name,
    trainerName: employeeName(db, s.trainerId),
    presentCount: recs.filter((r) => r.status === 'PRESENT' || r.status === 'LATE').length,
    totalCount: recs.length,
    marked: recs.length > 0,
  }
}

function findSession(ctx: Ctx, id: string) {
  const s = ctx.db.sessions.find((x) => x.id === id)
  if (!s) throw notFound('Class session')
  accessibleBatch(ctx, s.batchId)
  return s
}

get('/attendance/sessions', 'attendance:view', (ctx) => {
  const q = ctx.query
  let rows = ctx.db.sessions
  if (isTrainer(ctx)) {
    const mine = new Set(ctx.db.batches.filter((b) => b.trainerId === ctx.user.id).map((b) => b.id))
    rows = rows.filter((s) => mine.has(s.batchId))
  }
  if (q.batchId) rows = rows.filter((s) => s.batchId === q.batchId)
  if (q.trainerId) rows = rows.filter((s) => s.trainerId === q.trainerId)
  let view = rows.map((s) => sessionView(ctx.db, s))
  if (q.marked) view = view.filter((s) => String(s.marked) === q.marked)
  return listResponse(view, q, {
    searchText: (s) => `${s.batchName} ${s.topic} ${s.trainerName}`,
    dateOf: (s) => s.date,
    defaultSort: 'date',
    defaultOrder: 'desc',
    sorters: { date: (s) => s.date + s.id, batch: (s) => s.batchName ?? '', topic: (s) => s.topic },
  })
})

post('/attendance/sessions', 'attendance:create', (ctx) => {
  const b = ctx.body as Partial<ClassSession>
  requireFields(b as Record<string, unknown>, ['batchId', 'date', 'topic'])
  const batch = accessibleBatch(ctx, b.batchId!)
  if (batch.status === 'UPCOMING' || batch.status === 'CANCELLED') throw conflict(`${batch.name} is ${batch.status.toLowerCase()}; classes cannot be recorded.`)
  if (b.date! > today()) throw badRequest('Validation failed', { date: ['Attendance cannot be recorded for a future date'] })
  if (b.date! < batch.startDate || b.date! > batch.endDate) throw badRequest('Validation failed', { date: ['Date falls outside the batch schedule'] })
  const existing = ctx.db.sessions.find((s) => s.batchId === batch.id && s.date === b.date)
  if (existing) return sessionView(ctx.db, existing)
  const session: ClassSession = { id: nextId(ctx.db, 'CLS-', 4), batchId: batch.id, date: b.date!, trainerId: batch.trainerId, topic: b.topic!, moduleId: b.moduleId ?? null }
  ctx.db.sessions.push(session)
  return sessionView(ctx.db, session)
})

get('/attendance/sessions/:id', 'attendance:view', (ctx): AttendanceSessionDetail => {
  const s = findSession(ctx, ctx.params.id)
  const records = ctx.db.attendance.filter((a) => a.sessionId === s.id)
  const recordIds = new Set(records.map((r) => r.studentId))
  const studentIds = new Set([...activeBatchStudents(ctx.db, s.batchId).map((x) => x.studentId), ...recordIds])
  const roster = [...studentIds]
    .map((id) => ({ studentId: id, studentName: studentOf(ctx.db, id)?.fullName ?? id, status: (records.find((r) => r.studentId === id)?.status ?? 'PRESENT') as AttendanceStatus }))
    .sort((a, b) => a.studentName.localeCompare(b.studentName))
  return { ...sessionView(ctx.db, s), roster }
})

put('/attendance/sessions/:id', 'attendance:update', (ctx) => {
  const s = findSession(ctx, ctx.params.id)
  if (s.date > today()) throw conflict('Attendance cannot be recorded for a future class.')
  const records = (ctx.body?.records ?? []) as { studentId: string; status: AttendanceStatus }[]
  if (!records.length) throw badRequest('No attendance records supplied')
  const batch = batchOf(ctx.db, s.batchId)!
  const wasMarked = ctx.db.attendance.some((a) => a.sessionId === s.id)
  const allowed = new Set([...activeBatchStudents(ctx.db, s.batchId).map((x) => x.studentId), ...ctx.db.attendance.filter((a) => a.sessionId === s.id).map((a) => a.studentId)])
  const counts: Record<string, number> = {}
  for (const r of records) {
    if (!allowed.has(r.studentId)) throw badRequest(`Student ${r.studentId} is not part of this batch`)
    if (!ATTENDANCE_STATUSES.includes(r.status)) throw badRequest(`Invalid attendance status for ${r.studentId}`)
    const existing = ctx.db.attendance.find((a) => a.sessionId === s.id && a.studentId === r.studentId)
    if (existing) existing.status = r.status
    else ctx.db.attendance.push({ id: nextId(ctx.db, 'ATT-', 5), sessionId: s.id, studentId: r.studentId, status: r.status })
    counts[r.status] = (counts[r.status] ?? 0) + 1
    if (r.status === 'PRESENT' || r.status === 'LATE') {
      const app = ctx.db.applications.find((a) => a.studentId === r.studentId)
      if (app) advanceApplication(app, 'TRAINING_STARTED', actor(ctx), nowIso(), 'First class attended.')
    }
  }
  const summary = ATTENDANCE_STATUSES.filter((st) => counts[st]).map((st) => `${counts[st]} ${humanize(st).toLowerCase()}`).join(', ')
  audit(ctx, { action: 'ATTENDANCE_UPDATED', entityType: 'ATTENDANCE', entityId: s.id, entityLabel: batch.name, description: `${wasMarked ? 'Attendance updated' : 'Attendance marked'} for ${batch.name} on ${s.date}`, newValue: summary, relatedIds: [batch.id, ...records.map((r) => r.studentId)] })
  return sessionView(ctx.db, s)
})

get('/attendance/summary', 'attendance:view', (ctx): AttendanceSummaryRow[] => {
  const batch = accessibleBatch(ctx, ctx.query.batchId ?? '')
  return activeBatchStudents(ctx.db, batch.id)
    .map((x) => attendanceStatsFor(ctx.db, x.studentId))
    .sort((a, b) => a.percent - b.percent)
})

/* ───────────── assignments ───────────── */

function assignmentView(db: Db, a: Assignment): Assignment {
  const subs = db.submissions.filter((s) => s.assignmentId === a.id)
  return {
    ...a,
    courseName: courseOf(db, a.courseId)?.name,
    moduleName: db.modules.find((m) => m.id === a.moduleId)?.name,
    batchName: batchOf(db, a.batchId)?.name,
    totalCount: subs.length,
    submittedCount: subs.filter((s) => s.status !== 'NOT_STARTED').length,
    reviewedCount: subs.filter((s) => s.reviewedAt).length,
  }
}

function findAssignment(ctx: Ctx, id: string) {
  const a = ctx.db.assignments.find((x) => x.id === id)
  if (!a) throw notFound('Assignment')
  accessibleBatch(ctx, a.batchId)
  return a
}

get('/assignments', 'assignments:view', (ctx) => {
  const q = ctx.query
  let rows = ctx.db.assignments
  if (isTrainer(ctx)) {
    const mine = new Set(ctx.db.batches.filter((b) => b.trainerId === ctx.user.id).map((b) => b.id))
    rows = rows.filter((a) => mine.has(a.batchId))
  }
  if (q.batchId) rows = rows.filter((a) => a.batchId === q.batchId)
  if (q.courseId) rows = rows.filter((a) => a.courseId === q.courseId)
  if (q.moduleId) rows = rows.filter((a) => a.moduleId === q.moduleId)
  let view = rows.map((a) => assignmentView(ctx.db, a))
  if (q.status === 'open') view = view.filter((a) => a.dueDate >= today())
  if (q.status === 'closed') view = view.filter((a) => a.dueDate < today())
  if (q.status === 'needsReview') view = view.filter((a) => (a.submittedCount ?? 0) > (a.reviewedCount ?? 0))
  return listResponse(view, q, {
    searchText: (a) => `${a.id} ${a.title} ${a.batchName} ${a.moduleName}`,
    dateOf: (a) => a.dueDate,
    defaultSort: 'dueDate',
    defaultOrder: 'desc',
    sorters: { dueDate: (a) => a.dueDate, title: (a) => a.title.toLowerCase(), batch: (a) => a.batchName ?? '', marks: (a) => a.maxMarks },
  })
})

get('/assignments/:id', 'assignments:view', (ctx) => assignmentView(ctx.db, findAssignment(ctx, ctx.params.id)))

post('/assignments', 'assignments:create', (ctx) => {
  const b = ctx.body as Partial<Assignment>
  requireFields(b as Record<string, unknown>, ['batchId', 'moduleId', 'title', 'dueDate', 'maxMarks'])
  const batch = accessibleBatch(ctx, b.batchId!)
  if (batch.status === 'CANCELLED') throw conflict('Assignments cannot be added to a cancelled batch.')
  const mod = ctx.db.modules.find((m) => m.id === b.moduleId && m.courseId === batch.courseId)
  if (!mod) throw badRequest('Validation failed', { moduleId: ['Module does not belong to this batch’s course'] })
  if (!(Number(b.maxMarks) > 0)) throw badRequest('Validation failed', { maxMarks: ['Max marks must be greater than 0'] })
  const asg: Assignment = { id: nextId(ctx.db, 'ASG-', 3), courseId: batch.courseId, moduleId: mod.id, batchId: batch.id, title: String(b.title).trim(), description: b.description ?? '', dueDate: b.dueDate!, maxMarks: Number(b.maxMarks) }
  ctx.db.assignments.push(asg)
  for (const x of activeBatchStudents(ctx.db, batch.id)) {
    ctx.db.submissions.push({ id: nextId(ctx.db, 'SUB-', 4), assignmentId: asg.id, studentId: x.studentId, status: 'NOT_STARTED', score: null, feedback: '', submittedAt: null, reviewedAt: null })
  }
  audit(ctx, { action: 'ASSIGNMENT_CREATED', entityType: 'ASSIGNMENT', entityId: asg.id, entityLabel: asg.title, description: `Assignment “${asg.title}” created for ${batch.name}`, relatedIds: [batch.id] })
  return assignmentView(ctx.db, asg)
})

put('/assignments/:id', 'assignments:update', (ctx) => {
  const asg = findAssignment(ctx, ctx.params.id)
  const b = ctx.body as Partial<Assignment>
  const max = b.maxMarks !== undefined ? Number(b.maxMarks) : asg.maxMarks
  if (!(max > 0)) throw badRequest('Validation failed', { maxMarks: ['Max marks must be greater than 0'] })
  if (ctx.db.submissions.some((s) => s.assignmentId === asg.id && (s.score ?? 0) > max)) throw conflict('Some students already scored higher than the new maximum.')
  Object.assign(asg, { title: b.title?.trim() || asg.title, description: b.description ?? asg.description, dueDate: b.dueDate ?? asg.dueDate, maxMarks: max })
  return assignmentView(ctx.db, asg)
})

del('/assignments/:id', 'assignments:delete', (ctx) => {
  const asg = findAssignment(ctx, ctx.params.id)
  if (ctx.db.submissions.some((s) => s.assignmentId === asg.id && s.reviewedAt)) throw conflict('Reviewed assignments cannot be deleted because marks have been awarded.')
  ctx.db.submissions = ctx.db.submissions.filter((s) => s.assignmentId !== asg.id)
  ctx.db.assignments = ctx.db.assignments.filter((a) => a.id !== asg.id)
  return { ok: true }
})

get('/assignments/:id/submissions', 'assignments:view', (ctx): AssignmentSubmission[] => {
  const asg = findAssignment(ctx, ctx.params.id)
  return ctx.db.submissions
    .filter((s) => s.assignmentId === asg.id)
    .map((s) => ({ ...s, studentName: studentOf(ctx.db, s.studentId)?.fullName, assignmentTitle: asg.title, maxMarks: asg.maxMarks }))
    .sort((a, b) => (a.studentName ?? '').localeCompare(b.studentName ?? ''))
})

put('/submissions/:id', 'assignments:update', (ctx) => {
  const sub = ctx.db.submissions.find((s) => s.id === ctx.params.id)
  if (!sub) throw notFound('Submission')
  const asg = findAssignment(ctx, sub.assignmentId)
  const b = ctx.body as Partial<AssignmentSubmission>
  const prevScore = sub.score
  if (b.status) sub.status = b.status
  if ((sub.status === 'SUBMITTED' || sub.status === 'LATE') && !sub.submittedAt) sub.submittedAt = nowIso()
  if (b.score !== undefined && b.score !== null) {
    if (typeof b.score !== 'number' || b.score < 0 || b.score > asg.maxMarks) throw badRequest('Validation failed', { score: [`Score must be between 0 and ${asg.maxMarks}`] })
    if (sub.status === 'NOT_STARTED') throw conflict('This assignment has not been submitted yet.')
    sub.score = b.score
    sub.reviewedAt = nowIso()
    if (sub.status !== 'LATE') sub.status = 'REVIEWED'
  }
  if (b.feedback !== undefined) sub.feedback = b.feedback
  if (b.score !== undefined) {
    const s = studentOf(ctx.db, sub.studentId)
    audit(ctx, { action: 'ASSIGNMENT_GRADED', entityType: 'ASSIGNMENT', entityId: asg.id, entityLabel: asg.title, description: `${s?.fullName} scored ${b.score}/${asg.maxMarks} on “${asg.title}”`, previousValue: prevScore === null || prevScore === undefined ? null : `${prevScore}/${asg.maxMarks}`, newValue: `${b.score}/${asg.maxMarks}`, relatedIds: [sub.studentId, asg.batchId] })
  }
  return { ...sub, studentName: studentOf(ctx.db, sub.studentId)?.fullName, assignmentTitle: asg.title, maxMarks: asg.maxMarks }
})
