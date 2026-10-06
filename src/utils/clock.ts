import { format } from 'date-fns'

/**
 * The demo dataset is generated relative to a fixed anchor so the numbers on
 * screen are stable. Time advances from the anchor while the app is open.
 * When a real backend is connected this module is simply `new Date()`.
 */
const ANCHOR = new Date(2026, 9, 5, 11, 0, 0)
const LOADED_AT = Date.now()

export function now(): Date {
  return new Date(ANCHOR.getTime() + (Date.now() - LOADED_AT))
}

/** Today as YYYY-MM-DD */
export function today(): string {
  return format(now(), 'yyyy-MM-dd')
}

export function nowIso(): string {
  return now().toISOString()
}

export const ANCHOR_DATE = ANCHOR
