/** Display helpers for enum codes and the status → visual tone mapping. */

const OVERRIDES: Record<string, string> = {
  UPI: 'UPI',
  AI_ML: 'AI / ML',
  ID_PROOF: 'ID Proof',
  WALK_IN: 'Walk-in',
  FOLLOW_UP: 'Follow-up',
  NOT_INTERESTED: 'Not Interested',
  PAYMENT_GATEWAY: 'Payment Gateway',
  PHONE_CALL: 'Phone Call',
  WHATSAPP: 'WhatsApp',
  YOUTUBE: 'YouTube',
  SUPER_ADMIN: 'Super Admin',
  FULL_STACK_DEVELOPMENT: 'Full Stack Development',
  MON: 'Mon',
  TUE: 'Tue',
  WED: 'Wed',
  THU: 'Thu',
  FRI: 'Fri',
  SAT: 'Sat',
  SUN: 'Sun',
}

export function humanize(code: string | null | undefined): string {
  if (!code) return '—'
  if (OVERRIDES[code]) return OVERRIDES[code]
  return code
    .toLowerCase()
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

export type Tone = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'brand' | 'purple'

/** Tone for every status-like code in the system. */
export const STATUS_TONES: Record<string, Tone> = {
  // generic
  ACTIVE: 'success',
  INACTIVE: 'neutral',
  // leads
  NEW: 'info',
  CONTACTED: 'info',
  COUNSELLING_SCHEDULED: 'purple',
  COUNSELLING_COMPLETED: 'purple',
  INTERESTED: 'brand',
  NOT_INTERESTED: 'neutral',
  FOLLOW_UP: 'warning',
  CONVERTED: 'success',
  LOST: 'danger',
  // priority
  LOW: 'neutral',
  MEDIUM: 'warning',
  HIGH: 'danger',
  // follow-ups
  PENDING: 'warning',
  COMPLETED: 'success',
  RESCHEDULED: 'info',
  CANCELLED: 'neutral',
  // applications
  COUNSELLING: 'purple',
  APPLICATION_SUBMITTED: 'info',
  ADMISSION_APPROVED: 'brand',
  PAYMENT_PENDING: 'warning',
  PAYMENT_COMPLETED: 'success',
  BATCH_ASSIGNED: 'brand',
  TRAINING_STARTED: 'purple',
  TRAINING_COMPLETED: 'success',
  // students
  ON_HOLD: 'warning',
  DROPPED: 'danger',
  // batches
  UPCOMING: 'info',
  // attendance
  PRESENT: 'success',
  ABSENT: 'danger',
  LATE: 'warning',
  EXCUSED: 'info',
  // submissions
  NOT_STARTED: 'neutral',
  SUBMITTED: 'info',
  REVIEWED: 'success',
  // finance
  PAID: 'success',
  PARTIALLY_PAID: 'warning',
  OVERDUE: 'danger',
  SUCCESS: 'success',
  FAILED: 'danger',
  REFUNDED: 'purple',
  // misc
  REMOVED: 'neutral',
  TRANSFERRED: 'info',
}

export function toneFor(status: string): Tone {
  return STATUS_TONES[status] ?? 'neutral'
}

export function optionsFrom<T extends string>(values: readonly T[], labels?: Partial<Record<T, string>>) {
  return values.map((v) => ({ value: v, label: labels?.[v] ?? humanize(v) }))
}

/** Group course names into the dashboard chart buckets. */
export function courseGroup(code: string): string {
  if (code === 'DOTNET') return '.NET'
  if (code === 'JAVA') return 'Java'
  if (code === 'PYTHON') return 'Python'
  if (code === 'MERN') return 'Full Stack'
  if (code === 'VIDEO') return 'Video Editing'
  return 'Other'
}
