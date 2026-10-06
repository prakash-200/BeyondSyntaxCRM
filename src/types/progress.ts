import type { Id } from './common'

export interface StudentProgress {
  studentId: Id
  moduleId: Id
  percent: number
}

export interface StudentProgressDetail {
  overallPercent: number
  modules: { moduleId: Id; name: string; sequence: number; percent: number }[]
}

export interface BatchProgressRow {
  studentId: Id
  studentName: string
  overallPercent: number
  modules: Record<Id, number>
}

export interface BatchProgress {
  modules: { id: Id; name: string; sequence: number }[]
  rows: BatchProgressRow[]
}
