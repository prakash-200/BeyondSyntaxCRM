import type {
  Application,
  Batch,
  Course,
  FeePlan,
  FollowUp,
  Installment,
  Invoice,
  Lead,
  Payment,
  Student,
  StudentProgressDetail,
  StudentSummary,
  AttendanceSummaryRow,
} from '@/types'
import { attendancePercent, feeStatus, netPaid, outstanding, overallProgress } from '@/utils/calc'
import { today } from '@/utils/clock'
import type { Db, StoredFeePlan, StoredInvoice } from '../db'

/** Joins and derived fields — the equivalent of API DTO projections. */

export const employeeName = (db: Db, id?: string | null) => db.employees.find((e) => e.id === id)?.name ?? '—'
export const courseOf = (db: Db, id?: string | null) => db.courses.find((c) => c.id === id)
export const batchOf = (db: Db, id?: string | null) => db.batches.find((b) => b.id === id)
export const studentOf = (db: Db, id?: string | null) => db.students.find((s) => s.id === id)

export function presentLead(db: Db, l: Lead): Lead {
  return { ...l, interestedCourseName: courseOf(db, l.interestedCourseId)?.name, assignedToName: employeeName(db, l.assignedToId) }
}

export function presentFollowUp(db: Db, fu: FollowUp): FollowUp {
  return { ...fu, employeeName: employeeName(db, fu.employeeId) }
}

export function presentApplication(db: Db, a: Application): Application {
  return {
    ...a,
    courseName: courseOf(db, a.courseId)?.name,
    preferredBatchName: batchOf(db, a.preferredBatchId)?.name,
    counselorName: employeeName(db, a.counselorId),
    documentCount: db.documents.filter((d) => !d.deletedAt && (d.ownerId === a.id || (a.studentId && d.ownerId === a.studentId))).length,
  }
}

export function presentStudent(db: Db, s: Student): Student {
  const batch = batchOf(db, s.batchId)
  return {
    ...s,
    counselorName: employeeName(db, s.counselorId),
    courseName: courseOf(db, s.courseId)?.name,
    batchName: batch?.name,
    trainerName: batch ? employeeName(db, batch.trainerId) : undefined,
  }
}

export function presentBatch(db: Db, b: Batch): Batch {
  return {
    ...b,
    courseName: courseOf(db, b.courseId)?.name,
    trainerName: employeeName(db, b.trainerId),
    currentStudentCount: db.batchStudents.filter((x) => x.batchId === b.id && x.status === 'ACTIVE').length,
  }
}

export function presentCourse(db: Db, c: Course): Course {
  return {
    ...c,
    moduleCount: db.modules.filter((m) => m.courseId === c.id && m.status === 'ACTIVE').length,
    activeBatches: db.batches.filter((b) => b.courseId === c.id && (b.status === 'ACTIVE' || b.status === 'UPCOMING')).length,
    studentCount: db.students.filter((s) => s.courseId === c.id && !s.deletedAt).length,
  }
}

/* ───────────── finance ───────────── */

export function installmentView(i: Installment): Installment {
  if (i.status === 'PENDING' && i.dueDate < today()) return { ...i, status: 'OVERDUE' }
  return i
}

/** Money collected for a student: successful payments minus refunds of still-successful payments. */
export function moneyFor(db: Db, studentId: string) {
  const payments = db.payments.filter((p) => p.studentId === studentId)
  const successIds = new Set(payments.filter((p) => p.status === 'SUCCESS').map((p) => p.id))
  const refunds = db.refunds.filter((r) => r.studentId === studentId && successIds.has(r.paymentId))
  return { paid: netPaid(payments, refunds), refundedTotal: db.refunds.filter((r) => r.studentId === studentId).reduce((s, r) => s + r.amount, 0) }
}

export function feePlanView(db: Db, plan: StoredFeePlan): FeePlan {
  const student = studentOf(db, plan.studentId)
  const insts = db.installments.filter((i) => i.feePlanId === plan.id).sort((a, b) => a.number - b.number).map(installmentView)
  const { paid, refundedTotal } = moneyFor(db, plan.studentId)
  const out = outstanding(plan.finalFee, paid, student?.status)
  return {
    ...plan,
    studentName: student?.fullName,
    courseName: courseOf(db, plan.courseId)?.name,
    paid,
    refunded: refundedTotal,
    outstanding: out,
    status: student?.status === 'DROPPED' || student?.status === 'CANCELLED' ? (paid > 0 ? 'PARTIALLY_PAID' : 'PENDING') : feeStatus(plan.finalFee, paid, insts),
    installments: insts,
  }
}

export function presentPayment(db: Db, p: Payment): Payment {
  const inv = db.invoices.find((i) => i.id === p.invoiceId)
  return {
    ...p,
    studentName: studentOf(db, p.studentId)?.fullName,
    invoiceNumber: inv?.number,
    recordedByName: employeeName(db, p.recordedById),
  }
}

export function presentInvoice(db: Db, inv: StoredInvoice): Invoice {
  const plan = db.feePlans.find((p) => p.id === inv.feePlanId)!
  const view = feePlanView(db, plan)
  return {
    ...inv,
    studentName: studentOf(db, inv.studentId)?.fullName,
    courseName: courseOf(db, plan.courseId)?.name,
    paid: view.paid,
    balance: Math.max(0, inv.total + inv.taxAmount - view.paid),
    status: view.status,
  }
}

/* ───────────── progress & attendance ───────────── */

export function progressOf(db: Db, studentId: string): StudentProgressDetail {
  const student = studentOf(db, studentId)
  const mods = db.modules.filter((m) => m.courseId === student?.courseId && m.status === 'ACTIVE').sort((a, b) => a.sequence - b.sequence)
  const rows = mods.map((m) => ({
    moduleId: m.id,
    name: m.name,
    sequence: m.sequence,
    percent: db.progress.find((p) => p.studentId === studentId && p.moduleId === m.id)?.percent ?? 0,
  }))
  return { overallPercent: overallProgress(rows.map((r) => r.percent)), modules: rows }
}

export function attendanceStatsFor(db: Db, studentId: string): AttendanceSummaryRow {
  let present = 0
  let absent = 0
  let late = 0
  let excused = 0
  for (const a of db.attendance) {
    if (a.studentId !== studentId) continue
    if (a.status === 'PRESENT') present++
    else if (a.status === 'ABSENT') absent++
    else if (a.status === 'LATE') late++
    else excused++
  }
  return {
    studentId,
    studentName: studentOf(db, studentId)?.fullName ?? '',
    totalClasses: present + absent + late + excused,
    present,
    absent,
    late,
    excused,
    percent: attendancePercent(present, late, absent),
  }
}

export function studentSummary(db: Db, studentId: string): StudentSummary {
  const plan = db.feePlans.find((p) => p.studentId === studentId)
  const view = plan ? feePlanView(db, plan) : null
  const att = attendanceStatsFor(db, studentId)
  const next = view?.installments.filter((i) => i.status === 'PENDING' || i.status === 'OVERDUE').sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0]
  return {
    progressPercent: progressOf(db, studentId).overallPercent,
    attendancePercent: att.percent,
    totalClasses: att.totalClasses,
    presentClasses: att.present + att.late,
    totalFee: view?.finalFee ?? 0,
    paidAmount: view?.paid ?? 0,
    outstandingAmount: view?.outstanding ?? 0,
    nextDueDate: next?.dueDate ?? null,
    nextDueAmount: next ? next.amount - next.paidAmount : 0,
  }
}

export const activeBatchStudents = (db: Db, batchId: string) => db.batchStudents.filter((x) => x.batchId === batchId && x.status === 'ACTIVE')
