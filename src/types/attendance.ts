import type { AttendanceStatus } from '@/constants/enums'
import type { DateString, Id } from './common'

export interface ClassSession {
  id: Id
  batchId: Id
  batchName?: string
  courseName?: string
  date: DateString
  trainerId: Id
  trainerName?: string
  topic: string
  moduleId?: Id | null
  presentCount?: number
  totalCount?: number
  marked?: boolean
}

export interface Attendance {
  id: Id
  sessionId: Id
  studentId: Id
  status: AttendanceStatus
}

export interface AttendanceRosterRow {
  studentId: Id
  studentName: string
  status: AttendanceStatus
}

export interface AttendanceSessionDetail extends ClassSession {
  roster: AttendanceRosterRow[]
}

export interface AttendanceSummaryRow {
  studentId: Id
  studentName: string
  totalClasses: number
  present: number
  absent: number
  late: number
  excused: number
  percent: number
}

export interface StudentAttendanceDetail {
  summary: AttendanceSummaryRow
  records: { sessionId: Id; date: DateString; topic: string; status: AttendanceStatus }[]
}
