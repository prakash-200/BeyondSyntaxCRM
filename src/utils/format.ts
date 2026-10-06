import { format, isValid, parseISO } from 'date-fns'

const inr = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
})
const num = new Intl.NumberFormat('en-IN')

export const formatCurrency = (value: number | null | undefined) => inr.format(value ?? 0)
export const formatNumber = (value: number | null | undefined) => num.format(value ?? 0)

/** Compact INR for charts: ₹4.2L, ₹1.1Cr */
export function formatCompactCurrency(value: number): string {
  const abs = Math.abs(value)
  if (abs >= 1e7) return `₹${(value / 1e7).toFixed(1)}Cr`
  if (abs >= 1e5) return `₹${(value / 1e5).toFixed(1)}L`
  if (abs >= 1e3) return `₹${(value / 1e3).toFixed(0)}K`
  return `₹${value}`
}

function toDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null
  const d = value instanceof Date ? value : parseISO(value)
  return isValid(d) ? d : null
}

/** 05-Oct-2026 */
export function formatDate(value: string | Date | null | undefined): string {
  const d = toDate(value)
  return d ? format(d, 'dd-MMM-yyyy') : '—'
}

/** 05-Oct 15:30 */
export function formatDateTime(value: string | Date | null | undefined): string {
  const d = toDate(value)
  return d ? format(d, 'dd-MMM-yyyy HH:mm') : '—'
}

export function formatShortDateTime(value: string | Date | null | undefined): string {
  const d = toDate(value)
  return d ? format(d, 'dd-MMM HH:mm') : '—'
}

/** "19:00" → "7:00 PM" */
export function formatTime(value: string | null | undefined): string {
  if (!value) return '—'
  const [h, m] = value.split(':').map(Number)
  const suffix = h >= 12 ? 'PM' : 'AM'
  const hour = h % 12 === 0 ? 12 : h % 12
  return `${hour}:${String(m).padStart(2, '0')} ${suffix}`
}

/** +91 98765 43210 */
export function formatPhone(value: string | null | undefined): string {
  if (!value) return '—'
  const digits = value.replace(/\D/g, '').slice(-10)
  if (digits.length !== 10) return value
  return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`
}

export function formatPercent(value: number, digits = 1): string {
  return `${value.toFixed(digits).replace(/\.0+$/, '')}%`
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('')
}

export const formatChange = (value: number) => `${value > 0 ? '+' : ''}${value.toFixed(1)}%`

export function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return `${formatNumber(count)} ${count === 1 ? singular : plural}`
}
