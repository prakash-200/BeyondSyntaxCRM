import { ROLES, type Role } from '@/constants/enums'
import { ROLE_LABELS, type Permission } from '@/constants/permissions'
import { humanize } from '@/constants/labels'
import type { Certificate, CertificateVerification, EligibleStudent, Employee, RoleDefinition } from '@/types'
import { today, nowIso } from '@/utils/clock'
import { advanceApplication, nextId, pushNotification } from '../../db'
import { activityFor } from './activity'
import { actor, audit } from './helpers'
import { badRequest, conflict, get, HttpError, listResponse, notFound, post, put, requireFields } from '../router'
import { attendanceStatsFor, batchOf, courseOf, employeeName, progressOf, studentOf } from '../present'

/* ───────────── employees ───────────── */

get('/employees', 'employees:view', (ctx) => {
  const q = ctx.query
  let rows = ctx.db.employees
  if (q.role) rows = rows.filter((e) => e.role === q.role)
  if (q.status) rows = rows.filter((e) => e.status === q.status)
  if (q.department) rows = rows.filter((e) => e.department === q.department)
  return listResponse(rows, q, {
    searchText: (e) => `${e.id} ${e.name} ${e.email} ${e.phone} ${e.department}`,
    dateOf: (e) => e.joiningDate,
    defaultSort: 'name',
    sorters: { name: (e) => e.name.toLowerCase(), role: (e) => e.role, department: (e) => e.department, joiningDate: (e) => e.joiningDate, status: (e) => e.status },
  })
})

get('/employees/:id', 'employees:view', (ctx) => {
  const e = ctx.db.employees.find((x) => x.id === ctx.params.id)
  if (!e) throw notFound('Employee')
  return e
})

function validateEmployee(ctx: Parameters<Parameters<typeof post>[2]>[0], b: Partial<Employee>, selfId?: string) {
  requireFields(b as Record<string, unknown>, ['name', 'email', 'phone', 'role', 'department', 'joiningDate'])
  if (!ROLES.includes(b.role as Role)) throw badRequest('Validation failed', { role: ['Select a valid role'] })
  if (b.role === 'SUPER_ADMIN' && ctx.user.role !== 'SUPER_ADMIN') throw new HttpError(403, 'Only a Super Admin can create or assign the Super Admin role.')
  const dup = ctx.db.employees.find((e) => e.id !== selfId && e.email.toLowerCase() === String(b.email).toLowerCase())
  if (dup) throw conflict(`An employee with this email already exists (${dup.name}).`)
  if (String(b.phone).replace(/\D/g, '').slice(-10).length !== 10) throw badRequest('Validation failed', { phone: ['Enter a valid 10-digit phone number'] })
}

post('/employees', 'employees:create', (ctx) => {
  const b = ctx.body as Partial<Employee>
  validateEmployee(ctx, b)
  const emp: Employee = {
    id: nextId(ctx.db, 'EMP-', 3),
    name: String(b.name).trim(),
    email: String(b.email).trim().toLowerCase(),
    phone: String(b.phone).replace(/\D/g, '').slice(-10),
    role: b.role!,
    department: b.department!,
    joiningDate: b.joiningDate!,
    status: 'ACTIVE',
    specialization: b.specialization,
    courseIds: b.courseIds,
  }
  ctx.db.employees.push(emp)
  ctx.db.credentials[emp.email] = 'Password@123'
  audit(ctx, { action: 'EMPLOYEE_CREATED', entityType: 'EMPLOYEE', entityId: emp.id, entityLabel: emp.name, description: `Employee ${emp.name} created as ${ROLE_LABELS[emp.role]}`, newValue: ROLE_LABELS[emp.role] })
  return emp
})

put('/employees/:id', 'employees:update', (ctx) => {
  const emp = ctx.db.employees.find((e) => e.id === ctx.params.id)
  if (!emp) throw notFound('Employee')
  const b = { ...emp, ...(ctx.body as Partial<Employee>) }
  validateEmployee(ctx, b, emp.id)
  if (emp.role === 'SUPER_ADMIN' && ctx.user.role !== 'SUPER_ADMIN') throw new HttpError(403, 'Only a Super Admin can modify a Super Admin.')
  const prev = `${emp.name} · ${ROLE_LABELS[emp.role]} · ${emp.department} · ${emp.email}`
  const prevEmail = emp.email
  Object.assign(emp, { name: String(b.name).trim(), email: String(b.email).trim().toLowerCase(), phone: String(b.phone).replace(/\D/g, '').slice(-10), role: b.role, department: b.department, joiningDate: b.joiningDate, specialization: b.specialization, courseIds: b.courseIds })
  if (prevEmail !== emp.email) {
    ctx.db.credentials[emp.email] = ctx.db.credentials[prevEmail] ?? 'Password@123'
    delete ctx.db.credentials[prevEmail]
  }
  audit(ctx, { action: 'EMPLOYEE_UPDATED', entityType: 'EMPLOYEE', entityId: emp.id, entityLabel: emp.name, description: `Employee ${emp.name} updated`, previousValue: prev, newValue: `${emp.name} · ${ROLE_LABELS[emp.role]} · ${emp.department} · ${emp.email}` })
  return emp
})

post('/employees/:id/status', 'employees:update', (ctx) => {
  const emp = ctx.db.employees.find((e) => e.id === ctx.params.id)
  if (!emp) throw notFound('Employee')
  const status = ctx.body?.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE'
  if (emp.id === ctx.user.id && status === 'INACTIVE') throw conflict('You cannot deactivate your own account.')
  if (emp.role === 'SUPER_ADMIN' && ctx.user.role !== 'SUPER_ADMIN') throw new HttpError(403, 'Only a Super Admin can deactivate a Super Admin.')
  if (emp.status === status) throw conflict(`Employee is already ${status.toLowerCase()}.`)
  if (status === 'INACTIVE' && emp.role === 'TRAINER') {
    const live = ctx.db.batches.filter((b) => b.trainerId === emp.id && (b.status === 'ACTIVE' || b.status === 'UPCOMING'))
    if (live.length) throw conflict(`${emp.name} still trains ${live.length} active/upcoming batch(es): ${live.map((b) => b.name).join(', ')}. Reassign them first.`)
  }
  const prev = emp.status
  emp.status = status // history (leads, payments, audit) is retained — nothing is deleted
  audit(ctx, { action: 'EMPLOYEE_STATUS_CHANGED', entityType: 'EMPLOYEE', entityId: emp.id, entityLabel: emp.name, description: `${emp.name} ${status === 'ACTIVE' ? 'activated' : 'deactivated'}`, previousValue: humanize(prev), newValue: humanize(status), reason: ctx.body?.reason })
  return emp
})

/* ───────────── roles & permissions ───────────── */

get('/roles', 'roles:view', (ctx): RoleDefinition[] =>
  ROLES.map((role) => ({ role, label: ROLE_LABELS[role], permissions: ctx.db.rolePermissions[role], employeeCount: ctx.db.employees.filter((e) => e.role === role && e.status === 'ACTIVE').length })),
)

put('/roles/:role', 'roles:update', (ctx) => {
  const role = ctx.params.role as Role
  if (!ROLES.includes(role)) throw notFound('Role')
  if (role === 'SUPER_ADMIN') throw conflict('Super Admin permissions cannot be modified.')
  const next = (ctx.body?.permissions ?? []) as Permission[]
  const prev = ctx.db.rolePermissions[role]
  const added = next.filter((p) => !prev.includes(p))
  const removed = prev.filter((p) => !next.includes(p))
  if (!added.length && !removed.length) return { role, permissions: prev }
  if (!next.includes('dashboard:view')) throw badRequest('Every role must keep access to the dashboard.')
  ctx.db.rolePermissions[role] = next
  audit(ctx, { action: 'PERMISSIONS_CHANGED', entityType: 'ROLE', entityId: role, entityLabel: ROLE_LABELS[role], description: `Permissions changed for ${ROLE_LABELS[role]}`, previousValue: removed.length ? `Removed: ${removed.join(', ')}` : null, newValue: added.length ? `Added: ${added.join(', ')}` : null })
  return { role, permissions: next }
})

/* ───────────── audit logs ───────────── */

get('/audit-logs', 'audit:view', (ctx) => {
  const q = ctx.query
  let rows = ctx.db.auditLogs
  if (q.userId) rows = rows.filter((l) => l.userId === q.userId)
  if (q.action) rows = rows.filter((l) => l.action === q.action)
  if (q.entityType) rows = rows.filter((l) => l.entityType === q.entityType)
  if (q.entityId) rows = rows.filter((l) => l.entityId === q.entityId || l.relatedIds.includes(q.entityId))
  return listResponse(rows, q, {
    searchText: (l) => `${l.id} ${l.userName} ${l.entityId} ${l.entityLabel} ${l.description} ${l.previousValue} ${l.newValue}`,
    dateOf: (l) => l.timestamp,
    defaultSort: 'timestamp',
    defaultOrder: 'desc',
    sorters: { timestamp: (l) => l.timestamp, user: (l) => l.userName, action: (l) => l.action, entityType: (l) => l.entityType },
  })
})

get('/audit-logs/recent', ['audit:view', 'dashboard:view'], (ctx) => activityFor(ctx, ctx.query.entityId ?? ctx.user.id, 20))

/* ───────────── certificates ───────────── */

function certView(ctx: Parameters<Parameters<typeof get>[2]>[0], c: Certificate): Certificate {
  return { ...c, studentName: studentOf(ctx.db, c.studentId)?.fullName, courseName: courseOf(ctx.db, c.courseId)?.name, batchName: batchOf(ctx.db, c.batchId)?.name, issuedByName: employeeName(ctx.db, c.issuedById) }
}

get('/certificates/eligible', 'certificates:approve', (ctx): EligibleStudent[] =>
  ctx.db.students
    .filter((s) => !s.deletedAt && !s.certificateId && (s.status === 'COMPLETED' || s.status === 'ACTIVE'))
    .map((s) => ({
      studentId: s.id,
      studentName: s.fullName,
      courseName: courseOf(ctx.db, s.courseId)?.name ?? '',
      batchName: batchOf(ctx.db, s.batchId)?.name ?? ctx.db.batchStudents.filter((x) => x.studentId === s.id).map((x) => batchOf(ctx.db, x.batchId)?.name)[0],
      progressPercent: progressOf(ctx.db, s.id).overallPercent,
      attendancePercent: attendanceStatsFor(ctx.db, s.id).percent,
      completed: s.status === 'COMPLETED',
    }))
    .filter((s) => s.completed || s.progressPercent >= 90)
    .sort((a, b) => Number(b.completed) - Number(a.completed) || b.progressPercent - a.progressPercent),
)

get('/certificates', 'certificates:view', (ctx) => {
  const q = ctx.query
  let rows = ctx.db.certificates.map((c) => certView(ctx, c))
  if (q.courseId) rows = rows.filter((c) => c.courseId === q.courseId)
  if (q.batchId) rows = rows.filter((c) => c.batchId === q.batchId)
  return listResponse(rows, q, {
    searchText: (c) => `${c.id} ${c.studentName} ${c.courseName} ${c.batchName}`,
    dateOf: (c) => c.issuedDate,
    defaultSort: 'issuedDate',
    defaultOrder: 'desc',
    sorters: { issuedDate: (c) => c.issuedDate + c.id, student: (c) => (c.studentName ?? '').toLowerCase(), course: (c) => c.courseName ?? '' },
  })
})

get('/certificates/verify/:id', 'public', (ctx): CertificateVerification => {
  const c = ctx.db.certificates.find((x) => x.id.toLowerCase() === ctx.params.id.toLowerCase())
  return c ? { valid: true, certificate: certView(ctx, c) } : { valid: false }
})

get('/certificates/:id', 'certificates:view', (ctx) => {
  const c = ctx.db.certificates.find((x) => x.id === ctx.params.id)
  if (!c) throw notFound('Certificate')
  return certView(ctx, c)
})

post('/certificates', 'certificates:approve', (ctx) => {
  const student = studentOf(ctx.db, String(ctx.body?.studentId ?? ''))
  if (!student || student.deletedAt) throw notFound('Student')
  if (student.certificateId) throw conflict(`A certificate (${student.certificateId}) has already been issued to this student.`)
  const progress = progressOf(ctx.db, student.id).overallPercent
  const min = ctx.db.settings.certificateMinProgress
  const override = String(ctx.body?.overrideReason ?? '').trim()
  if (student.status !== 'COMPLETED' && !override) throw conflict('The course must be marked as completed before a certificate can be issued.')
  if (progress < min && !override) throw conflict(`Progress is ${progress}% (minimum ${min}%). Provide an override reason to issue the certificate anyway.`)
  const course = courseOf(ctx.db, student.courseId)!
  const membership = ctx.db.batchStudents.filter((x) => x.studentId === student.id).sort((a, b) => b.joinedAt.localeCompare(a.joinedAt))[0]
  const batch = batchOf(ctx.db, membership?.batchId)
  const completion = student.completedAt ?? today()
  const cert: Certificate = {
    id: `CERT-${course.code}-${completion.slice(0, 4)}-${student.id.slice(-5)}`,
    studentId: student.id,
    courseId: course.id,
    batchId: batch?.id ?? null,
    startDate: batch?.startDate ?? student.admissionDate,
    completionDate: completion,
    issuedDate: today(),
    issuedById: ctx.user.id,
  }
  ctx.db.certificates.push(cert)
  student.certificateId = cert.id
  const app = ctx.db.applications.find((a) => a.id === student.applicationId)
  if (app) {
    app.certificateId = cert.id
    advanceApplication(app, 'TRAINING_COMPLETED', actor(ctx), nowIso(), 'Course completed.')
  }
  audit(ctx, { action: 'CERTIFICATE_ISSUED', entityType: 'CERTIFICATE', entityId: cert.id, entityLabel: student.fullName, description: `Certificate ${cert.id} issued to ${student.fullName}`, newValue: cert.id, reason: override || undefined, relatedIds: [student.id, student.applicationId ?? ''].filter(Boolean) })
  pushNotification(ctx.db, { type: 'CERTIFICATE_READY', title: 'Certificate issued', message: `${student.fullName} — ${cert.id}`, link: `/certificates/${cert.id}`, roles: ['ADMIN', 'SUPER_ADMIN'] })
  return certView(ctx, cert)
})
