import type { ActiveState, Role } from '@/constants/enums'
import type { DateString, Id } from './common'

export interface Employee {
  id: Id
  name: string
  email: string
  phone: string
  role: Role
  department: string
  joiningDate: DateString
  status: ActiveState
  specialization?: string
  courseIds?: Id[]
}

export interface Trainer extends Employee {
  activeBatches: number
  totalBatches: number
  studentCount: number
  courseNames: string[]
}
