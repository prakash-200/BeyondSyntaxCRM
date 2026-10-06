import type { Gender, LeadSource, StudentStatus } from '@/constants/enums'
import type { DateString, DateTimeString, Id, SoftDeletable } from './common'

export interface Student extends SoftDeletable {
  id: Id
  fullName: string
  phone: string
  email: string
  dateOfBirth: DateString
  gender: Gender
  address: string
  city: string
  state: string
  postalCode: string
  education: string
  college: string
  graduationYear: number
  experience: string
  currentOccupation: string
  source: LeadSource
  counselorId: Id
  counselorName?: string
  status: StudentStatus
  leadId?: Id | null
  applicationId?: Id | null
  courseId: Id
  courseName?: string
  batchId?: Id | null
  batchName?: string
  trainerName?: string
  admissionDate: DateString
  completedAt?: DateString | null
  certificateId?: Id | null
  createdAt: DateTimeString
}

/** Computed figures shown on the student overview. */
export interface StudentSummary {
  progressPercent: number
  attendancePercent: number
  totalClasses: number
  presentClasses: number
  totalFee: number
  paidAmount: number
  outstandingAmount: number
  nextDueDate?: DateString | null
  nextDueAmount?: number
}

export interface StudentListItem extends Student {
  progressPercent: number
  outstandingAmount?: number
}

export interface StudentDetail extends Student {
  summary: StudentSummary | null
}

export interface ImportRow {
  fullName: string
  phone: string
  email: string
  courseCode?: string
  city?: string
}

export interface ImportResult {
  created: number
  skipped: { row: number; reason: string }[]
}
