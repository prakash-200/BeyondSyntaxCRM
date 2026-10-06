import { humanize } from '@/constants/labels'
import type { FollowUp, Lead } from '@/types'
import { today, nowIso } from '@/utils/clock'
import { nextId, pushNotification, type Db } from '../../db'
import { actor } from './helpers'
import { activityFor } from './activity'
import { badRequest, conflict, del, get, listResponse, notFound, post, put, requireFields, type Ctx } from '../router'
import { courseOf, employeeName, presentFollowUp, presentLead, studentOf } from '../present'
import { createApplicationFromLead, approveApplication } from './applications'
import { audit } from './helpers'
import { advanceApplication } from '../../db'


function findLead(db: Db, id: string): Lead {
  const lead = db.leads.find((l) => l.id === id && !l.deletedAt)
  if (!lead) throw notFound('Lead')
  return lead
}

export function recomputeNextFollowUp(db: Db, leadId: string) {
  const lead = db.leads.find((l) => l.id === leadId)
  if (!lead) return
  const next = db.followUps
    .filter((f) => f.entityId === leadId && f.status === 'PENDING')
    .map((f) => f.date)
    .sort()[0]
  lead.nextFollowUp = next ?? null
}

/* ───────────── leads ───────────── */

get('/leads', 'leads:view', (ctx) => {
  const q = ctx.query
  let rows = ctx.db.leads.filter((l) => !l.deletedAt)
  if (q.status) rows = rows.filter((l) => l.status === q.status)
  if (q.source) rows = rows.filter((l) => l.source === q.source)
  if (q.priority) rows = rows.filter((l) => l.priority === q.priority)
  if (q.assignedToId) rows = rows.filter((l) => l.assignedToId === q.assignedToId)
  if (q.courseId) rows = rows.filter((l) => l.interestedCourseId === q.courseId)
  const view = rows.map((l) => presentLead(ctx.db, l))
  return listResponse(view, q, {
    searchText: (l) => `${l.id} ${l.name} ${l.phone} ${l.email} ${l.location}`,
    dateOf: (l) => l.createdAt,
    defaultSort: 'createdAt',
    defaultOrder: 'desc',
    sorters: {
      createdAt: (l) => l.createdAt,
      name: (l) => l.name.toLowerCase(),
      status: (l) => l.status,
      priority: (l) => ({ HIGH: 0, MEDIUM: 1, LOW: 2 })[l.priority],
      nextFollowUp: (l) => l.nextFollowUp ?? '9999',
      course: (l) => l.interestedCourseName ?? '',
    },
  })
})

get('/leads/:id', 'leads:view', (ctx) => presentLead(ctx.db, findLead(ctx.db, ctx.params.id)))

function validateLead(ctx: Ctx, body: Partial<Lead>, selfId?: string) {
  requireFields(body as Record<string, unknown>, ['name', 'phone', 'interestedCourseId', 'source', 'assignedToId'])
  const digits = String(body.phone).replace(/\D/g, '').slice(-10)
  if (digits.length !== 10) throw badRequest('Validation failed', { phone: ['Enter a valid 10-digit phone number'] })
  const dup = ctx.db.leads.find((l) => !l.deletedAt && l.id !== selfId && l.phone.replace(/\D/g, '').slice(-10) === digits)
  if (dup) throw conflict(`A lead with this phone number already exists (${dup.id} — ${dup.name}).`)
  return digits
}

post('/leads', 'leads:create', (ctx) => {
  const b = ctx.body as Partial<Lead>
  const phone = validateLead(ctx, b)
  const lead: Lead = {
    id: nextId(ctx.db, 'LEAD-', 4),
    name: String(b.name).trim(),
    phone,
    email: b.email ?? '',
    location: b.location ?? '',
    education: b.education ?? '',
    interestedCourseId: b.interestedCourseId!,
    source: b.source!,
    assignedToId: b.assignedToId!,
    status: 'NEW',
    priority: b.priority ?? 'MEDIUM',
    createdAt: nowIso(),
    nextFollowUp: null,
    notes: [],
    applicationId: null,
    studentId: null,
  }
  if (b.notes && typeof b.notes === 'string') {
    lead.notes.push({ id: `${lead.id}-N1`, text: b.notes, createdById: ctx.user.id, createdByName: ctx.user.name, createdAt: nowIso() })
  }
  ctx.db.leads.push(lead)
  audit(ctx, { action: 'LEAD_CREATED', entityType: 'LEAD', entityId: lead.id, entityLabel: lead.name, description: `Lead ${lead.name} created`, newValue: courseOf(ctx.db, lead.interestedCourseId)?.name })
  pushNotification(ctx.db, { type: 'NEW_LEAD', title: 'New lead', message: `${lead.name} enquired about ${courseOf(ctx.db, lead.interestedCourseId)?.name} via ${humanize(lead.source)}.`, link: `/leads/${lead.id}`, roles: ['COUNSELOR', 'ADMIN', 'SUPER_ADMIN'] })
  return presentLead(ctx.db, lead)
})

put('/leads/:id', 'leads:update', (ctx) => {
  const lead = findLead(ctx.db, ctx.params.id)
  const b = ctx.body as Partial<Lead>
  validateLead(ctx, { ...lead, ...b }, lead.id)
  if (lead.status === 'CONVERTED' && b.status && b.status !== 'CONVERTED') throw conflict('A converted lead cannot change status.')
  const prevStatus = lead.status
  const prevAssignee = lead.assignedToId
  const prevSnapshot = JSON.stringify({ name: lead.name, phone: lead.phone, email: lead.email, location: lead.location, education: lead.education, course: lead.interestedCourseId, source: lead.source, priority: lead.priority })
  Object.assign(lead, {
    name: String(b.name ?? lead.name).trim(),
    phone: String(b.phone ?? lead.phone).replace(/\D/g, '').slice(-10),
    email: b.email ?? lead.email,
    location: b.location ?? lead.location,
    education: b.education ?? lead.education,
    interestedCourseId: b.interestedCourseId ?? lead.interestedCourseId,
    source: b.source ?? lead.source,
    assignedToId: b.assignedToId ?? lead.assignedToId,
    priority: b.priority ?? lead.priority,
    status: b.status ?? lead.status,
  })
  const label = lead.name
  if (lead.status !== prevStatus)
    audit(ctx, { action: 'LEAD_STATUS_CHANGED', entityType: 'LEAD', entityId: lead.id, entityLabel: label, description: `Changed lead status`, previousValue: humanize(prevStatus), newValue: humanize(lead.status) })
  if (lead.assignedToId !== prevAssignee)
    audit(ctx, { action: 'LEAD_ASSIGNED', entityType: 'LEAD', entityId: lead.id, entityLabel: label, description: `Lead reassigned`, previousValue: employeeName(ctx.db, prevAssignee), newValue: employeeName(ctx.db, lead.assignedToId) })
  const nextSnapshot = JSON.stringify({ name: lead.name, phone: lead.phone, email: lead.email, location: lead.location, education: lead.education, course: lead.interestedCourseId, source: lead.source, priority: lead.priority })
  if (prevSnapshot !== nextSnapshot) audit(ctx, { action: 'LEAD_UPDATED', entityType: 'LEAD', entityId: lead.id, entityLabel: label, description: `Lead details updated` })
  return presentLead(ctx.db, lead)
})

del('/leads/:id', 'leads:delete', (ctx) => {
  const lead = findLead(ctx.db, ctx.params.id)
  if (lead.studentId) throw conflict('This lead was converted to a student and its history must be retained.')
  lead.deletedAt = nowIso()
  ctx.db.followUps.filter((f) => f.entityId === lead.id && f.status === 'PENDING').forEach((f) => (f.status = 'CANCELLED'))
  audit(ctx, { action: 'LEAD_DELETED', entityType: 'LEAD', entityId: lead.id, entityLabel: lead.name, description: `Lead ${lead.name} deleted (soft delete)` })
  return { ok: true }
})

post('/leads/:id/notes', 'leads:update', (ctx) => {
  const lead = findLead(ctx.db, ctx.params.id)
  const text = String(ctx.body?.text ?? '').trim()
  if (!text) throw badRequest('Validation failed', { text: ['Note text is required'] })
  lead.notes.unshift({ id: `${lead.id}-N${lead.notes.length + 1}`, text, createdById: ctx.user.id, createdByName: ctx.user.name, createdAt: nowIso() })
  audit(ctx, { action: 'NOTE_ADDED', entityType: 'LEAD', entityId: lead.id, entityLabel: lead.name, description: `Note added to ${lead.name}`, newValue: text.slice(0, 120) })
  return presentLead(ctx.db, lead)
})

post('/leads/:id/assign', 'leads:update', (ctx) => {
  const lead = findLead(ctx.db, ctx.params.id)
  const emp = ctx.db.employees.find((e) => e.id === ctx.body?.employeeId && e.status === 'ACTIVE')
  if (!emp) throw badRequest('Choose an active employee')
  const prev = lead.assignedToId
  lead.assignedToId = emp.id
  audit(ctx, { action: 'LEAD_ASSIGNED', entityType: 'LEAD', entityId: lead.id, entityLabel: lead.name, description: `Lead assigned to ${emp.name}`, previousValue: employeeName(ctx.db, prev), newValue: emp.name })
  return presentLead(ctx.db, lead)
})

post('/leads/:id/convert', ['applications:create', 'leads:update'], (ctx) => {
  const lead = findLead(ctx.db, ctx.params.id)
  if (lead.studentId) throw conflict('This lead has already been converted to a student.')
  const mode = ctx.body?.mode === 'student' ? 'student' : 'application'
  if (mode === 'student' && !ctx.can('applications:approve')) throw badRequest('You can create an application, but only an Admin can approve admission.')
  const app = createApplicationFromLead(ctx, lead, ctx.body ?? {})
  if (mode === 'student') {
    const student = approveApplication(ctx, app, ctx.body ?? {})
    return { leadId: lead.id, applicationId: app.id, studentId: student.id }
  }
  return { leadId: lead.id, applicationId: app.id, studentId: null }
})

get('/leads/:id/followups', 'leads:view', (ctx) =>
  ctx.db.followUps
    .filter((f) => f.entityId === ctx.params.id)
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((f) => presentFollowUp(ctx.db, f)),
)

get('/leads/:id/activity', 'leads:view', (ctx) => activityFor(ctx, ctx.params.id))

/* ───────────── follow-ups ───────────── */

function bucketOf(f: FollowUp): 'today' | 'upcoming' | 'overdue' | 'completed' | 'other' {
  if (f.status === 'COMPLETED') return 'completed'
  if (f.status !== 'PENDING') return 'other'
  const t = today()
  if (f.date === t) return 'today'
  return f.date > t ? 'upcoming' : 'overdue'
}

get('/follow-ups/counts', 'followups:view', (ctx) => {
  const counts = { today: 0, upcoming: 0, overdue: 0, completed: 0, all: 0 }
  for (const f of ctx.db.followUps) {
    const b = bucketOf(f)
    if (b !== 'other') counts[b]++
    counts.all++
  }
  return counts
})

get('/follow-ups', 'followups:view', (ctx) => {
  const q = ctx.query
  let rows = ctx.db.followUps.filter((f) => !ctx.db.leads.find((l) => l.id === f.entityId)?.deletedAt)
  if (q.bucket && q.bucket !== 'all') rows = rows.filter((f) => bucketOf(f) === q.bucket)
  if (q.status) rows = rows.filter((f) => f.status === q.status)
  if (q.type) rows = rows.filter((f) => f.type === q.type)
  if (q.employeeId) rows = rows.filter((f) => f.employeeId === q.employeeId)
  const view = rows.map((f) => presentFollowUp(ctx.db, f))
  const completedView = q.bucket === 'completed'
  return listResponse(view, q, {
    searchText: (f) => `${f.id} ${f.entityName} ${f.entityId} ${f.notes}`,
    dateOf: (f) => f.date,
    defaultSort: 'date',
    defaultOrder: completedView ? 'desc' : 'asc',
    sorters: { date: (f) => `${f.date} ${f.time}`, name: (f) => f.entityName.toLowerCase(), type: (f) => f.type, status: (f) => f.status, employee: (f) => f.employeeName ?? '' },
  })
})

function validateFollowUp(b: Partial<FollowUp>) {
  requireFields(b as Record<string, unknown>, ['entityId', 'date', 'time', 'type'])
  if (b.date! < today()) throw badRequest('Validation failed', { date: ['Follow-up date cannot be in the past'] })
}

post('/follow-ups', 'followups:create', (ctx) => {
  const b = ctx.body as Partial<FollowUp>
  validateFollowUp(b)
  const entityType = b.entityType ?? 'LEAD'
  const lead = entityType === 'LEAD' ? findLead(ctx.db, b.entityId!) : null
  const student = entityType === 'STUDENT' ? studentOf(ctx.db, b.entityId) : null
  if (!lead && !student) throw notFound(entityType === 'LEAD' ? 'Lead' : 'Student')
  const fu: FollowUp = {
    id: nextId(ctx.db, 'FU-', 4),
    entityType,
    entityId: b.entityId!,
    entityName: lead?.name ?? student!.fullName,
    courseName: courseOf(ctx.db, lead?.interestedCourseId ?? student?.courseId)?.name,
    employeeId: b.employeeId ?? lead?.assignedToId ?? ctx.user.id,
    date: b.date!,
    time: b.time!,
    type: b.type!,
    notes: b.notes ?? '',
    status: 'PENDING',
    createdAt: nowIso(),
  }
  ctx.db.followUps.push(fu)
  if (lead) recomputeNextFollowUp(ctx.db, lead.id)
  audit(ctx, { action: 'FOLLOW_UP_SCHEDULED', entityType: 'FOLLOW_UP', entityId: fu.id, entityLabel: fu.entityName, description: `${humanize(fu.type)} follow-up scheduled with ${fu.entityName}`, newValue: `${fu.date} ${fu.time}`, relatedIds: [fu.entityId] })
  return presentFollowUp(ctx.db, fu)
})

function findFollowUp(db: Db, id: string) {
  const fu = db.followUps.find((f) => f.id === id)
  if (!fu) throw notFound('Follow-up')
  return fu
}

put('/follow-ups/:id', 'followups:update', (ctx) => {
  const fu = findFollowUp(ctx.db, ctx.params.id)
  if (fu.status !== 'PENDING') throw conflict('Only pending follow-ups can be edited.')
  const b = ctx.body as Partial<FollowUp>
  Object.assign(fu, { type: b.type ?? fu.type, notes: b.notes ?? fu.notes, time: b.time ?? fu.time, date: b.date ?? fu.date, employeeId: b.employeeId ?? fu.employeeId })
  if (fu.entityType === 'LEAD') recomputeNextFollowUp(ctx.db, fu.entityId)
  return presentFollowUp(ctx.db, fu)
})

post('/follow-ups/:id/complete', 'followups:update', (ctx) => {
  const fu = findFollowUp(ctx.db, ctx.params.id)
  if (fu.status !== 'PENDING') throw conflict('This follow-up is no longer pending.')
  fu.status = 'COMPLETED'
  fu.outcome = String(ctx.body?.outcome ?? '').trim() || 'Completed'
  const lead = ctx.db.leads.find((l) => l.id === fu.entityId)
  if (lead) {
    if (lead.status === 'NEW') {
      lead.status = 'CONTACTED'
      audit(ctx, { action: 'LEAD_STATUS_CHANGED', entityType: 'LEAD', entityId: lead.id, entityLabel: lead.name, description: 'Lead status changed after follow-up', previousValue: 'New', newValue: 'Contacted' })
    }
    if (ctx.body?.leadStatus && ctx.body.leadStatus !== lead.status && lead.status !== 'CONVERTED') {
      const prev = lead.status
      lead.status = ctx.body.leadStatus
      audit(ctx, { action: 'LEAD_STATUS_CHANGED', entityType: 'LEAD', entityId: lead.id, entityLabel: lead.name, description: 'Lead status changed after follow-up', previousValue: humanize(prev), newValue: humanize(lead.status) })
    }
    recomputeNextFollowUp(ctx.db, lead.id)
    const app = ctx.db.applications.find((a) => a.id === lead.applicationId)
    if (app && fu.type === 'COUNSELLING') advanceApplication(app, 'COUNSELLING', actor(ctx), nowIso(), 'Counselling follow-up completed.')
  }
  audit(ctx, { action: 'FOLLOW_UP_COMPLETED', entityType: 'FOLLOW_UP', entityId: fu.id, entityLabel: fu.entityName, description: `Follow-up with ${fu.entityName} completed`, newValue: fu.outcome, relatedIds: [fu.entityId] })
  return presentFollowUp(ctx.db, fu)
})

post('/follow-ups/:id/reschedule', 'followups:update', (ctx) => {
  const old = findFollowUp(ctx.db, ctx.params.id)
  if (old.status !== 'PENDING') throw conflict('Only pending follow-ups can be rescheduled.')
  const { date, time } = ctx.body ?? {}
  if (!date || !time) throw badRequest('Validation failed', { date: ['Date and time are required'] })
  if (date < today()) throw badRequest('Validation failed', { date: ['Follow-up date cannot be in the past'] })
  old.status = 'RESCHEDULED'
  const fu: FollowUp = { ...old, id: nextId(ctx.db, 'FU-', 4), date, time, status: 'PENDING', notes: ctx.body?.reason ? `${old.notes}\nRescheduled: ${ctx.body.reason}`.trim() : old.notes, outcome: undefined, createdAt: nowIso() }
  ctx.db.followUps.push(fu)
  if (old.entityType === 'LEAD') recomputeNextFollowUp(ctx.db, old.entityId)
  audit(ctx, { action: 'FOLLOW_UP_RESCHEDULED', entityType: 'FOLLOW_UP', entityId: fu.id, entityLabel: fu.entityName, description: `Follow-up with ${fu.entityName} rescheduled`, previousValue: `${old.date} ${old.time}`, newValue: `${date} ${time}`, reason: ctx.body?.reason, relatedIds: [fu.entityId, old.id] })
  return presentFollowUp(ctx.db, fu)
})

post('/follow-ups/:id/cancel', 'followups:update', (ctx) => {
  const fu = findFollowUp(ctx.db, ctx.params.id)
  if (fu.status !== 'PENDING') throw conflict('Only pending follow-ups can be cancelled.')
  fu.status = 'CANCELLED'
  if (fu.entityType === 'LEAD') recomputeNextFollowUp(ctx.db, fu.entityId)
  audit(ctx, { action: 'FOLLOW_UP_RESCHEDULED', entityType: 'FOLLOW_UP', entityId: fu.id, entityLabel: fu.entityName, description: `Follow-up with ${fu.entityName} cancelled`, previousValue: 'Pending', newValue: 'Cancelled', relatedIds: [fu.entityId] })
  return presentFollowUp(ctx.db, fu)
})
