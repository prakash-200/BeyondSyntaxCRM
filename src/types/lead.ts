import type { FollowUpStatus, FollowUpType, LeadSource, LeadStatus, Priority } from '@/constants/enums'
import type { DateString, DateTimeString, Id, SoftDeletable } from './common'

export interface LeadNote {
  id: Id
  text: string
  createdById: Id
  createdByName: string
  createdAt: DateTimeString
}

export interface Lead extends SoftDeletable {
  id: Id
  name: string
  phone: string
  email: string
  location: string
  education: string
  interestedCourseId: Id
  interestedCourseName?: string
  source: LeadSource
  assignedToId: Id
  assignedToName?: string
  status: LeadStatus
  priority: Priority
  createdAt: DateTimeString
  nextFollowUp?: DateString | null
  notes: LeadNote[]
  applicationId?: Id | null
  studentId?: Id | null
}

export interface FollowUp {
  id: Id
  entityType: 'LEAD' | 'STUDENT'
  entityId: Id
  entityName: string
  courseName?: string
  employeeId: Id
  employeeName?: string
  date: DateString
  time: string
  type: FollowUpType
  notes: string
  outcome?: string
  status: FollowUpStatus
  createdAt: DateTimeString
}

export type FollowUpBucket = 'today' | 'upcoming' | 'overdue' | 'completed' | 'all'
