import { humanize } from '@/constants/labels'
import type { StudentStatus } from '@/constants/enums'
import type { Application, ImportResult, Student, StudentListItem, StoredDocument } from '@/types'
import { today, nowIso } from '@/utils/clock'
import { advanceApplication, nextId, pushNotification, type Db } from '../../db'
import { activityFor } from './activity'
import { actor, audit, isTrainer, trainerStudentIds } from './helpers'
import { unenrollStudent } from './batchOps'
import { badRequest, conflict, del, get, listResponse, notFound, post, put, requireFields, type Ctx } from '../router'
import { attendanceStatsFor, batchOf, courseOf, feePlanView, presentApplication, presentPayment, presentStudent, progressOf, studentSummary } from '../present'

export function findStudent(db: Db, id: string): Student {
  const s = db.students.find((x) => x.id === id && !x.deletedAt)
  if (!s) throw notFound('Student')
  return s
}

/** Trainers can only access students in their own batches. */
function assertStudentAccess(ctx: Ctx, studentId: string) {
  if (isTrainer(ctx) && !trainerStudentIds(ctx).has(studentId)) throw notFound('Student')
}

function filteredStudents(ctx: Ctx): StudentListItem[] {
  const q = ctx.query
  let rows = ctx.db.students.filter((s) => !s.deletedAt)
  if (isTrainer(ctx)) {
    const allowed = trainerStudentIds(ctx)
    rows = rows.filter((s) => allowed.has(s.id))
  }
  if (q.status) rows = rows.filter((s) => s.status === q.status)
  if (q.courseId) rows = rows.filter((s) => s.courseId === q.courseId)
  if (q.batchId) rows = rows.filter((s) => s.batchId === q.batchId)
  if (q.counselorId) rows = rows.filter((s) => s.counselorId === q.counselorId)
  if (q.source) rows = rows.filter((s) => s.source === q.source)
  const showFees = ctx.can('fees:view')
  return rows.map((s) => ({
    ...presentStudent(ctx.db, s),
    progressPercent: progressOf(ctx.db, s.id).overallPercent,
    ...(showFees ? { outstandingAmount: studentSummary(ctx.db, s.id).outstandingAmount } : {}),
  }))
}

const LIST_OPTIONS = {
  searchText: (s: StudentListItem) => `${s.id} ${s.fullName} ${s.phone} ${s.email} ${s.city}`,
  dateOf: (s: StudentListItem) => s.admissionDate,
  defaultSort: 'admissionDate',
  defaultOrder: 'desc' as const,
  sorters: {
    admissionDate: (s: StudentListItem) => s.admissionDate + s.id,
    name: (s: StudentListItem) => s.fullName.toLowerCase(),
    id: (s: StudentListItem) => s.id,
    status: (s: StudentListItem) => s.status,
    course: (s: StudentListItem) => s.courseName ?? '',
    progress: (s: StudentListItem) => s.progressPercent,
    outstanding: (s: StudentListItem) => s.outstandingAmount ?? 0,
  },
}

get('/students', 'students:view', (ctx) => listResponse(filteredStudents(ctx), ctx.query, LIST_OPTIONS))

get('/students/export', 'students:view', (ctx) => {
  const all = listResponse(filteredStudents(ctx), { ...ctx.query, page: '1', pageSize: '500' }, LIST_OPTIONS)
  return all.items
})

post('/students/import', 'students:create', (ctx) => {
  const rows = (ctx.body?.rows ?? []) as { fullName: string; phone: string; email: string; courseCode?: string; city?: string }[]
  const result: ImportResult = { created: 0, skipped: [] }
  const counselorId = ctx.user.role === 'COUNSELOR' ? ctx.user.id : 'EMP-003'
  rows.forEach((row, i) => {
    const line = i + 2
    const phone = String(row.phone ?? '').replace(/\D/g, '').slice(-10)
    const course = ctx.db.courses.find((c) => c.code.toLowerCase() === String(row.courseCode ?? '').toLowerCase() || c.name.toLowerCase() === String(row.courseCode ?? '').toLowerCase())
    if (!row.fullName?.trim()) return result.skipped.push({ row: line, reason: 'Name is missing' })
    if (phone.length !== 10) return result.skipped.push({ row: line, reason: 'Invalid phone number' })
    if (!/^\S+@\S+\.\S+$/.test(row.email ?? '')) return result.skipped.push({ row: line, reason: 'Invalid email' })
    if (!course) return result.skipped.push({ row: line, reason: `Unknown course "${row.courseCode ?? ''}"` })
    if (ctx.db.students.some((s) => !s.deletedAt && (s.phone === phone || s.email.toLowerCase() === row.email.toLowerCase()))) return result.skipped.push({ row: line, reason: 'Duplicate phone or email' })
    const student = createStudent(ctx, { fullName: row.fullName.trim(), phone, email: row.email.trim(), courseId: course.id, city: row.city ?? '', counselorId } as Partial<Student>, 'Imported')
    result.created++
    void student
  })
  return result
})

get('/students/:id', 'students:view', (ctx) => {
  assertStudentAccess(ctx, ctx.params.id)
  const s = findStudent(ctx.db, ctx.params.id)
  const summary = studentSummary(ctx.db, s.id)
  if (!ctx.can('fees:view')) Object.assign(summary, { totalFee: 0, paidAmount: 0, outstandingAmount: 0, nextDueDate: null, nextDueAmount: 0 })
  return { ...presentStudent(ctx.db, s), summary }
})

function validateStudent(ctx: Ctx, b: Partial<Student>, selfId?: string) {
  requireFields(b as Record<string, unknown>, ['fullName', 'phone', 'email', 'courseId', 'counselorId'])
  const phone = String(b.phone).replace(/\D/g, '').slice(-10)
  if (phone.length !== 10) throw badRequest('Validation failed', { phone: ['Enter a valid 10-digit phone number'] })
  const dupPhone = ctx.db.students.find((s) => !s.deletedAt && s.id !== selfId && s.phone === phone)
  if (dupPhone) throw conflict(`A student with this phone number already exists (${dupPhone.id} — ${dupPhone.fullName}).`)
  const dupEmail = ctx.db.students.find((s) => !s.deletedAt && s.id !== selfId && s.email.toLowerCase() === String(b.email).toLowerCase())
  if (dupEmail) throw conflict(`A student with this email already exists (${dupEmail.id} — ${dupEmail.fullName}).`)
  return phone
}

/** Direct admission (no prior lead): creates the student and an approved application so the lifecycle stays complete. */
function createStudent(ctx: Ctx, b: Partial<Student>, origin: 'Direct admission' | 'Imported'): Student {
  const phone = String(b.phone).replace(/\D/g, '').slice(-10)
  const id = nextId(ctx.db, 'STU-2026-', 5)
  const appId = nextId(ctx.db, 'APP-2026-', 4)
  const admission = b.admissionDate ?? today()
  const student: Student = {
    id,
    fullName: String(b.fullName).trim(),
    phone,
    email: b.email ?? '',
    dateOfBirth: b.dateOfBirth ?? '',
    gender: b.gender ?? 'OTHER',
    address: b.address ?? '',
    city: b.city ?? '',
    state: b.state ?? '',
    postalCode: b.postalCode ?? '',
    education: b.education ?? '',
    college: b.college ?? '',
    graduationYear: b.graduationYear ?? new Date().getFullYear(),
    experience: b.experience ?? 'Fresher',
    currentOccupation: b.currentOccupation ?? '',
    source: b.source ?? 'WALK_IN',
    counselorId: b.counselorId!,
    status: 'ACTIVE',
    leadId: null,
    applicationId: appId,
    courseId: b.courseId!,
    batchId: null,
    admissionDate: admission,
    completedAt: null,
    certificateId: null,
    createdAt: nowIso(),
  }
  const app: Application = {
    id: appId,
    leadId: null,
    studentId: id,
    applicantName: student.fullName,
    phone,
    email: student.email,
    courseId: student.courseId,
    preferredBatchId: null,
    applicationDate: admission,
    counselorId: student.counselorId,
    status: 'NEW',
    notes: `${origin}.`,
    admissionDate: admission,
    history: [],
    certificateId: null,
  }
  for (const s of ['NEW', 'CONTACTED', 'COUNSELLING', 'APPLICATION_SUBMITTED', 'ADMISSION_APPROVED'] as const) advanceApplication(app, s, actor(ctx), nowIso(), s === 'ADMISSION_APPROVED' ? origin : undefined)
  ctx.db.students.push(student)
  ctx.db.applications.push(app)
  audit(ctx, { action: 'STUDENT_CREATED', entityType: 'STUDENT', entityId: id, entityLabel: student.fullName, description: `Student record ${id} created for ${student.fullName} (${origin.toLowerCase()})`, newValue: courseOf(ctx.db, student.courseId)?.name, relatedIds: [appId] })
  return student
}

post('/students', 'students:create', (ctx) => {
  validateStudent(ctx, ctx.body)
  return presentStudent(ctx.db, createStudent(ctx, ctx.body, 'Direct admission'))
})

const PROFILE_FIELDS: (keyof Student)[] = ['fullName', 'phone', 'email', 'dateOfBirth', 'gender', 'address', 'city', 'state', 'postalCode', 'education', 'college', 'graduationYear', 'experience', 'currentOccupation', 'source', 'counselorId']

put('/students/:id', 'students:update', (ctx) => {
  const s = findStudent(ctx.db, ctx.params.id)
  const b = ctx.body as Partial<Student>
  validateStudent(ctx, { ...s, ...b }, s.id)
  const changes: string[] = []
  const prev: string[] = []
  for (const key of PROFILE_FIELDS) {
    if (b[key] === undefined || b[key] === s[key]) continue
    const next = key === 'phone' ? String(b[key]).replace(/\D/g, '').slice(-10) : b[key]
    prev.push(`${key}: ${s[key] || '—'}`)
    changes.push(`${key}: ${next || '—'}`)
    ;(s as unknown as Record<string, unknown>)[key] = next
  }
  if (changes.length) audit(ctx, { action: 'STUDENT_UPDATED', entityType: 'STUDENT', entityId: s.id, entityLabel: s.fullName, description: `Student profile updated`, previousValue: prev.join('; '), newValue: changes.join('; '), relatedIds: [s.applicationId ?? ''].filter(Boolean) })
  return presentStudent(ctx.db, s)
})

del('/students/:id', 'students:delete', (ctx) => {
  const s = findStudent(ctx.db, ctx.params.id)
  if (ctx.db.payments.some((p) => p.studentId === s.id) || ctx.db.feePlans.some((p) => p.studentId === s.id))
    throw conflict('This student has financial records, which cannot be deleted. Change the status to Cancelled or Dropped instead.')
  s.deletedAt = nowIso()
  audit(ctx, { action: 'STUDENT_DELETED', entityType: 'STUDENT', entityId: s.id, entityLabel: s.fullName, description: `Student ${s.fullName} deleted (soft delete)`, relatedIds: [s.applicationId ?? ''].filter(Boolean) })
  return { ok: true }
})

post('/students/:id/status', 'students:update', (ctx) => {
  const s = findStudent(ctx.db, ctx.params.id)
  const status = ctx.body?.status as StudentStatus
  const reason = String(ctx.body?.reason ?? '').trim()
  if (!['ACTIVE', 'ON_HOLD', 'DROPPED', 'CANCELLED'].includes(status)) throw badRequest('Use “Mark as completed” to complete a course.')
  if (s.status === status) throw conflict(`Student is already ${humanize(status).toLowerCase()}.`)
  if (s.status === 'COMPLETED') throw conflict('A completed student’s status cannot be changed.')
  if (status !== 'ACTIVE' && !reason) throw badRequest('Validation failed', { reason: ['A reason is required for this status change'] })
  const prev = s.status
  s.status = status
  const app = ctx.db.applications.find((a) => a.id === s.applicationId)
  if (status === 'DROPPED' || status === 'CANCELLED') {
    if (s.batchId) unenrollStudent(ctx, s, reason)
    ctx.db.installments.filter((i) => i.studentId === s.id && i.status === 'PENDING').forEach((i) => (i.status = 'CANCELLED'))
    if (app) advanceApplication(app, 'CANCELLED', actor(ctx), nowIso(), reason)
  }
  audit(ctx, { action: 'STUDENT_STATUS_CHANGED', entityType: 'STUDENT', entityId: s.id, entityLabel: s.fullName, description: `Changed student status`, previousValue: humanize(prev), newValue: humanize(status), reason: reason || undefined, relatedIds: [s.applicationId ?? '', s.leadId ?? ''].filter(Boolean) })
  return presentStudent(ctx.db, s)
})

post('/students/:id/complete', 'students:approve', (ctx) => {
  const s = findStudent(ctx.db, ctx.params.id)
  if (s.status !== 'ACTIVE') throw conflict('Only active students can be marked as completed.')
  const progress = progressOf(ctx.db, s.id).overallPercent
  const min = ctx.db.settings.certificateMinProgress
  const reason = String(ctx.body?.reason ?? '').trim()
  if (progress < min && !reason) throw badRequest(`Progress is ${progress}% (minimum ${min}%). Provide a reason to complete the course early.`, { reason: [`Progress is below ${min}%`] })
  s.status = 'COMPLETED'
  s.completedAt = today()
  const app = ctx.db.applications.find((a) => a.id === s.applicationId)
  if (app) advanceApplication(app, 'TRAINING_COMPLETED', actor(ctx), nowIso(), reason || 'Course completed.')
  audit(ctx, { action: 'COURSE_COMPLETED', entityType: 'STUDENT', entityId: s.id, entityLabel: s.fullName, description: `${s.fullName} completed ${courseOf(ctx.db, s.courseId)?.name}`, previousValue: 'Active', newValue: 'Completed', reason: reason || undefined, relatedIds: [s.applicationId ?? '', s.batchId ?? ''].filter(Boolean) })
  pushNotification(ctx.db, { type: 'COURSE_COMPLETION', title: 'Course completed', message: `${s.fullName} has completed the course. Certificate can be issued.`, link: '/certificates', roles: ['ADMIN', 'SUPER_ADMIN'] })
  return presentStudent(ctx.db, s)
})

/* ───────────── related records ───────────── */

get('/students/:id/payments', 'payments:view', (ctx) => {
  findStudent(ctx.db, ctx.params.id)
  return ctx.db.payments.filter((p) => p.studentId === ctx.params.id).sort((a, b) => b.paymentDate.localeCompare(a.paymentDate) || b.id.localeCompare(a.id)).map((p) => presentPayment(ctx.db, p))
})

get('/students/:id/fee-plan', 'fees:view', (ctx) => {
  findStudent(ctx.db, ctx.params.id)
  const plan = ctx.db.feePlans.find((p) => p.studentId === ctx.params.id)
  return plan ? feePlanView(ctx.db, plan) : null
})

get('/students/:id/attendance', 'attendance:view', (ctx) => {
  assertStudentAccess(ctx, ctx.params.id)
  findStudent(ctx.db, ctx.params.id)
  const sessionById = new Map(ctx.db.sessions.map((x) => [x.id, x]))
  const records = ctx.db.attendance
    .filter((a) => a.studentId === ctx.params.id)
    .map((a) => ({ sessionId: a.sessionId, date: sessionById.get(a.sessionId)?.date ?? '', topic: sessionById.get(a.sessionId)?.topic ?? '', status: a.status }))
    .sort((a, b) => b.date.localeCompare(a.date))
  return { summary: attendanceStatsFor(ctx.db, ctx.params.id), records }
})

get('/students/:id/progress', ['progress:view', 'students:view'], (ctx) => {
  assertStudentAccess(ctx, ctx.params.id)
  findStudent(ctx.db, ctx.params.id)
  return progressOf(ctx.db, ctx.params.id)
})

put('/students/:id/progress', 'progress:update', (ctx) => {
  assertStudentAccess(ctx, ctx.params.id)
  const s = findStudent(ctx.db, ctx.params.id)
  const { moduleId, percent } = ctx.body ?? {}
  const mod = ctx.db.modules.find((m) => m.id === moduleId && m.courseId === s.courseId)
  if (!mod) throw badRequest('Module does not belong to the student’s course')
  if (typeof percent !== 'number' || percent < 0 || percent > 100) throw badRequest('Validation failed', { percent: ['Progress must be between 0 and 100'] })
  const row = ctx.db.progress.find((p) => p.studentId === s.id && p.moduleId === moduleId)
  const prev = row?.percent ?? 0
  if (row) row.percent = percent
  else ctx.db.progress.push({ studentId: s.id, moduleId, percent })
  if (prev !== percent) audit(ctx, { action: 'PROGRESS_UPDATED', entityType: 'STUDENT', entityId: s.id, entityLabel: s.fullName, description: `${mod.name} progress updated for ${s.fullName}`, previousValue: `${prev}%`, newValue: `${percent}%`, relatedIds: [s.batchId ?? ''].filter(Boolean) })
  return progressOf(ctx.db, s.id)
})

get('/students/:id/assignments', 'assignments:view', (ctx) => {
  assertStudentAccess(ctx, ctx.params.id)
  findStudent(ctx.db, ctx.params.id)
  return ctx.db.submissions
    .filter((x) => x.studentId === ctx.params.id)
    .map((x) => {
      const a = ctx.db.assignments.find((y) => y.id === x.assignmentId)
      return { ...x, assignmentTitle: a?.title, maxMarks: a?.maxMarks, dueDate: a?.dueDate }
    })
    .sort((a, b) => (b.dueDate ?? '').localeCompare(a.dueDate ?? ''))
})

get('/students/:id/activity', 'students:view', (ctx) => {
  assertStudentAccess(ctx, ctx.params.id)
  return activityFor(ctx, [ctx.params.id, findStudent(ctx.db, ctx.params.id).leadId, findStudent(ctx.db, ctx.params.id).applicationId])
})

get('/students/:id/batch-history', 'students:view', (ctx) => {
  assertStudentAccess(ctx, ctx.params.id)
  return ctx.db.batchStudents
    .filter((x) => x.studentId === ctx.params.id)
    .sort((a, b) => b.joinedAt.localeCompare(a.joinedAt))
    .map((x) => ({ ...x, batchName: batchOf(ctx.db, x.batchId)?.name, fromBatchName: batchOf(ctx.db, x.fromBatchId)?.name }))
})

get('/students/:id/application', ['students:view', 'applications:view'], (ctx) => {
  const s = findStudent(ctx.db, ctx.params.id)
  const app = ctx.db.applications.find((a) => a.id === s.applicationId)
  return app ? presentApplication(ctx.db, app) : null
})

/* ───────────── documents ───────────── */

get('/documents', ['students:view', 'applications:view'], (ctx) => {
  const { ownerId, ownerType } = ctx.query
  return ctx.db.documents
    .filter((d) => !d.deletedAt && (!ownerId || d.ownerId === ownerId) && (!ownerType || d.ownerType === ownerType))
    .map((d) => ({ ...d, uploadedByName: ctx.db.employees.find((e) => e.id === d.uploadedById)?.name }))
    .sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt))
})

post('/documents', ['students:update', 'applications:update'], (ctx) => {
  const b = ctx.body as Partial<StoredDocument>
  requireFields(b as Record<string, unknown>, ['ownerType', 'ownerId', 'category', 'fileName'])
  const doc: StoredDocument = {
    id: nextId(ctx.db, 'DOC-', 4),
    ownerType: b.ownerType!,
    ownerId: b.ownerId!,
    category: b.category!,
    fileName: b.fileName!,
    sizeBytes: b.sizeBytes ?? 0,
    mimeType: b.mimeType ?? 'application/octet-stream',
    uploadedById: ctx.user.id,
    uploadedAt: nowIso(),
    storageKey: `${b.ownerType!.toLowerCase()}s/${b.ownerId}/${Date.now()}-${b.fileName}`,
  }
  ctx.db.documents.push(doc)
  const owner = ctx.db.students.find((s) => s.id === doc.ownerId)
  audit(ctx, { action: 'DOCUMENT_UPLOADED', entityType: 'DOCUMENT', entityId: doc.id, entityLabel: doc.fileName, description: `Document “${doc.fileName}” uploaded${owner ? ` for ${owner.fullName}` : ''}`, newValue: humanize(doc.category), relatedIds: [doc.ownerId] })
  return doc
})

del('/documents/:id', ['students:update', 'applications:update'], (ctx) => {
  const doc = ctx.db.documents.find((d) => d.id === ctx.params.id && !d.deletedAt)
  if (!doc) throw notFound('Document')
  doc.deletedAt = nowIso()
  return { ok: true }
})
