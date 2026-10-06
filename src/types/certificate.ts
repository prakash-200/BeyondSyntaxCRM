import type { DateString, Id } from './common'

export interface Certificate {
  id: Id
  studentId: Id
  studentName?: string
  courseId: Id
  courseName?: string
  batchId?: Id | null
  batchName?: string
  startDate: DateString
  completionDate: DateString
  issuedDate: DateString
  issuedById: Id
  issuedByName?: string
}

export interface EligibleStudent {
  studentId: Id
  studentName: string
  courseName: string
  batchName?: string
  progressPercent: number
  attendancePercent: number
  completed: boolean
}

export interface CertificateVerification {
  valid: boolean
  certificate?: Certificate
}
