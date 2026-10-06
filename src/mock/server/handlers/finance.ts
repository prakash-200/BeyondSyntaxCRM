import { PAYMENT_METHODS, PAYMENT_STATUSES, type PaymentMethod } from '@/constants/enums'
import { humanize } from '@/constants/labels'
import type { Installment, Payment, PaymentDetail, PendingInstallment, Refund } from '@/types'
import { discountedFee, sum } from '@/utils/calc'
import { today, nowIso } from '@/utils/clock'
import { advanceApplication, nextId, type Db, type StoredFeePlan } from '../../db'
import { activityFor } from './activity'
import { actor, audit, money } from './helpers'
import { badRequest, conflict, del, get, HttpError, listResponse, notFound, post, put, requireFields, type Ctx } from '../router'
import { courseOf, feePlanView, installmentView, presentInvoice, presentPayment, studentOf } from '../present'
import { findStudent } from './students'
import { addDays, format, parseISO } from 'date-fns'

/* ───────────── allocation ───────────── */

const effectiveAmount = (db: Db, p: Payment) => p.amount - sum(db.refunds.filter((r) => r.paymentId === p.id).map((r) => r.amount))

/**
 * Re-derive installment paid amounts from the payment ledger. Each successful
 * payment goes to its chosen installment first, any remainder to the earliest
 * unpaid installments. Keeps installments consistent after edits and refunds.
 */
export function recomputeAllocation(db: Db, studentId: string) {
  const insts = db.installments.filter((i) => i.studentId === studentId && i.status !== 'CANCELLED').sort((a, b) => a.number - b.number)
  insts.forEach((i) => {
    i.paidAmount = 0
    i.status = 'PENDING'
    i.paidAt = null
  })
  const pay = db.payments
    .filter((p) => p.studentId === studentId && (p.status === 'SUCCESS' || (p.status === 'REFUNDED' && effectiveAmount(db, p) > 0)))
    .sort((a, b) => a.paymentDate.localeCompare(b.paymentDate) || a.id.localeCompare(b.id))
  for (const p of pay) {
    let left = p.status === 'REFUNDED' ? 0 : effectiveAmount(db, p)
    const order = [...insts.filter((i) => i.id === p.installmentId), ...insts.filter((i) => i.id !== p.installmentId)]
    for (const i of order) {
      if (left <= 0) break
      const room = i.amount - i.paidAmount
      if (room <= 0) continue
      const take = Math.min(room, left)
      i.paidAmount += take
      left -= take
      if (i.paidAmount >= i.amount) {
        i.status = 'PAID'
        i.paidAt = `${p.paymentDate}T12:00:00.000Z`
      }
    }
  }
  const status = db.students.find((s) => s.id === studentId)?.status
  if (status === 'DROPPED' || status === 'CANCELLED') insts.forEach((i) => i.status !== 'PAID' && (i.status = 'CANCELLED'))
}

function planFor(db: Db, studentId: string): StoredFeePlan | undefined {
  return db.feePlans.find((p) => p.studentId === studentId)
}

function syncInvoice(db: Db, plan: StoredFeePlan) {
  const inv = db.invoices.find((i) => i.id === plan.invoiceId)
  if (!inv) return
  const rate = inv.taxRate
  inv.subtotal = plan.courseFee
  inv.discount = plan.discount
  inv.scholarship = plan.scholarship
  inv.total = plan.finalFee
  inv.taxAmount = rate ? Math.round((plan.finalFee * rate) / (100 + rate)) : 0
  inv.items = [{ description: `${courseOf(db, plan.courseId)?.name} — course fee`, amount: plan.courseFee }]
}

/* ───────────── fee plans ───────────── */

interface ScheduleInput {
  amount: number
  dueDate: string
}

function validateSchedule(schedule: ScheduleInput[], expectedTotal: number) {
  if (!schedule?.length) throw badRequest('Validation failed', { installments: ['Add at least one installment'] })
  for (const s of schedule) {
    if (!(Number(s.amount) > 0)) throw badRequest('Validation failed', { installments: ['Each installment must be greater than ₹0'] })
    if (!s.dueDate) throw badRequest('Validation failed', { installments: ['Every installment needs a due date'] })
  }
  const total = sum(schedule.map((s) => Number(s.amount)))
  if (total !== expectedTotal) throw badRequest('Validation failed', { installments: [`Installments total ${money(total)} but must equal ${money(expectedTotal)}`] })
  const dates = schedule.map((s) => s.dueDate)
  if ([...dates].sort().join() !== dates.join()) throw badRequest('Validation failed', { installments: ['Due dates must be in chronological order'] })
}

get('/fee-plans', 'fees:view', (ctx) => {
  const q = ctx.query
  let plans = ctx.db.feePlans.filter((p) => !studentOf(ctx.db, p.studentId)?.deletedAt)
  if (q.courseId) plans = plans.filter((p) => p.courseId === q.courseId)
  if (q.batchId) plans = plans.filter((p) => studentOf(ctx.db, p.studentId)?.batchId === q.batchId)
  let view = plans.map((p) => feePlanView(ctx.db, p))
  if (q.status) view = view.filter((p) => p.status === q.status)
  return listResponse(view, q, {
    searchText: (p) => `${p.id} ${p.studentName} ${p.studentId}`,
    dateOf: (p) => p.createdAt,
    defaultSort: 'createdAt',
    defaultOrder: 'desc',
    sorters: { createdAt: (p) => p.createdAt, student: (p) => (p.studentName ?? '').toLowerCase(), finalFee: (p) => p.finalFee, paid: (p) => p.paid, outstanding: (p) => p.outstanding, status: (p) => p.status },
  })
})

get('/fee-plans/:id', 'fees:view', (ctx) => {
  const plan = ctx.db.feePlans.find((p) => p.id === ctx.params.id)
  if (!plan) throw notFound('Fee plan')
  return feePlanView(ctx.db, plan)
})

post('/fee-plans', 'fees:create', (ctx) => {
  const b = ctx.body as { studentId: string; courseFee?: number; discount?: number; scholarship?: number; installments: ScheduleInput[] }
  requireFields(b as unknown as Record<string, unknown>, ['studentId'])
  const student = findStudent(ctx.db, b.studentId)
  if (planFor(ctx.db, student.id)) throw conflict('This student already has a fee plan. Edit the existing plan instead.')
  const course = courseOf(ctx.db, student.courseId)!
  const courseFee = Number(b.courseFee ?? course.totalFee)
  const discount = Number(b.discount ?? 0)
  const scholarship = Number(b.scholarship ?? 0)
  if (courseFee <= 0 || discount < 0 || scholarship < 0) throw badRequest('Validation failed', { courseFee: ['Fee amounts must be positive'] })
  const finalFee = discountedFee(courseFee, discount, scholarship)
  if (finalFee <= 0) throw badRequest('Validation failed', { discount: ['Discount and scholarship cannot exceed the course fee'] })
  validateSchedule(b.installments, finalFee)

  const planId = nextId(ctx.db, 'FEE-', 4)
  const invoiceId = nextId(ctx.db, 'INV-2026-', 5)
  const plan: StoredFeePlan = { id: planId, studentId: student.id, courseId: course.id, courseFee, discount, scholarship, finalFee, createdAt: nowIso(), invoiceId }
  ctx.db.feePlans.push(plan)
  const rate = ctx.db.settings.taxRate
  ctx.db.invoices.push({ id: invoiceId, number: invoiceId, studentId: student.id, feePlanId: planId, date: today(), items: [], subtotal: courseFee, discount, scholarship, taxRate: rate, taxAmount: 0, total: finalFee })
  syncInvoice(ctx.db, plan)
  b.installments.forEach((s, i) => {
    ctx.db.installments.push({ id: nextId(ctx.db, 'INS-', 4), feePlanId: planId, studentId: student.id, number: i + 1, amount: Number(s.amount), dueDate: s.dueDate, status: 'PENDING', paidAmount: 0, paidAt: null })
  })
  const app = ctx.db.applications.find((a) => a.id === student.applicationId)
  if (app) advanceApplication(app, 'PAYMENT_PENDING', actor(ctx), nowIso(), 'Fee plan created.')
  audit(ctx, { action: 'FEE_PLAN_CREATED', entityType: 'FEE_PLAN', entityId: planId, entityLabel: student.fullName, description: `Fee plan of ${money(finalFee)} in ${b.installments.length} installment(s) created for ${student.fullName}`, newValue: money(finalFee), relatedIds: [student.id, invoiceId, student.applicationId ?? ''].filter(Boolean) })
  return feePlanView(ctx.db, plan)
})

put('/fee-plans/:id', 'fees:update', (ctx) => {
  const plan = ctx.db.feePlans.find((p) => p.id === ctx.params.id)
  if (!plan) throw notFound('Fee plan')
  const b = ctx.body as { courseFee?: number; discount?: number; scholarship?: number; reason?: string; installments?: ScheduleInput[] }
  const reason = String(b.reason ?? '').trim()
  if (!reason) throw badRequest('Validation failed', { reason: ['A reason is required to change the fee'] })
  const student = studentOf(ctx.db, plan.studentId)!
  const courseFee = Number(b.courseFee ?? plan.courseFee)
  const discount = Number(b.discount ?? plan.discount)
  const scholarship = Number(b.scholarship ?? plan.scholarship)
  const finalFee = discountedFee(courseFee, discount, scholarship)
  const before = feePlanView(ctx.db, plan)
  if (finalFee <= 0) throw badRequest('Validation failed', { discount: ['Discount and scholarship cannot exceed the course fee'] })
  if (finalFee < before.paid) throw conflict(`The new fee ${money(finalFee)} is lower than the ${money(before.paid)} already collected. Issue a refund first so the outstanding balance never goes negative.`)
  const remaining = finalFee - before.paid
  const unpaid = ctx.db.installments.filter((i) => i.feePlanId === plan.id && i.status !== 'PAID' && i.status !== 'CANCELLED').sort((a, b2) => a.number - b2.number)
  // paid-partial installments are kept as-is only when they are fully paid; rebuild the rest
  if (b.installments?.length) validateSchedule(b.installments, remaining)
  Object.assign(plan, { courseFee, discount, scholarship, finalFee })
  const nextNumber = Math.max(0, ...ctx.db.installments.filter((i) => i.feePlanId === plan.id && i.status === 'PAID').map((i) => i.number)) + 1
  const schedule: ScheduleInput[] =
    b.installments?.length
      ? b.installments
      : remaining <= 0
        ? []
        : unpaid.length
          ? unpaid.map((i, idx) => ({ dueDate: i.dueDate, amount: Math.floor(remaining / unpaid.length) + (idx < remaining % unpaid.length ? 1 : 0) }))
          : [{ dueDate: format(addDays(parseISO(today()), 30), 'yyyy-MM-dd'), amount: remaining }]
  ctx.db.installments = ctx.db.installments.filter((i) => !unpaid.some((u) => u.id === i.id))
  schedule.forEach((s, idx) => ctx.db.installments.push({ id: nextId(ctx.db, 'INS-', 4), feePlanId: plan.id, studentId: plan.studentId, number: nextNumber + idx, amount: Number(s.amount), dueDate: s.dueDate, status: 'PENDING', paidAmount: 0, paidAt: null }))
  recomputeAllocation(ctx.db, plan.studentId)
  syncInvoice(ctx.db, plan)
  audit(ctx, { action: 'FEE_CHANGED', entityType: 'FEE_PLAN', entityId: plan.id, entityLabel: student.fullName, description: `Fee changed for ${student.fullName}`, previousValue: `${money(before.finalFee)} (discount ${money(before.discount)}, scholarship ${money(before.scholarship)})`, newValue: `${money(finalFee)} (discount ${money(discount)}, scholarship ${money(scholarship)})`, reason, relatedIds: [student.id, plan.invoiceId ?? '', student.applicationId ?? ''].filter(Boolean) })
  return feePlanView(ctx.db, plan)
})

post('/fee-plans/:id/installments', 'fees:update', (ctx) => {
  const plan = ctx.db.feePlans.find((p) => p.id === ctx.params.id)
  if (!plan) throw notFound('Fee plan')
  const b = ctx.body as { installments: ScheduleInput[]; reason?: string }
  if (!String(b.reason ?? '').trim()) throw badRequest('Validation failed', { reason: ['A reason is required to change the installment plan'] })
  const view = feePlanView(ctx.db, plan)
  if (view.outstanding <= 0) throw conflict('There is no outstanding balance to schedule.')
  validateSchedule(b.installments, view.outstanding)
  const unpaid = ctx.db.installments.filter((i) => i.feePlanId === plan.id && i.status !== 'PAID' && i.status !== 'CANCELLED')
  const nextNumber = Math.max(0, ...ctx.db.installments.filter((i) => i.feePlanId === plan.id && i.status === 'PAID').map((i) => i.number)) + 1
  const before = unpaid.map((i) => `${money(i.amount)} on ${i.dueDate}`).join(', ')
  ctx.db.installments = ctx.db.installments.filter((i) => !unpaid.some((u) => u.id === i.id))
  b.installments.forEach((s, idx) => ctx.db.installments.push({ id: nextId(ctx.db, 'INS-', 4), feePlanId: plan.id, studentId: plan.studentId, number: nextNumber + idx, amount: Number(s.amount), dueDate: s.dueDate, status: 'PENDING', paidAmount: 0, paidAt: null }))
  recomputeAllocation(ctx.db, plan.studentId)
  const student = studentOf(ctx.db, plan.studentId)!
  audit(ctx, { action: 'FEE_CHANGED', entityType: 'FEE_PLAN', entityId: plan.id, entityLabel: student.fullName, description: `Installment plan changed for ${student.fullName}`, previousValue: before || '—', newValue: b.installments.map((s) => `${money(Number(s.amount))} on ${s.dueDate}`).join(', '), reason: b.reason, relatedIds: [student.id] })
  return feePlanView(ctx.db, plan)
})

/* ───────────── installments (pending payments) ───────────── */

get('/installments', ['fees:view', 'payments:view'], (ctx) => {
  const q = ctx.query
  const t = today()
  let rows: PendingInstallment[] = ctx.db.installments
    .filter((i) => i.status === 'PENDING')
    .map((i) => {
      const s = studentOf(ctx.db, i.studentId)
      const view: Installment = installmentView(i)
      return { ...view, studentName: s?.fullName ?? '', courseName: courseOf(ctx.db, s?.courseId)?.name, phone: s?.phone ?? '', daysOverdue: view.status === 'OVERDUE' ? Math.round((parseISO(t).getTime() - parseISO(i.dueDate).getTime()) / 86400000) : 0 }
    })
    .filter((i) => !studentOf(ctx.db, i.studentId)?.deletedAt)
  if (q.status === 'OVERDUE') rows = rows.filter((r) => r.status === 'OVERDUE')
  if (q.status === 'PENDING') rows = rows.filter((r) => r.status === 'PENDING')
  if (q.courseId) rows = rows.filter((r) => studentOf(ctx.db, r.studentId)?.courseId === q.courseId)
  if (q.batchId) rows = rows.filter((r) => studentOf(ctx.db, r.studentId)?.batchId === q.batchId)
  return listResponse(rows, q, {
    searchText: (r) => `${r.studentName} ${r.studentId} ${r.phone}`,
    dateOf: (r) => r.dueDate,
    defaultSort: 'dueDate',
    sorters: { dueDate: (r) => r.dueDate, student: (r) => r.studentName.toLowerCase(), amount: (r) => r.amount, days: (r) => r.daysOverdue },
  })
})

/* ───────────── payments ───────────── */

const NEEDS_TXN: PaymentMethod[] = ['UPI', 'BANK_TRANSFER', 'CARD', 'PAYMENT_GATEWAY']

get('/payments', 'payments:view', (ctx) => {
  const q = ctx.query
  let rows = ctx.db.payments
  if (q.status) rows = rows.filter((p) => p.status === q.status)
  if (q.method) rows = rows.filter((p) => p.method === q.method)
  if (q.studentId) rows = rows.filter((p) => p.studentId === q.studentId)
  if (q.recordedById) rows = rows.filter((p) => p.recordedById === q.recordedById)
  if (q.courseId) rows = rows.filter((p) => studentOf(ctx.db, p.studentId)?.courseId === q.courseId)
  if (q.batchId) rows = rows.filter((p) => studentOf(ctx.db, p.studentId)?.batchId === q.batchId)
  return listResponse(rows.map((p) => presentPayment(ctx.db, p)), q, {
    searchText: (p) => `${p.id} ${p.transactionId} ${p.studentName} ${p.studentId} ${p.invoiceNumber}`,
    dateOf: (p) => p.paymentDate,
    defaultSort: 'paymentDate',
    defaultOrder: 'desc',
    sorters: { paymentDate: (p) => p.paymentDate + p.id, amount: (p) => p.amount, student: (p) => (p.studentName ?? '').toLowerCase(), status: (p) => p.status, method: (p) => p.method, id: (p) => p.id },
  })
})

get('/payments/:id', 'payments:view', (ctx): PaymentDetail => {
  const p = ctx.db.payments.find((x) => x.id === ctx.params.id)
  if (!p) throw notFound('Payment')
  const s = studentOf(ctx.db, p.studentId)
  const inv = ctx.db.invoices.find((i) => i.id === p.invoiceId)
  return { ...presentPayment(ctx.db, p), invoice: inv ? presentInvoice(ctx.db, inv) : undefined, student: s ? { id: s.id, fullName: s.fullName, phone: s.phone, courseName: courseOf(ctx.db, s.courseId)?.name } : undefined }
})

get('/payments/:id/activity', 'payments:view', (ctx) => activityFor(ctx, ctx.params.id))

function validatePaymentFields(ctx: Ctx, b: Partial<Payment>, selfId?: string) {
  const errors: Record<string, string[]> = {}
  if (!(Number(b.amount) > 0)) errors.amount = ['Amount must be greater than ₹0']
  if (!b.method || !PAYMENT_METHODS.includes(b.method)) errors.method = ['Select a payment method']
  if (!b.paymentDate) errors.paymentDate = ['Payment date is required']
  else if (b.paymentDate > today()) errors.paymentDate = ['Payment date cannot be in the future']
  if (b.method && NEEDS_TXN.includes(b.method) && !String(b.transactionId ?? '').trim()) errors.transactionId = ['Transaction ID is required for this payment method']
  if (b.transactionId && ctx.db.payments.some((p) => p.id !== selfId && p.transactionId.toLowerCase() === String(b.transactionId).trim().toLowerCase())) errors.transactionId = ['This transaction ID has already been recorded']
  if (Object.keys(errors).length) throw badRequest('Validation failed', errors)
}

post('/payments', 'payments:create', (ctx) => {
  const b = ctx.body as Partial<Payment> & { allowOverpayment?: boolean }
  requireFields(b as Record<string, unknown>, ['studentId'])
  const student = findStudent(ctx.db, b.studentId!)
  const plan = planFor(ctx.db, student.id)
  if (!plan) throw conflict('Create a fee plan for this student before recording payments.')
  validatePaymentFields(ctx, b)
  const status = b.status && PAYMENT_STATUSES.includes(b.status) ? b.status : 'SUCCESS'
  if (status === 'REFUNDED') throw badRequest('Use the refund action to refund a payment.')
  const view = feePlanView(ctx.db, plan)
  const amount = Number(b.amount)
  let isOverpayment = false
  if (status === 'SUCCESS' && amount > view.outstanding) {
    if (!b.allowOverpayment) throw conflict(`Payment of ${money(amount)} exceeds the outstanding balance of ${money(view.outstanding)}. Confirm overpayment to continue.`)
    isOverpayment = true
  }
  if (b.installmentId && !ctx.db.installments.some((i) => i.id === b.installmentId && i.feePlanId === plan.id)) throw badRequest('Installment does not belong to this student')
  const method = b.method as PaymentMethod
  const payment: Payment = {
    id: nextId(ctx.db, 'PAY-', 5),
    studentId: student.id,
    invoiceId: plan.invoiceId!,
    installmentId: b.installmentId ?? null,
    amount,
    method,
    transactionId: String(b.transactionId ?? '').trim() || (method === 'CASH' ? `CASH-RCPT-${String(Math.floor(Math.random() * 99999)).padStart(5, '0')}` : ''),
    paymentDate: b.paymentDate!,
    status,
    recordedById: ctx.user.id,
    notes: b.notes ?? '',
    isOverpayment,
    createdAt: nowIso(),
  }
  ctx.db.payments.push(payment)
  if (status === 'SUCCESS') {
    recomputeAllocation(ctx.db, student.id)
    const after = feePlanView(ctx.db, plan)
    const app = ctx.db.applications.find((a) => a.id === student.applicationId)
    if (app && after.outstanding === 0) advanceApplication(app, 'PAYMENT_COMPLETED', actor(ctx), nowIso(), 'Fee paid in full.')
  }
  audit(ctx, { action: 'PAYMENT_ADDED', entityType: 'PAYMENT', entityId: payment.id, entityLabel: student.fullName, description: `Payment of ${money(amount)} recorded for ${student.fullName} (${humanize(status)})`, newValue: `${money(amount)} via ${humanize(method)}`, relatedIds: [student.id, plan.invoiceId ?? '', student.applicationId ?? ''].filter(Boolean) })
  return presentPayment(ctx.db, payment)
})

put('/payments/:id', 'payments:update', (ctx) => {
  const payment = ctx.db.payments.find((p) => p.id === ctx.params.id)
  if (!payment) throw notFound('Payment')
  if (payment.status === 'REFUNDED') throw conflict('Refunded payments are locked.')
  const b = ctx.body as Partial<Payment> & { reason?: string; allowOverpayment?: boolean }
  const reason = String(b.reason ?? '').trim()
  if (!reason) throw badRequest('Validation failed', { reason: ['A reason is required to modify a payment'] })
  const next = { ...payment, ...b, amount: b.amount !== undefined ? Number(b.amount) : payment.amount }
  validatePaymentFields(ctx, next, payment.id)
  if (b.status === 'REFUNDED') throw badRequest('Use the refund action to refund a payment.')
  const plan = planFor(ctx.db, payment.studentId)!
  if (next.status === 'SUCCESS') {
    const others = sum(ctx.db.payments.filter((p) => p.studentId === payment.studentId && p.status === 'SUCCESS' && p.id !== payment.id).map((p) => effectiveAmount(ctx.db, p)))
    if (others + next.amount > plan.finalFee && !b.allowOverpayment) throw conflict(`This change would collect ${money(others + next.amount)} against a fee of ${money(plan.finalFee)}. Confirm overpayment to continue.`)
    next.isOverpayment = others + next.amount > plan.finalFee
  }
  const summary = (p: Payment) => `${money(p.amount)} · ${humanize(p.method)} · ${p.transactionId || 'no txn'} · ${p.paymentDate} · ${humanize(p.status)}`
  const prev = summary(payment)
  Object.assign(payment, { amount: next.amount, method: next.method, transactionId: String(next.transactionId ?? '').trim(), paymentDate: next.paymentDate, notes: next.notes ?? '', status: next.status, isOverpayment: next.isOverpayment })
  recomputeAllocation(ctx.db, payment.studentId)
  const student = studentOf(ctx.db, payment.studentId)!
  audit(ctx, { action: 'PAYMENT_MODIFIED', entityType: 'PAYMENT', entityId: payment.id, entityLabel: student.fullName, description: `Payment ${payment.id} modified`, previousValue: prev, newValue: summary(payment), reason, relatedIds: [student.id, payment.invoiceId] })
  return presentPayment(ctx.db, payment)
})

del('/payments/:id', 'payments:update', () => {
  throw new HttpError(405, 'Financial records cannot be deleted. Mark the payment as Failed instead, or issue a refund.')
})

/* ───────────── refunds ───────────── */

get('/refunds', 'refunds:view', (ctx) => {
  const view = ctx.db.refunds.map((r): Refund => ({ ...r, studentName: studentOf(ctx.db, r.studentId)?.fullName, processedByName: ctx.db.employees.find((e) => e.id === r.processedById)?.name }))
  return listResponse(view, ctx.query, {
    searchText: (r) => `${r.id} ${r.paymentId} ${r.studentName} ${r.reason}`,
    dateOf: (r) => r.date,
    defaultSort: 'date',
    defaultOrder: 'desc',
    sorters: { date: (r) => r.date + r.id, amount: (r) => r.amount, student: (r) => (r.studentName ?? '').toLowerCase() },
  })
})

post('/payments/:id/refund', 'refunds:create', (ctx) => {
  const payment = ctx.db.payments.find((p) => p.id === ctx.params.id)
  if (!payment) throw notFound('Payment')
  if (payment.status !== 'SUCCESS') throw conflict('Only successful payments can be refunded.')
  const amount = Number(ctx.body?.amount)
  const reason = String(ctx.body?.reason ?? '').trim()
  const already = sum(ctx.db.refunds.filter((r) => r.paymentId === payment.id).map((r) => r.amount))
  const errors: Record<string, string[]> = {}
  if (!(amount > 0)) errors.amount = ['Refund amount must be greater than ₹0']
  else if (amount > payment.amount - already) errors.amount = [`Cannot refund more than ${money(payment.amount - already)} for this payment`]
  if (!reason) errors.reason = ['A reason is required']
  if (Object.keys(errors).length) throw badRequest('Validation failed', errors)
  const refund: Refund = { id: nextId(ctx.db, 'REF-', 3), paymentId: payment.id, studentId: payment.studentId, amount, reason, date: today(), processedById: ctx.user.id }
  ctx.db.refunds.push(refund)
  if (already + amount >= payment.amount) payment.status = 'REFUNDED'
  recomputeAllocation(ctx.db, payment.studentId)
  const student = studentOf(ctx.db, payment.studentId)!
  audit(ctx, { action: 'REFUND_ISSUED', entityType: 'REFUND', entityId: refund.id, entityLabel: student.fullName, description: `Refund of ${money(amount)} issued to ${student.fullName}`, newValue: money(amount), reason, relatedIds: [student.id, payment.id, payment.invoiceId] })
  return refund
})

/* ───────────── invoices ───────────── */

get('/invoices', 'invoices:view', (ctx) => {
  const q = ctx.query
  let view = ctx.db.invoices.map((i) => presentInvoice(ctx.db, i))
  if (q.status) view = view.filter((i) => i.status === q.status)
  if (q.courseId) view = view.filter((i) => studentOf(ctx.db, i.studentId)?.courseId === q.courseId)
  return listResponse(view, q, {
    searchText: (i) => `${i.number} ${i.studentName} ${i.studentId}`,
    dateOf: (i) => i.date,
    defaultSort: 'date',
    defaultOrder: 'desc',
    sorters: { date: (i) => i.date + i.number, number: (i) => i.number, student: (i) => (i.studentName ?? '').toLowerCase(), total: (i) => i.total, balance: (i) => i.balance, status: (i) => i.status },
  })
})

get('/invoices/:id', 'invoices:view', (ctx) => {
  const inv = ctx.db.invoices.find((i) => i.id === ctx.params.id)
  if (!inv) throw notFound('Invoice')
  const s = studentOf(ctx.db, inv.studentId)!
  return {
    ...presentInvoice(ctx.db, inv),
    student: { id: s.id, fullName: s.fullName, email: s.email, phone: s.phone, address: s.address, city: s.city, state: s.state, postalCode: s.postalCode },
    payments: ctx.db.payments.filter((p) => p.invoiceId === inv.id).sort((a, b) => a.paymentDate.localeCompare(b.paymentDate)).map((p) => presentPayment(ctx.db, p)),
  }
})

