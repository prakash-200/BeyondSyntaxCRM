import type { ActiveState, CourseCategory, CourseMode } from '@/constants/enums'
import type { Id, SoftDeletable } from './common'

export interface DiscountRule {
  label: string
  percent: number
}

export interface Course extends SoftDeletable {
  id: Id
  code: string
  name: string
  category: CourseCategory
  description: string
  durationMonths: number
  mode: CourseMode
  totalFee: number
  discountRules: DiscountRule[]
  status: ActiveState
  moduleCount?: number
  activeBatches?: number
  studentCount?: number
}

export interface CourseModule {
  id: Id
  courseId: Id
  name: string
  description: string
  sequence: number
  durationWeeks: number
  status: ActiveState
}
