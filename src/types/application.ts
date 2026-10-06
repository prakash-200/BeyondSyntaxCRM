import type { ApplicationStatus } from '@/constants/enums'
import type { DateString, DateTimeString, Id } from './common'

export interface ApplicationHistoryEntry {
  status: ApplicationStatus
  at: DateTimeString
  byId: Id
  byName: string
  note?: string
}

export interface Application {
  id: Id
  leadId?: Id | null
  studentId?: Id | null
  applicantName: string
  phone: string
  email: string
  courseId: Id
  courseName?: string
  preferredBatchId?: Id | null
  preferredBatchName?: string
  applicationDate: DateString
  counselorId: Id
  counselorName?: string
  status: ApplicationStatus
  notes: string
  admissionDate?: DateString | null
  documentCount?: number
  history: ApplicationHistoryEntry[]
  certificateId?: Id | null
}
