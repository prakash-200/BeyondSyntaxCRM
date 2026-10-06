import type { AppSettings, Lookups, SearchResults } from '@/types'
import { get, notFound, post, put } from '../router'
import { audit } from './helpers'
import { presentStudent } from '../present'
import type { Permission } from '@/constants/permissions'

get('/lookups', 'authenticated', (ctx): Lookups => ({
  courses: ctx.db.courses.filter((c) => !c.deletedAt).map((c) => ({ id: c.id, name: c.name, code: c.code, totalFee: c.totalFee })),
  batches: ctx.db.batches.map((b) => ({ id: b.id, name: b.name, courseId: b.courseId, status: b.status })),
  employees: ctx.db.employees.map((e) => ({ id: e.id, name: e.name, role: e.role })),
}))

/* ───────────── global search ───────────── */

get('/search', 'authenticated', (ctx): SearchResults => {
  const q = (ctx.query.q ?? '').trim().toLowerCase()
  const empty: SearchResults = { students: [], leads: [], applications: [], payments: [], courses: [], batches: [] }
  if (q.length < 2) return empty
  const has = (s: string) => s.toLowerCase().includes(q)
  const allow = (p: Permission) => ctx.can(p)
  const { db } = ctx
  const limit = 5
  const students = allow('students:view')
    ? db.students.filter((s) => !s.deletedAt && (has(s.fullName) || has(s.id) || has(s.phone) || has(s.email))).slice(0, limit).map((s) => {
        const p = presentStudent(db, s)
        return { id: s.id, title: s.fullName, subtitle: `${s.id} · ${p.courseName ?? ''}` }
      })
    : []
  const leads = allow('leads:view')
    ? db.leads.filter((l) => !l.deletedAt && (has(l.name) || has(l.id) || has(l.phone))).slice(0, limit).map((l) => ({ id: l.id, title: l.name, subtitle: `${l.id} · ${l.status.replace(/_/g, ' ').toLowerCase()}` }))
    : []
  const applications = allow('applications:view')
    ? db.applications.filter((a) => has(a.applicantName) || has(a.id)).slice(0, limit).map((a) => ({ id: a.id, title: a.applicantName, subtitle: `${a.id} · ${a.status.replace(/_/g, ' ').toLowerCase()}` }))
    : []
  const payments = allow('payments:view')
    ? db.payments
        .filter((p) => has(p.id) || has(p.transactionId) || has(db.students.find((s) => s.id === p.studentId)?.fullName ?? ''))
        .slice(0, limit)
        .map((p) => ({ id: p.id, title: `${p.id} - ${db.students.find((s) => s.id === p.studentId)?.fullName ?? ''}`, subtitle: `₹${p.amount.toLocaleString('en-IN')} · ${p.paymentDate}` }))
    : []
  const courses = allow('courses:view')
    ? db.courses.filter((c) => has(c.name) || has(c.code)).slice(0, limit).map((c) => ({ id: c.id, title: c.name, subtitle: `${c.durationMonths} months · ₹${c.totalFee.toLocaleString('en-IN')}` }))
    : []
  const batches = allow('batches:view')
    ? db.batches.filter((b) => has(b.name)).slice(0, limit).map((b) => ({ id: b.id, title: b.name, subtitle: b.status.toLowerCase() }))
    : []
  return { students, leads, applications, payments, courses, batches }
})

/* ───────────── notifications ───────────── */

get('/notifications', 'authenticated', (ctx) =>
  ctx.db.notifications
    .filter((n) => n.roles.includes(ctx.user.role))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 30),
)

post('/notifications/read-all', 'authenticated', (ctx) => {
  ctx.db.notifications.filter((n) => n.roles.includes(ctx.user.role)).forEach((n) => (n.read = true))
  return { ok: true }
})

post('/notifications/:id/read', 'authenticated', (ctx) => {
  const n = ctx.db.notifications.find((x) => x.id === ctx.params.id)
  if (!n) throw notFound('Notification')
  n.read = true
  return n
})

/* ───────────── settings ───────────── */

get('/settings', 'authenticated', (ctx) => ctx.db.settings)

put('/settings', 'settings:update', (ctx) => {
  const next = ctx.body as Partial<AppSettings>
  const prev = { ...ctx.db.settings }
  Object.assign(ctx.db.settings, next)
  const changed = (Object.keys(next) as (keyof AppSettings)[]).filter((k) => prev[k] !== ctx.db.settings[k])
  audit(ctx, {
    action: 'SETTINGS_UPDATED',
    entityType: 'SETTINGS',
    entityId: 'SETTINGS',
    description: `Settings updated (${changed.join(', ') || 'no changes'})`,
    previousValue: changed.map((k) => `${k}: ${prev[k]}`).join('; '),
    newValue: changed.map((k) => `${k}: ${ctx.db.settings[k]}`).join('; '),
  })
  return ctx.db.settings
})
