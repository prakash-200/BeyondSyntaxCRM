import type { FeeStatus, StudentStatus } from '@/constants/enums'
import type { Installment, Payment, Refund } from '@/types'

/** Pure business calculations — shared by the mock API and (where useful) the UI. */

export const pct = (part: number, whole: number, digits = 1): number =>
  whole <= 0 ? 0 : Number(((part / whole) * 100).toFixed(digits))

/** Percent change from `previous` to `current`. Returns 0 when there is no baseline. */
export function percentChange(current: number, previous: number): number {
  if (previous === 0) return current === 0 ? 0 : 100
  return Number((((current - previous) / previous) * 100).toFixed(1))
}

export const sum = (values: number[]): number => values.reduce((a, b) => a + b, 0)

export const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

/** Attendance % — present (and late) classes over total classes. Excused classes are excluded. */
export function attendancePercent(present: number, late: number, absent: number): number {
  const total = present + late + absent
  return pct(present + late, total)
}

/** Course progress % — average of module completion percentages. */
export function overallProgress(modulePercents: number[]): number {
  if (!modulePercents.length) return 0
  return Number((sum(modulePercents) / modulePercents.length).toFixed(1))
}

export function discountedFee(courseFee: number, discount: number, scholarship: number): number {
  return Math.max(0, courseFee - discount - scholarship)
}

/** Money actually collected: successful payments minus refunds. */
export function netPaid(payments: Pick<Payment, 'amount' | 'status'>[], refunds: Pick<Refund, 'amount'>[]): number {
  const gross = sum(payments.filter((p) => p.status === 'SUCCESS').map((p) => p.amount))
  return Math.max(0, gross - sum(refunds.map((r) => r.amount)))
}

/**
 * Outstanding balance. Never negative. Closed accounts (dropped / cancelled
 * students) carry no outstanding balance.
 */
export function outstanding(finalFee: number, paid: number, studentStatus?: StudentStatus): number {
  if (studentStatus === 'DROPPED' || studentStatus === 'CANCELLED') return 0
  return Math.max(0, finalFee - paid)
}

export function feeStatus(
  finalFee: number,
  paid: number,
  installments: Pick<Installment, 'status'>[],
): FeeStatus {
  if (paid >= finalFee) return 'PAID'
  if (installments.some((i) => i.status === 'OVERDUE')) return 'OVERDUE'
  if (paid > 0) return 'PARTIALLY_PAID'
  return 'PENDING'
}

/** Split an amount into n installments; the remainder lands on the first ones. */
export function splitAmount(total: number, parts: number): number[] {
  const base = Math.floor(total / parts)
  const remainder = total - base * parts
  return Array.from({ length: parts }, (_, i) => base + (i < remainder ? 1 : 0))
}
