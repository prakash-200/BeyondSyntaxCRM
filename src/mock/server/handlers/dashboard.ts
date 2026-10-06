import { courseGroup } from '@/constants/labels'
import type { BusinessReport, DashboardSummary, EmployeePerformance, FinancialReport, Lead, LeadReport, StudentReportRow, TrainerDashboard } from '@/types'
import { attendancePercent, pct, percentChange, sum } from '@/utils/calc'
import { today } from '@/utils/clock'
import { addDays, endOfMonth, format, getDay, parseISO, subDays, subMonths } from 'date-fns'
import type { Db } from '../../db'
import { get, listResponse } from '../router'
import { isCounselor, isTrainer, trainerBatchIds, trainerStudentIds } from './helpers'
import { attendanceStatsFor, batchOf, courseOf, feePlanView, installmentView, presentBatch, presentFollowUp, progressOf, studentOf } from '../present'

const inRange = (d: string | undefined, from: string, to: string) => !!d && d.slice(0, 10) >= from && d.slice(0, 10) <= to

function monthWindows() {
  const t = today()
  const current = parseISO(t)
  const monthStart = format(current, 'yyyy-MM-01')
  const prevStartDate = subMonths(parseISO(monthStart), 1)
  const prevStart = format(prevStartDate, 'yyyy-MM-dd')
  const prevEndFull = format(endOfMonth(prevStartDate), 'yyyy-MM-dd')
  const prevSameDay = format(addDays(prevStartDate, Math.min(current.getDate(), endOfMonth(prevStartDate).getDate()) - 1), 'yyyy-MM-dd')
  return { t, monthStart, prevStart, prevEndFull, prevSameDay }
}

const revenueBetween = (db: Db, from: string, to: string) => sum(db.payments.filter((p) => p.status === 'SUCCESS' && inRange(p.paymentDate, from, to)).map((p) => p.amount))

/** Outstanding as it stood at `date` (payments up to that date, plans created by that date). */
function outstandingAsOf(db: Db, date: string) {
  let total = 0
  for (const plan of db.feePlans) {
    const s = studentOf(db, plan.studentId)
    if (!s || s.deletedAt || s.status === 'DROPPED' || s.status === 'CANCELLED') continue
    if (plan.createdAt.slice(0, 10) > date) continue
    const paid = sum(db.payments.filter((p) => p.studentId === plan.studentId && p.status === 'SUCCESS' && p.paymentDate <= date).map((p) => p.amount))
    total += Math.max(0, plan.finalFee - paid)
  }
  return total
}

function leadRank(l: Lead): number {
  if (l.status === 'CONVERTED') return 5
  if (l.applicationId) return 4
  if (l.status === 'INTERESTED') return 3
  if (['COUNSELLING_SCHEDULED', 'COUNSELLING_COMPLETED'].includes(l.status)) return 2
  return l.status === 'NEW' ? 0 : 1
}

get('/dashboard/summary', 'dashboard:view', (ctx): DashboardSummary => {
  const { db } = ctx
  const w = monthWindows()
  const own = isCounselor(ctx)
  const leads = db.leads.filter((l) => !l.deletedAt && (!own || l.assignedToId === ctx.user.id))
  const students = db.students.filter((s) => !s.deletedAt && (!own || s.counselorId === ctx.user.id))
  const apps = db.applications.filter((a) => !own || a.counselorId === ctx.user.id)

  const leadsMtd = leads.filter((l) => inRange(l.createdAt, w.monthStart, w.t)).length
  const leadsPrev = leads.filter((l) => inRange(l.createdAt, w.prevStart, w.prevSameDay)).length
  const stuMtd = students.filter((s) => inRange(s.admissionDate, w.monthStart, w.t)).length
  const stuPrev = students.filter((s) => inRange(s.admissionDate, w.prevStart, w.prevSameDay)).length
  const d30 = format(subDays(parseISO(w.t), 29), 'yyyy-MM-dd')
  const d60 = format(subDays(parseISO(w.t), 59), 'yyyy-MM-dd')
  const d31 = format(subDays(parseISO(w.t), 30), 'yyyy-MM-dd')
  const active = students.filter((s) => s.status === 'ACTIVE')
  const appsMtd = apps.filter((a) => inRange(a.applicationDate, w.monthStart, w.t)).length
  const appsPrev = apps.filter((a) => inRange(a.applicationDate, w.prevStart, w.prevSameDay)).length
  const revNow = revenueBetween(db, w.monthStart, w.t)
  const revPrev = revenueBetween(db, w.prevStart, w.prevSameDay)

  const plans = db.feePlans.map((p) => feePlanView(db, p)).filter((p) => !own || studentOf(db, p.studentId)?.counselorId === ctx.user.id)
  const outstandingNow = sum(plans.map((p) => p.outstanding))
  const outstandingBefore = outstandingAsOf(db, d31)
  const unpaid = db.installments.filter((i) => i.status === 'PENDING').map(installmentView)

  const lastDay = parseISO(w.t).getDate()
  let cumCur = 0
  let cumPrev = 0
  const revenueTrend = Array.from({ length: 31 }, (_, i) => {
    const day = i + 1
    const cur = format(parseISO(w.monthStart), `yyyy-MM-${String(day).padStart(2, '0')}`)
    const prv = format(parseISO(w.prevStart), `yyyy-MM-${String(day).padStart(2, '0')}`)
    cumCur += sum(db.payments.filter((p) => p.status === 'SUCCESS' && p.paymentDate === cur).map((p) => p.amount))
    cumPrev += sum(db.payments.filter((p) => p.status === 'SUCCESS' && p.paymentDate === prv).map((p) => p.amount))
    return { day, current: day <= lastDay ? cumCur : null, previous: day <= parseISO(w.prevEndFull).getDate() ? cumPrev : null }
  })

  const monthlyRevenue = Array.from({ length: 6 }, (_, i) => {
    const m = subMonths(parseISO(w.monthStart), 5 - i)
    return { month: format(m, 'MMM'), revenue: revenueBetween(db, format(m, 'yyyy-MM-01'), format(endOfMonth(m), 'yyyy-MM-dd')) }
  })

  const funnelStages = ['New Leads', 'Contacted', 'Counselling', 'Interested', 'Application', 'Admission']
  const funnel = funnelStages.map((stage, i) => ({ stage, count: leads.filter((l) => leadRank(l) >= i).length }))

  const dist = new Map<string, number>()
  for (const s of students) {
    if (s.status === 'CANCELLED') continue
    const g = courseGroup(courseOf(db, s.courseId)?.code ?? '')
    dist.set(g, (dist.get(g) ?? 0) + 1)
  }
  const courseDistribution = ['.NET', 'Java', 'Python', 'Full Stack', 'Video Editing', 'Other'].map((name) => ({ name, value: dist.get(name) ?? 0 }))

  const openPlans = plans.filter((p) => {
    const st = studentOf(db, p.studentId)?.status
    return st !== 'DROPPED' && st !== 'CANCELLED'
  })
  const paymentStatus = (['PAID', 'PARTIALLY_PAID', 'PENDING', 'OVERDUE'] as const).map((status) => {
    const rows = openPlans.filter((p) => p.status === status)
    return { status, count: rows.length, amount: sum(rows.map((p) => (status === 'PAID' ? p.paid : p.outstanding))) }
  })

  const fus = db.followUps.filter((f) => f.status === 'PENDING' && (!own || f.employeeId === ctx.user.id) && !db.leads.find((l) => l.id === f.entityId)?.deletedAt)
  const upcoming = fus.filter((f) => f.date >= w.t).sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`)).slice(0, 6)
  const overdue = fus.filter((f) => f.date < w.t).sort((a, b) => a.date.localeCompare(b.date))

  const recent = db.auditLogs
    .filter((l) => l.action !== 'LOGIN' && (ctx.user.role === 'ADMIN' || ctx.user.role === 'SUPER_ADMIN' || l.userId === ctx.user.id))
    .slice(-8)
    .reverse()

  return {
    kpis: {
      totalLeads: { value: leads.length, change: percentChange(leadsMtd, leadsPrev) },
      totalStudents: { value: students.length, change: percentChange(stuMtd, stuPrev) },
      activeStudents: { value: active.length, change: percentChange(students.filter((s) => inRange(s.admissionDate, d30, w.t)).length, students.filter((s) => inRange(s.admissionDate, d60, d31)).length) },
      activeBatches: { value: db.batches.filter((b) => b.status === 'ACTIVE').length, change: 0 },
      newApplications: { value: appsMtd, change: percentChange(appsMtd, appsPrev) },
      pendingPayments: { value: unpaid.length, change: 0 },
      monthlyRevenue: { value: revNow, change: percentChange(revNow, revPrev) },
      outstandingFees: { value: outstandingNow, change: percentChange(outstandingNow, outstandingBefore) },
      conversionRate: pct(leads.filter((l) => l.status === 'CONVERTED').length, leads.length),
    },
    revenueTrend,
    monthlyRevenue,
    funnel,
    courseDistribution,
    paymentStatus,
    upcomingFollowUps: upcoming.map((f) => presentFollowUp(db, f)),
    overdueFollowUps: overdue.slice(0, 5).map((f) => presentFollowUp(db, f)),
    recentActivity: recent,
    overdueInstallments: unpaid.filter((i) => i.status === 'OVERDUE').length,
  }
})

/* ───────────── trainer dashboard ───────────── */

const DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'] as const

get('/dashboard/trainer', 'dashboard:view', (ctx): TrainerDashboard => {
  const { db } = ctx
  const t = today()
  const ids = new Set(trainerBatchIds(ctx))
  const mine = db.batches.filter((b) => ids.has(b.id) && b.status !== 'CANCELLED')
  const students = [...trainerStudentIds(ctx)]
  const min = db.settings.minAttendanceAlert
  const stats = students.map((id) => ({ id, ...attendanceStatsFor(db, id) }))
  const todays = mine
    .filter((b) => b.status === 'ACTIVE' && b.days.includes(DAYS[getDay(parseISO(t))]) && b.startDate <= t && b.endDate >= t)
    .map((b) => {
      const s = db.sessions.find((x) => x.batchId === b.id && x.date === t)
      return { batchId: b.id, batchName: b.name, courseName: courseOf(db, b.courseId)?.name ?? '', startTime: b.startTime, endTime: b.endTime, marked: !!s && db.attendance.some((a) => a.sessionId === s.id) }
    })
  const myAssignments = new Set(db.assignments.filter((a) => ids.has(a.batchId)).map((a) => a.id))
  const pendingReviews = db.submissions.filter((s) => myAssignments.has(s.assignmentId) && (s.status === 'SUBMITTED' || s.status === 'LATE') && !s.reviewedAt).length
  const progress = students.map((id) => progressOf(db, id).overallPercent)
  return {
    myBatches: mine.filter((b) => b.status === 'ACTIVE' || b.status === 'UPCOMING').map((b) => presentBatch(db, b)),
    myStudents: students.length,
    todaysClasses: todays,
    attendanceAverage: stats.length ? Number((sum(stats.map((s) => s.percent)) / stats.length).toFixed(1)) : 0,
    pendingReviews,
    progressAverage: progress.length ? Number((sum(progress) / progress.length).toFixed(1)) : 0,
    lowAttendance: stats
      .filter((s) => s.totalClasses >= 10 && s.percent < min)
      .sort((a, b) => a.percent - b.percent)
      .slice(0, 8)
      .map((s) => ({ studentId: s.id, studentName: s.studentName, batchName: batchOf(db, studentOf(db, s.id)?.batchId)?.name ?? '', percent: s.percent })),
  }
})

/* ───────────── reports ───────────── */

get('/reports/students', 'reports:view', (ctx) => {
  const q = ctx.query
  let rows = ctx.db.students.filter((s) => !s.deletedAt)
  if (isTrainer(ctx)) {
    const allowed = trainerStudentIds(ctx)
    rows = rows.filter((s) => allowed.has(s.id))
  }
  if (isCounselor(ctx)) rows = rows.filter((s) => s.counselorId === ctx.user.id)
  if (q.status) rows = rows.filter((s) => s.status === q.status)
  if (q.courseId) rows = rows.filter((s) => s.courseId === q.courseId)
  if (q.batchId) rows = rows.filter((s) => s.batchId === q.batchId)
  if (q.counselorId) rows = rows.filter((s) => s.counselorId === q.counselorId)
  const view: StudentReportRow[] = rows.map((s) => ({
    id: s.id,
    fullName: s.fullName,
    courseName: courseOf(ctx.db, s.courseId)?.name ?? '',
    batchName: batchOf(ctx.db, s.batchId)?.name ?? '—',
    status: s.status,
    counselorName: ctx.db.employees.find((e) => e.id === s.counselorId)?.name ?? '',
    admissionDate: s.admissionDate,
    progressPercent: progressOf(ctx.db, s.id).overallPercent,
    attendancePercent: attendanceStatsFor(ctx.db, s.id).percent,
  }))
  return listResponse(view, q, {
    searchText: (r) => `${r.id} ${r.fullName} ${r.courseName} ${r.batchName}`,
    dateOf: (r) => r.admissionDate,
    defaultSort: 'admissionDate',
    defaultOrder: 'desc',
    sorters: { admissionDate: (r) => r.admissionDate, name: (r) => r.fullName.toLowerCase(), progress: (r) => r.progressPercent, attendance: (r) => r.attendancePercent, course: (r) => r.courseName },
  })
})

const lastMonths = (n: number) => Array.from({ length: n }, (_, i) => subMonths(parseISO(monthWindows().monthStart), n - 1 - i))

get('/reports/leads', 'reports:view', (ctx): LeadReport => {
  const q = ctx.query
  let leads = ctx.db.leads.filter((l) => !l.deletedAt)
  if (isCounselor(ctx)) leads = leads.filter((l) => l.assignedToId === ctx.user.id)
  if (q.counselorId) leads = leads.filter((l) => l.assignedToId === q.counselorId)
  if (q.from) leads = leads.filter((l) => l.createdAt.slice(0, 10) >= q.from)
  if (q.to) leads = leads.filter((l) => l.createdAt.slice(0, 10) <= q.to)
  const converted = leads.filter((l) => l.status === 'CONVERTED').length
  const sources = [...new Set(leads.map((l) => l.source))]
  return {
    total: leads.length,
    converted,
    lost: leads.filter((l) => l.status === 'LOST').length,
    conversionRate: pct(converted, leads.length),
    bySource: sources.map((source) => {
      const rows = leads.filter((l) => l.source === source)
      const conv = rows.filter((l) => l.status === 'CONVERTED').length
      return { source, leads: rows.length, converted: conv, rate: pct(conv, rows.length) }
    }).sort((a, b) => b.leads - a.leads),
    byStatus: [...new Set(leads.map((l) => l.status))].map((status) => ({ status, count: leads.filter((l) => l.status === status).length })),
    byMonth: lastMonths(9).map((m) => {
      const key = format(m, 'yyyy-MM')
      const rows = leads.filter((l) => l.createdAt.startsWith(key))
      return { month: format(m, 'MMM'), leads: rows.length, converted: rows.filter((l) => l.status === 'CONVERTED').length }
    }),
  }
})

get('/reports/financial', 'financialReports:view', (ctx): FinancialReport => {
  const { db, query: q } = ctx
  const from = q.from ?? '0000-01-01'
  const to = q.to ?? '9999-12-31'
  const plans = db.feePlans.map((p) => feePlanView(db, p))
  const payments = db.payments.filter((p) => p.status === 'SUCCESS' && inRange(p.paymentDate, from, to))
  const unpaid = db.installments.filter((i) => i.status === 'PENDING').map(installmentView)
  const methods = [...new Set(payments.map((p) => p.method))]
  return {
    totalRevenue: sum(plans.filter((p) => inRange(p.createdAt, from, to)).map((p) => p.finalFee)),
    collected: sum(payments.map((p) => p.amount)),
    outstanding: sum(plans.map((p) => p.outstanding)),
    overdue: sum(unpaid.filter((i) => i.status === 'OVERDUE').map((i) => i.amount - i.paidAmount)),
    refunds: sum(db.refunds.filter((r) => inRange(r.date, from, to)).map((r) => r.amount)),
    byMonth: lastMonths(9).map((m) => {
      const a = format(m, 'yyyy-MM-01')
      const b = format(endOfMonth(m), 'yyyy-MM-dd')
      return { month: format(m, 'MMM'), collected: revenueBetween(db, a, b), refunds: sum(db.refunds.filter((r) => inRange(r.date, a, b)).map((r) => r.amount)) }
    }),
    byMethod: methods.map((method) => ({ method, amount: sum(payments.filter((p) => p.method === method).map((p) => p.amount)) })).sort((a, b) => b.amount - a.amount),
    byCourse: db.courses.map((c) => {
      const rows = plans.filter((p) => p.courseId === c.id)
      return { course: c.name, billed: sum(rows.map((p) => p.finalFee)), collected: sum(rows.map((p) => p.paid)), outstanding: sum(rows.map((p) => p.outstanding)) }
    }).filter((r) => r.billed > 0),
  }
})

get('/reports/employees', 'reports:view', (ctx): EmployeePerformance => {
  const { db } = ctx
  const counselors = db.employees.filter((e) => e.role === 'COUNSELOR' && (!isCounselor(ctx) || e.id === ctx.user.id))
  const trainers = db.employees.filter((e) => e.role === 'TRAINER' && (!isTrainer(ctx) || e.id === ctx.user.id))
  return {
    counselors: counselors.map((e) => {
      const mine = db.leads.filter((l) => !l.deletedAt && l.assignedToId === e.id)
      return { id: e.id, name: e.name, leadsAssigned: mine.length, leadsContacted: mine.filter((l) => l.status !== 'NEW').length, admissions: db.students.filter((s) => !s.deletedAt && s.counselorId === e.id).length, conversionRate: pct(mine.filter((l) => l.status === 'CONVERTED').length, mine.length) }
    }),
    trainers: trainers.map((e) => {
      const batchIds = new Set(db.batches.filter((b) => b.trainerId === e.id).map((b) => b.id))
      const memberIds = [...new Set(db.batchStudents.filter((x) => batchIds.has(x.batchId)).map((x) => x.studentId))]
      const members = memberIds.map((id) => studentOf(db, id)!).filter(Boolean)
      const att = members.map((s) => attendanceStatsFor(db, s.id))
      const present = sum(att.map((a) => a.present + a.late))
      const absent = sum(att.map((a) => a.absent))
      return { id: e.id, name: e.name, students: members.length, attendancePercent: attendancePercent(present, 0, absent), completionRate: pct(members.filter((s) => s.status === 'COMPLETED').length, members.length) }
    }),
  }
})

get('/reports/business', 'financialReports:view', (ctx): BusinessReport => {
  const { db } = ctx
  const students = db.students.filter((s) => !s.deletedAt)
  const plans = db.feePlans.map((p) => feePlanView(db, p))
  return {
    admissionsByMonth: lastMonths(9).map((m) => ({ month: format(m, 'MMM'), admissions: students.filter((s) => s.admissionDate.startsWith(format(m, 'yyyy-MM'))).length })),
    revenueByCourse: db.courses.map((c) => ({ course: c.name, revenue: sum(plans.filter((p) => p.courseId === c.id).map((p) => p.paid)) })).filter((r) => r.revenue > 0).sort((a, b) => b.revenue - a.revenue),
    batchUtilization: db.batches.filter((b) => b.status === 'ACTIVE' || b.status === 'UPCOMING').map((b) => ({ batch: b.name, enrolled: presentBatch(db, b).currentStudentCount, capacity: b.capacity })),
    completionRate: pct(students.filter((s) => s.status === 'COMPLETED').length, students.length),
    dropRate: pct(students.filter((s) => s.status === 'DROPPED').length, students.length),
  }
})

