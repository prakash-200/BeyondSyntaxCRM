import type { BatchStatus, CourseMode, Weekday } from '@/constants/enums'
import type { DateString, DateTimeString, Id } from './common'

export interface Batch {
  id: Id
  name: string
  courseId: Id
  courseName?: string
  trainerId: Id
  trainerName?: string
  startDate: DateString
  endDate: DateString
  startTime: string
  endTime: string
  days: Weekday[]
  capacity: number
  currentStudentCount: number
  mode: CourseMode
  location: string
  status: BatchStatus
}

export interface BatchStudent {
  id: Id
  batchId: Id
  studentId: Id
  studentName?: string
  studentPhone?: string
  studentStatus?: string
  joinedAt: DateTimeString
  status: 'ACTIVE' | 'REMOVED' | 'TRANSFERRED'
  fromBatchId?: Id | null
  reason?: string
  attendancePercent?: number
  progressPercent?: number
}
