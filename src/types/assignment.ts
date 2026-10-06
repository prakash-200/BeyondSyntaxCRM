import type { SubmissionStatus } from '@/constants/enums'
import type { DateString, DateTimeString, Id } from './common'

export interface Assignment {
  id: Id
  courseId: Id
  courseName?: string
  moduleId: Id
  moduleName?: string
  batchId: Id
  batchName?: string
  title: string
  description: string
  dueDate: DateString
  maxMarks: number
  submittedCount?: number
  reviewedCount?: number
  totalCount?: number
}

export interface AssignmentSubmission {
  id: Id
  assignmentId: Id
  assignmentTitle?: string
  maxMarks?: number
  studentId: Id
  studentName?: string
  status: SubmissionStatus
  score?: number | null
  feedback: string
  submittedAt?: DateTimeString | null
  reviewedAt?: DateTimeString | null
}
