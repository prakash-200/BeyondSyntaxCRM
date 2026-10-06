import { APPLICATION_STATUSES, type ApplicationStatus } from '@/constants/enums'
import { humanize } from '@/constants/labels'
import type { Application, Lead, Student } from '@/types'
import { today, nowIso } from '@/utils/clock'
import { advanceApplication, nextId, pushNotification, type Db } from '../../db'
import { activityFor } from './activity'
import { actor, audit } from './helpers'
import { badRequest, conflict, get, listResponse, notFound, post, put, requireFields, type Ctx } from '../router'
import { courseOf, presentApplication, studentOf } from '../present'

function findApp(db: Db, id: string): Application {
  const a = db.applications.find((x) => x.id === id)
  if (!a) throw notFound('Application')
  return a
}

/** Create (or reuse) the application belonging to a lead. */
export function createApplicationFromLead(ctx: Ctx, lead: Lead, body: { courseId?: string; preferredBatchId?: string | null }): Application {
  const existing = ctx.db.applications.find((a) => a.id === lead.applicationId && a.status !== 'CANCELLED')
  if (existing) return existing
  const app: Application = {
    id: nextId(ctx.db, 'APP-2026-', 4),
    leadId: lead.id,
    studentId: null,
    applicantName: lead.name,
    phone: lead.phone,
    email: lead.email,
    courseId: body.courseId ?? lead.interestedCourseId,
    preferredBatchId: body.preferredBatchId ?? null,
    applicationDate: today(),
    counselorId: lead.assignedToId,
    status: 'NEW',
    notes: lead.notes[0]?.text ?? '',
    admissionDate: null,
    history: [],
    certificateId: null,
  }
  const counselled =
    ['COUNSELLING_COMPLETED', 'INTERESTED', 'FOLLOW_UP'].includes(lead.status) || ctx.db.followUps.some((f) => f.entityId === lead.id && f.type === 'COUNSELLING' && f.status === 'COMPLETED')
  advanceApplication(app, 'NEW', actor(ctx))
  if (lead.status !== 'NEW') advanceApplication(app, 'CONTACTED', actor(ctx), nowIso(), 'Lead was already contacted.')
  if (counselled) advanceApplication(app, 'COUNSELLING', actor(ctx), nowIso(), 'Counselling completed with the lead.')
  advanceApplication(app, 'APPLICATION_SUBMITTED', actor(ctx), nowIso(), 'Application raised from lead.')
  ctx.db.applications.push(app)
  lead.applicationId = app.id
  if (lead.status !== 'CONVERTED' && lead.status !== 'INTERESTED') {
    const prev = lead.status
    lead.status = 'INTERESTED'
    audit(ctx, { action: 'LEAD_STATUS_CHANGED', entityType: 'LEAD', entityId: lead.id, entityLabel: lead.name, description: 'Lead status changed on application', previousValue: humanize(prev), newValue: 'Interested' })
  }
  audit(ctx, { action: 'APPLICATION_CREATED', entityType: 'APPLICATION', entityId: app.id, entityLabel: app.applicantName, description: `Application ${app.id} created from lead ${lead.id}`, newValue: courseOf(ctx.db, app.courseId)?.name, relatedIds: [lead.id] })
  pushNotification(ctx.db, { type: 'NEW_APPLICATION', title: 'New application', message: `${app.applicantName} applied for ${courseOf(ctx.db, app.courseId)?.name}.`, link: `/applications/${app.id}`, roles: ['ADMIN', 'SUPER_ADMIN'] })
  return app
}

/** Approve admission → creates the student record, keeping the original lead history. */
export function approveApplication(ctx: Ctx, app: Application, body: Partial<Student> & { admissionDate?: string } = {}): Student {
  if (app.status === 'CANCELLED') throw conflict('A cancelled application cannot be approved.')
  if (app.studentId) throw conflict('Admission has already been approved for this application.')
  if (!app.history.some((h) => h.status === 'APPLICATION_SUBMITTED')) throw conflict('The application must be submitted before admission can be approved.')
  const lead = ctx.db.leads.find((l) => l.id === app.leadId)
  const id = nextId(ctx.db, 'STU-2026-', 5)
  const admission = body.admissionDate ?? today()
  const student: Student = {
    id,
    fullName: app.applicantName,
    phone: app.phone,
    email: app.email,
    dateOfBirth: body.dateOfBirth ?? '',
    gender: body.gender ?? 'OTHER',
    address: body.address ?? '',
    city: body.city ?? lead?.location ?? '',
    state: body.state ?? '',
    postalCode: body.postalCode ?? '',
    education: body.education ?? lead?.education ?? '',
    college: body.college ?? '',
    graduationYear: body.graduationYear ?? new Date().getFullYear(),
    experience: body.experience ?? 'Fresher',
    currentOccupation: body.currentOccupation ?? '',
    source: lead?.source ?? 'OTHER',
    counselorId: app.counselorId,
    status: 'ACTIVE',
    leadId: lead?.id ?? null,
    applicationId: app.id,
    courseId: app.courseId,
    batchId: null,
    admissionDate: admission,
    completedAt: null,
    certificateId: null,
    createdAt: nowIso(),
  }
  ctx.db.students.push(student)
  app.studentId = id
  app.admissionDate = admission
  advanceApplication(app, 'ADMISSION_APPROVED', actor(ctx), nowIso(), 'Admission approved.')
  audit(ctx, { action: 'APPLICATION_APPROVED', entityType: 'APPLICATION', entityId: app.id, entityLabel: app.applicantName, description: `Admission approved for ${app.applicantName}`, previousValue: 'Application Submitted', newValue: 'Admission Approved', relatedIds: [id, lead?.id ?? ''].filter(Boolean) })
  audit(ctx, { action: 'STUDENT_CREATED', entityType: 'STUDENT', entityId: id, entityLabel: student.fullName, description: `Student record ${id} created for ${student.fullName}`, relatedIds: [app.id, lead?.id ?? ''].filter(Boolean) })
  if (lead) {
    const prev = lead.status
    lead.status = 'CONVERTED'
    lead.studentId = id
    lead.nextFollowUp = null
    ctx.db.followUps.filter((f) => f.entityId === lead.id && f.status === 'PENDING').forEach((f) => (f.status = 'CANCELLED'))
    audit(ctx, { action: 'LEAD_CONVERTED', entityType: 'LEAD', entityId: lead.id, entityLabel: lead.name, description: `Lead ${lead.name} converted to student ${id}`, previousValue: humanize(prev), newValue: 'Converted', relatedIds: [id, app.id] })
  }
  return student
}

/* ───────────── routes ───────────── */

get('/applications', 'applications:view', (ctx) => {
  const q = ctx.query
  let rows = ctx.db.applications
  if (q.status) rows = rows.filter((a) => a.status === q.status)
  if (q.courseId) rows = rows.filter((a) => a.courseId === q.courseId)
  if (q.counselorId) rows = rows.filter((a) => a.counselorId === q.counselorId)
  const view = rows.map((a) => presentApplication(ctx.db, a))
  return listResponse(view, q, {
    searchText: (a) => `${a.id} ${a.applicantName} ${a.phone} ${a.email}`,
    dateOf: (a) => a.applicationDate,
    defaultSort: 'applicationDate',
    defaultOrder: 'desc',
    sorters: {
      applicationDate: (a) => a.applicationDate + a.id,
      name: (a) => a.applicantName.toLowerCase(),
      status: (a) => APPLICATION_STATUSES.indexOf(a.status),
      course: (a) => a.courseName ?? '',
    },
  })
})

get('/applications/:id', 'applications:view', (ctx) => presentApplication(ctx.db, findApp(ctx.db, ctx.params.id)))
get('/applications/:id/activity', 'applications:view', (ctx) => activityFor(ctx, ctx.params.id))

post('/applications', 'applications:create', (ctx) => {
  const b = ctx.body as Partial<Application>
  if (b.leadId) {
    const lead = ctx.db.leads.find((l) => l.id === b.leadId && !l.deletedAt)
    if (!lead) throw notFound('Lead')
    return presentApplication(ctx.db, createApplicationFromLead(ctx, lead, { courseId: b.courseId, preferredBatchId: b.preferredBatchId }))
  }
  requireFields(b as Record<string, unknown>, ['applicantName', 'phone', 'courseId', 'counselorId'])
  const app: Application = {
    id: nextId(ctx.db, 'APP-2026-', 4),
    leadId: null,
    studentId: null,
    applicantName: String(b.applicantName).trim(),
    phone: String(b.phone).replace(/\D/g, '').slice(-10),
    email: b.email ?? '',
    courseId: b.courseId!,
    preferredBatchId: b.preferredBatchId ?? null,
    applicationDate: today(),
    counselorId: b.counselorId!,
    status: 'NEW',
    notes: b.notes ?? '',
    admissionDate: null,
    history: [],
    certificateId: null,
  }
  advanceApplication(app, 'NEW', actor(ctx))
  ctx.db.applications.push(app)
  audit(ctx, { action: 'APPLICATION_CREATED', entityType: 'APPLICATION', entityId: app.id, entityLabel: app.applicantName, description: `Application ${app.id} created for ${app.applicantName}`, newValue: courseOf(ctx.db, app.courseId)?.name })
  return presentApplication(ctx.db, app)
})

put('/applications/:id', 'applications:update', (ctx) => {
  const app = findApp(ctx.db, ctx.params.id)
  const b = ctx.body as Partial<Application>
  if (b.courseId && b.courseId !== app.courseId && app.studentId) throw conflict('The course cannot be changed after admission is approved.')
  Object.assign(app, {
    notes: b.notes ?? app.notes,
    preferredBatchId: b.preferredBatchId === undefined ? app.preferredBatchId : b.preferredBatchId,
    courseId: b.courseId ?? app.courseId,
    counselorId: b.counselorId ?? app.counselorId,
  })
  return presentApplication(ctx.db, app)
})

const PRE_ADMISSION: ApplicationStatus[] = ['NEW', 'CONTACTED', 'COUNSELLING', 'APPLICATION_SUBMITTED', 'CANCELLED']

post('/applications/:id/status', 'applications:update', (ctx) => {
  const app = findApp(ctx.db, ctx.params.id)
  const status = ctx.body?.status as ApplicationStatus
  if (!PRE_ADMISSION.includes(status)) throw badRequest('Only pre-admission statuses can be set manually. Later stages update automatically.')
  if (app.status === 'CANCELLED') throw conflict('This application is cancelled.')
  if (app.studentId) throw conflict('Admission is already approved; status now follows the student lifecycle.')
  if (status !== 'CANCELLED' && APPLICATION_STATUSES.indexOf(status) <= APPLICATION_STATUSES.indexOf(app.status)) throw conflict('An application can only move forward.')
  const prev = app.status
  // fill skipped steps so the timeline stays continuous
  if (status !== 'CANCELLED')
    for (const s of PRE_ADMISSION.slice(0, PRE_ADMISSION.indexOf(status) + 1)) if (s !== 'CANCELLED') advanceApplication(app, s, actor(ctx), nowIso(), s === status ? ctx.body?.note : undefined)
  else advanceApplication(app, 'CANCELLED', actor(ctx), nowIso(), ctx.body?.note)
  audit(ctx, { action: 'APPLICATION_STATUS_CHANGED', entityType: 'APPLICATION', entityId: app.id, entityLabel: app.applicantName, description: `Application status changed`, previousValue: humanize(prev), newValue: humanize(app.status), reason: ctx.body?.note, relatedIds: [app.leadId ?? ''].filter(Boolean) })
  return presentApplication(ctx.db, app)
})

post('/applications/:id/approve', 'applications:approve', (ctx) => {
  const app = findApp(ctx.db, ctx.params.id)
  const student = approveApplication(ctx, app, ctx.body ?? {})
  return { application: presentApplication(ctx.db, app), studentId: student.id, student: studentOf(ctx.db, student.id) }
})
