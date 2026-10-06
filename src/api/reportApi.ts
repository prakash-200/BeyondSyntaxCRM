import type {
  AppSettings,
  BusinessReport,
  DashboardSummary,
  EmployeePerformance,
  FinancialReport,
  LeadReport,
  ListParams,
  Lookups,
  Paged,
  SearchResults,
  StudentReportRow,
  TrainerDashboard,
} from '@/types'
import { http } from './apiClient'

export const dashboardApi = {
  summary: () => http.get<DashboardSummary>('/dashboard/summary'),
  trainer: () => http.get<TrainerDashboard>('/dashboard/trainer'),
}

export const reportApi = {
  students: (params: ListParams) => http.get<Paged<StudentReportRow>>('/reports/students', params),
  leads: (params: ListParams) => http.get<LeadReport>('/reports/leads', params),
  financial: (params: ListParams) => http.get<FinancialReport>('/reports/financial', params),
  employees: () => http.get<EmployeePerformance>('/reports/employees'),
  business: () => http.get<BusinessReport>('/reports/business'),
}

export const commonApi = {
  lookups: () => http.get<Lookups>('/lookups'),
  search: (q: string) => http.get<SearchResults>('/search', { q }),
  settings: () => http.get<AppSettings>('/settings'),
  updateSettings: (body: Partial<AppSettings>) => http.put<AppSettings>('/settings', body),
}
