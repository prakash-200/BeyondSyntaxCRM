import type { Batch, BatchProgress, BatchStudent, Course, CourseModule, Trainer } from '@/types'
import { today, nowIso } from '@/utils/clock'
import { nextId, type Db } from '../../db'
import { activityFor } from './activity'
import { audit, isTrainer } from './helpers'
import { enrollStudent, transferStudent, unenrollStudent } from './batchOps'
import { findStudent } from './students'
import { badRequest, conflict, del, get, listResponse, notFound, post, put, requireFields, type Ctx } from '../router'
import { activeBatchStudents, attendanceStatsFor, batchOf, courseOf, presentBatch, presentCourse, progressOf } from '../present'

/* ───────────── courses ───────────── */

function findCourse(db: Db, id: string): Course {
  const c = db.courses.find((x) => x.id === id && !x.deletedAt)
  if (!c) throw notFound('Course')
  return c
}

get('/courses', 'courses:view', (ctx) => {
  const q = ctx.query
  let rows = ctx.db.courses.filter((c) => !c.deletedAt)
  if (q.category) rows = rows.filter((c) => c.category === q.category)
  if (q.mode) rows = rows.filter((c) => c.mode === q.mode)
  if (q.status) rows = rows.filter((c) => c.status === q.status)
  return listResponse(rows.map((c) => presentCourse(ctx.db, c)), q, {
    searchText: (c) => `${c.id} ${c.code} ${c.name} ${c.description}`,
    defaultSort: 'name',
    sorters: { name: (c) => c.name.toLowerCase(), fee: (c) => c.totalFee, duration: (c) => c.durationMonths, students: (c) => c.studentCount ?? 0, category: (c) => c.category },
  })
})

get('/courses/:id', 'courses:view', (ctx) => presentCourse(ctx.db, findCourse(ctx.db, ctx.params.id)))

function validateCourse(ctx: Ctx, b: Partial<Course>, selfId?: string) {
  requireFields(b as Record<string, unknown>, ['name', 'category', 'mode'])
  const errors: Record<string, string[]> = {}
  if (!(Number(b.totalFee) > 0)) errors.totalFee = ['Fee must be greater than 0']
  if (!(Number(b.durationMonths) > 0)) errors.durationMonths = ['Duration must be at least 1 month']
  if (ctx.db.courses.some((c) => !c.deletedAt && c.id !== selfId && c.name.toLowerCase() === String(b.name).trim().toLowerCase())) errors.name = ['A course with this name already exists']
  if (Object.keys(errors).length) throw badRequest('Validation failed', errors)
}

post('/courses', 'courses:create', (ctx) => {
  const b = ctx.body as Partial<Course>
  validateCourse(ctx, b)
  const code = (b.code || String(b.name).split(/\s+/)[0]).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8)
  const course: Course = {
    id: nextId(ctx.db, 'CRS-', 3),
    code,
    name: String(b.name).trim(),
    category: b.category!,
    description: b.description ?? '',
    durationMonths: Number(b.durationMonths),
    mode: b.mode!,
    totalFee: Number(b.totalFee),
    discountRules: b.discountRules ?? [],
    status: b.status ?? 'ACTIVE',
  }
  ctx.db.courses.push(course)
  audit(ctx, { action: 'COURSE_CREATED', entityType: 'COURSE', entityId: course.id, entityLabel: course.name, description: `Course ${course.name} created`, newValue: `₹${course.totalFee.toLocaleString('en-IN')}` })
  return presentCourse(ctx.db, course)
})

put('/courses/:id', 'courses:update', (ctx) => {
  const course = findCourse(ctx.db, ctx.params.id)
  const b = { ...course, ...(ctx.body as Partial<Course>) }
  validateCourse(ctx, b, course.id)
  const feeChanged = Number(b.totalFee) !== course.totalFee
  const reason = String(ctx.body?.reason ?? '').trim()
  if (feeChanged && !reason) throw badRequest('Validation failed', { reason: ['A reason is required when changing the course fee'] })
  const prev = `${course.name} · ₹${course.totalFee.toLocaleString('en-IN')} · ${course.durationMonths}m · ${course.status}`
  Object.assign(course, {
    name: String(b.name).trim(),
    category: b.category,
    description: b.description ?? '',
    durationMonths: Number(b.durationMonths),
    mode: b.mode,
    totalFee: Number(b.totalFee),
    discountRules: b.discountRules ?? course.discountRules,
    status: b.status ?? course.status,
  })
  audit(ctx, { action: 'COURSE_UPDATED', entityType: 'COURSE', entityId: course.id, entityLabel: course.name, description: feeChanged ? `Course fee changed for ${course.name}` : `Course ${course.name} updated`, previousValue: prev, newValue: `${course.name} · ₹${course.totalFee.toLocaleString('en-IN')} · ${course.durationMonths}m · ${course.status}`, reason: reason || undefined })
  return presentCourse(ctx.db, course)
})

del('/courses/:id', 'courses:delete', (ctx) => {
  const course = findCourse(ctx.db, ctx.params.id)
  const inUse = ctx.db.students.some((s) => !s.deletedAt && s.courseId === course.id && s.status === 'ACTIVE') || ctx.db.batches.some((b) => b.courseId === course.id && (b.status === 'ACTIVE' || b.status === 'UPCOMING'))
  if (inUse) throw conflict('This course has active students or batches. Deactivate it instead of deleting.')
  course.deletedAt = nowIso()
  course.status = 'INACTIVE'
  audit(ctx, { action: 'COURSE_UPDATED', entityType: 'COURSE', entityId: course.id, entityLabel: course.name, description: `Course ${course.name} archived (soft delete)` })
  return { ok: true }
})

/* ───────────── modules ───────────── */

const modulesOf = (db: Db, courseId: string) => db.modules.filter((m) => m.courseId === courseId && m.status === 'ACTIVE').sort((a, b) => a.sequence - b.sequence)
const resequence = (db: Db, courseId: string) => modulesOf(db, courseId).forEach((m, i) => (m.sequence = i + 1))

get('/courses/:id/modules', 'courses:view', (ctx) => {
  findCourse(ctx.db, ctx.params.id)
  return modulesOf(ctx.db, ctx.params.id)
})

post('/courses/:id/modules', 'courses:update', (ctx) => {
  const course = findCourse(ctx.db, ctx.params.id)
  const b = ctx.body as Partial<CourseModule>
  requireFields(b as Record<string, unknown>, ['name'])
  const mod: CourseModule = { id: nextId(ctx.db, 'MOD-', 3), courseId: course.id, name: String(b.name).trim(), description: b.description ?? '', sequence: modulesOf(ctx.db, course.id).length + 1, durationWeeks: Number(b.durationWeeks) || 2, status: 'ACTIVE' }
  ctx.db.modules.push(mod)
  audit(ctx, { action: 'COURSE_UPDATED', entityType: 'MODULE', entityId: mod.id, entityLabel: mod.name, description: `Module “${mod.name}” added to ${course.name}`, relatedIds: [course.id] })
  return mod
})

put('/modules/:id', 'courses:update', (ctx) => {
  const mod = ctx.db.modules.find((m) => m.id === ctx.params.id)
  if (!mod) throw notFound('Module')
  const b = ctx.body as Partial<CourseModule>
  Object.assign(mod, { name: b.name?.trim() || mod.name, description: b.description ?? mod.description, durationWeeks: Number(b.durationWeeks) || mod.durationWeeks })
  return mod
})

del('/modules/:id', 'courses:update', (ctx) => {
  const mod = ctx.db.modules.find((m) => m.id === ctx.params.id && m.status === 'ACTIVE')
  if (!mod) throw notFound('Module')
  mod.status = 'INACTIVE'
  resequence(ctx.db, mod.courseId)
  audit(ctx, { action: 'COURSE_UPDATED', entityType: 'MODULE', entityId: mod.id, entityLabel: mod.name, description: `Module “${mod.name}” removed from ${courseOf(ctx.db, mod.courseId)?.name}`, relatedIds: [mod.courseId] })
  return { ok: true }
})

put('/courses/:id/modules/reorder', 'courses:update', (ctx) => {
  const course = findCourse(ctx.db, ctx.params.id)
  const ids = (ctx.body?.orderedIds ?? []) as string[]
  const current = modulesOf(ctx.db, course.id)
  if (ids.length !== current.length || !current.every((m) => ids.includes(m.id))) throw badRequest('The module list is out of date. Refresh and try again.')
  const before = current.map((m) => m.name).join(' → ')
  ids.forEach((id, i) => (ctx.db.modules.find((m) => m.id === id)!.sequence = i + 1))
  const after = modulesOf(ctx.db, course.id).map((m) => m.name).join(' → ')
  audit(ctx, { action: 'MODULES_REORDERED', entityType: 'COURSE', entityId: course.id, entityLabel: course.name, description: `Modules reordered for ${course.name}`, previousValue: before, newValue: after })
  return modulesOf(ctx.db, course.id)
})

/* ───────────── batches ───────────── */

function findBatch(ctx: Ctx, id: string): Batch {
  const b = batchOf(ctx.db, id)
  if (!b || (isTrainer(ctx) && b.trainerId !== ctx.user.id)) throw notFound('Batch')
  return b
}

get('/batches', 'batches:view', (ctx) => {
  const q = ctx.query
  let rows = ctx.db.batches
  if (isTrainer(ctx)) rows = rows.filter((b) => b.trainerId === ctx.user.id)
  if (q.status) rows = rows.filter((b) => b.status === q.status)
  if (q.courseId) rows = rows.filter((b) => b.courseId === q.courseId)
  if (q.trainerId) rows = rows.filter((b) => b.trainerId === q.trainerId)
  if (q.mode) rows = rows.filter((b) => b.mode === q.mode)
  return listResponse(rows.map((b) => presentBatch(ctx.db, b)), q, {
    searchText: (b) => `${b.id} ${b.name} ${b.courseName} ${b.trainerName} ${b.location}`,
    dateOf: (b) => b.startDate,
    defaultSort: 'startDate',
    defaultOrder: 'desc',
    sorters: { startDate: (b) => b.startDate, name: (b) => b.name, status: (b) => b.status, students: (b) => b.currentStudentCount, course: (b) => b.courseName ?? '', trainer: (b) => b.trainerName ?? '' },
  })
})

get('/batches/:id', 'batches:view', (ctx) => presentBatch(ctx.db, findBatch(ctx, ctx.params.id)))

function validateBatch(ctx: Ctx, b: Partial<Batch>, selfId?: string) {
  requireFields(b as Record<string, unknown>, ['name', 'courseId', 'trainerId', 'startDate', 'endDate', 'startTime', 'endTime', 'capacity', 'mode'])
  const errors: Record<string, string[]> = {}
  if (b.endDate! <= b.startDate!) errors.endDate = ['End date must be after the start date']
  if (b.endTime! <= b.startTime!) errors.endTime = ['End time must be after the start time']
  if (!b.days?.length) errors.days = ['Select at least one class day']
  if (!(Number(b.capacity) >= 1)) errors.capacity = ['Capacity must be at least 1']
  const trainer = ctx.db.employees.find((e) => e.id === b.trainerId)
  if (!trainer || trainer.role !== 'TRAINER') errors.trainerId = ['Select a valid trainer']
  else if (trainer.status !== 'ACTIVE') errors.trainerId = ['This trainer is inactive']
  if (!courseOf(ctx.db, b.courseId)) errors.courseId = ['Select a valid course']
  if (ctx.db.batches.some((x) => x.id !== selfId && x.name.toLowerCase() === String(b.name).trim().toLowerCase())) errors.name = ['A batch with this name already exists']
  if (Object.keys(errors).length) throw badRequest('Validation failed', errors)
}

post('/batches', 'batches:create', (ctx) => {
  const b = ctx.body as Partial<Batch>
  validateBatch(ctx, b)
  const batch: Batch = {
    id: nextId(ctx.db, 'BAT-', 3),
    name: String(b.name).trim().toUpperCase(),
    courseId: b.courseId!,
    trainerId: b.trainerId!,
    startDate: b.startDate!,
    endDate: b.endDate!,
    startTime: b.startTime!,
    endTime: b.endTime!,
    days: b.days!,
    capacity: Number(b.capacity),
    currentStudentCount: 0,
    mode: b.mode!,
    location: b.location ?? '',
    status: b.startDate! > today() ? 'UPCOMING' : 'ACTIVE',
  }
  ctx.db.batches.push(batch)
  audit(ctx, { action: 'BATCH_CREATED', entityType: 'BATCH', entityId: batch.id, entityLabel: batch.name, description: `Batch ${batch.name} created`, newValue: `${batch.startDate} → ${batch.endDate}` })
  return presentBatch(ctx.db, batch)
})

put('/batches/:id', 'batches:update', (ctx) => {
  const batch = findBatch(ctx, ctx.params.id)
  const b = { ...batch, ...(ctx.body as Partial<Batch>) }
  validateBatch(ctx, b, batch.id)
  const count = activeBatchStudents(ctx.db, batch.id).length
  if (Number(b.capacity) < count) throw conflict(`Capacity cannot be lower than the ${count} students currently enrolled.`)
  if (b.status === 'CANCELLED' && batch.status !== 'CANCELLED' && count > 0) throw conflict(`Transfer or remove the ${count} enrolled students before cancelling this batch.`)
  const summary = (x: Batch) => `${x.name} · ${x.status} · ${x.startDate}→${x.endDate} · ${x.startTime}-${x.endTime} · cap ${x.capacity} · ${x.trainerId}`
  const prev = summary(batch)
  Object.assign(batch, {
    name: String(b.name).trim().toUpperCase(),
    courseId: b.courseId,
    trainerId: b.trainerId,
    startDate: b.startDate,
    endDate: b.endDate,
    startTime: b.startTime,
    endTime: b.endTime,
    days: b.days,
    capacity: Number(b.capacity),
    mode: b.mode,
    location: b.location ?? '',
    status: b.status,
  })
  audit(ctx, { action: 'BATCH_UPDATED', entityType: 'BATCH', entityId: batch.id, entityLabel: batch.name, description: `Batch ${batch.name} updated`, previousValue: prev, newValue: summary(batch) })
  return presentBatch(ctx.db, batch)
})

get('/batches/:id/students', 'batches:view', (ctx) => {
  const batch = findBatch(ctx, ctx.params.id)
  const rows = ctx.db.batchStudents.filter((x) => x.batchId === batch.id && (ctx.query.includeHistory === 'true' || x.status === 'ACTIVE'))
  return rows
    .map((x): BatchStudent => {
      const s = ctx.db.students.find((y) => y.id === x.studentId)
      return { ...x, studentName: s?.fullName, studentPhone: s?.phone, studentStatus: s?.status, attendancePercent: attendanceStatsFor(ctx.db, x.studentId).percent, progressPercent: progressOf(ctx.db, x.studentId).overallPercent }
    })
    .sort((a, b) => (a.studentName ?? '').localeCompare(b.studentName ?? ''))
})

get('/batches/:id/eligible-students', 'batches:update', (ctx) => {
  const batch = findBatch(ctx, ctx.params.id)
  const inBatch = new Set(ctx.db.batchStudents.filter((x) => x.status === 'ACTIVE').map((x) => x.studentId))
  return ctx.db.students
    .filter((s) => !s.deletedAt && s.status === 'ACTIVE' && s.courseId === batch.courseId && !inBatch.has(s.id))
    .map((s) => ({ id: s.id, fullName: s.fullName, phone: s.phone }))
})

post('/batches/:id/students', 'batches:update', (ctx) => {
  const batch = findBatch(ctx, ctx.params.id)
  const student = findStudent(ctx.db, String(ctx.body?.studentId ?? ''))
  enrollStudent(ctx, student, batch)
  return presentBatch(ctx.db, batch)
})

post('/batches/:id/students/:studentId/remove', 'batches:update', (ctx) => {
  const batch = findBatch(ctx, ctx.params.id)
  const student = findStudent(ctx.db, ctx.params.studentId)
  unenrollStudent(ctx, student, String(ctx.body?.reason ?? ''))
  return presentBatch(ctx.db, batch)
})

post('/batches/:id/transfer', 'batches:update', (ctx) => {
  const from = findBatch(ctx, ctx.params.id)
  const student = findStudent(ctx.db, String(ctx.body?.studentId ?? ''))
  const to = batchOf(ctx.db, ctx.body?.toBatchId)
  if (!to) throw badRequest('Validation failed', { toBatchId: ['Select the destination batch'] })
  transferStudent(ctx, student, to, String(ctx.body?.reason ?? ''))
  return presentBatch(ctx.db, from)
})

get('/batches/:id/sessions', ['attendance:view', 'batches:view'], (ctx) => {
  const batch = findBatch(ctx, ctx.params.id)
  return ctx.db.sessions
    .filter((s) => s.batchId === batch.id)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, Number(ctx.query.limit) || 60)
    .map((s) => {
      const recs = ctx.db.attendance.filter((a) => a.sessionId === s.id)
      return { ...s, presentCount: recs.filter((r) => r.status === 'PRESENT' || r.status === 'LATE').length, totalCount: recs.length, marked: recs.length > 0 }
    })
})

get('/batches/:id/progress', ['progress:view', 'batches:view'], (ctx): BatchProgress => {
  const batch = findBatch(ctx, ctx.params.id)
  const mods = modulesOf(ctx.db, batch.courseId)
  return {
    modules: mods.map((m) => ({ id: m.id, name: m.name, sequence: m.sequence })),
    rows: activeBatchStudents(ctx.db, batch.id).map((x) => {
      const p = progressOf(ctx.db, x.studentId)
      return { studentId: x.studentId, studentName: ctx.db.students.find((s) => s.id === x.studentId)?.fullName ?? '', overallPercent: p.overallPercent, modules: Object.fromEntries(p.modules.map((m) => [m.moduleId, m.percent])) }
    }),
  }
})

get('/batches/:id/activity', 'batches:view', (ctx) => {
  findBatch(ctx, ctx.params.id)
  return activityFor(ctx, ctx.params.id)
})

/* ───────────── trainers ───────────── */

function trainerView(ctx: Ctx, e: Db['employees'][number]): Trainer {
  const mine = ctx.db.batches.filter((b) => b.trainerId === e.id)
  const students = new Set(ctx.db.batchStudents.filter((x) => x.status === 'ACTIVE' && mine.some((b) => b.id === x.batchId && b.status !== 'COMPLETED')).map((x) => x.studentId))
  return {
    ...e,
    activeBatches: mine.filter((b) => b.status === 'ACTIVE' || b.status === 'UPCOMING').length,
    totalBatches: mine.length,
    studentCount: students.size,
    courseNames: (e.courseIds ?? []).map((id) => courseOf(ctx.db, id)?.name ?? '').filter(Boolean),
  }
}

get('/trainers', 'trainers:view', (ctx) => {
  const rows = ctx.db.employees.filter((e) => e.role === 'TRAINER').map((e) => trainerView(ctx, e))
  return listResponse(rows, ctx.query, {
    searchText: (t) => `${t.id} ${t.name} ${t.email} ${t.specialization}`,
    defaultSort: 'name',
    sorters: { name: (t) => t.name, students: (t) => t.studentCount, batches: (t) => t.activeBatches },
  })
})

get('/trainers/:id', 'trainers:view', (ctx) => {
  const e = ctx.db.employees.find((x) => x.id === ctx.params.id && x.role === 'TRAINER')
  if (!e) throw notFound('Trainer')
  return trainerView(ctx, e)
})

