import type { AuditLog } from './audit'
import type { Batch } from './batch'
import type { Id } from './common'
import type { FollowUp } from './lead'

export interface KpiValue {
  value: number
  /** Percent change versus the comparison period. */
  change: number
}

export interface DashboardSummary {
  kpis: {
    totalLeads: KpiValue
    totalStudents: KpiValue
    activeStudents: KpiValue
    activeBatches: KpiValue
    newApplications: KpiValue
    pendingPayments: KpiValue
    monthlyRevenue: KpiValue
    outstandingFees: KpiValue
    conversionRate: number
  }
  revenueTrend: { day: number; current: number | null; previous: number | null }[]
  monthlyRevenue: { month: string; revenue: number }[]
  funnel: { stage: string; count: number }[]
  courseDistribution: { name: string; value: number }[]
  paymentStatus: { status: string; count: number; amount: number }[]
  upcomingFollowUps: FollowUp[]
  overdueFollowUps: FollowUp[]
  recentActivity: AuditLog[]
  overdueInstallments: number
}

export interface TrainerDashboard {
  myBatches: Batch[]
  myStudents: number
  todaysClasses: {
    batchId: Id
    batchName: string
    courseName: string
    startTime: string
    endTime: string
    marked: boolean
  }[]
  attendanceAverage: number
  pendingReviews: number
  progressAverage: number
  lowAttendance: { studentId: Id; studentName: string; batchName: string; percent: number }[]
}

export interface LeadReport {
  total: number
  converted: number
  lost: number
  conversionRate: number
  bySource: { source: string; leads: number; converted: number; rate: number }[]
  byStatus: { status: string; count: number }[]
  byMonth: { month: string; leads: number; converted: number }[]
}

export interface FinancialReport {
  totalRevenue: number
  collected: number
  outstanding: number
  overdue: number
  refunds: number
  byMonth: { month: string; collected: number; refunds: number }[]
  byMethod: { method: string; amount: number }[]
  byCourse: { course: string; billed: number; collected: number; outstanding: number }[]
}

export interface StudentReportRow {
  id: Id
  fullName: string
  courseName: string
  batchName: string
  status: string
  counselorName: string
  admissionDate: string
  progressPercent: number
  attendancePercent: number
}

export interface EmployeePerformance {
  counselors: {
    id: Id
    name: string
    leadsAssigned: number
    leadsContacted: number
    admissions: number
    conversionRate: number
  }[]
  trainers: {
    id: Id
    name: string
    students: number
    attendancePercent: number
    completionRate: number
  }[]
}

export interface BusinessReport {
  admissionsByMonth: { month: string; admissions: number }[]
  revenueByCourse: { course: string; revenue: number }[]
  batchUtilization: { batch: string; enrolled: number; capacity: number }[]
  completionRate: number
  dropRate: number
}

export interface SearchHit {
  id: Id
  title: string
  subtitle: string
}

export interface SearchResults {
  students: SearchHit[]
  leads: SearchHit[]
  applications: SearchHit[]
  payments: SearchHit[]
  courses: SearchHit[]
  batches: SearchHit[]
}

export interface AppSettings {
  companyName: string
  legalName: string
  address: string
  phone: string
  email: string
  gstin: string
  taxRate: number
  currency: string
  invoicePrefix: string
  minAttendanceAlert: number
  certificateMinProgress: number
}
