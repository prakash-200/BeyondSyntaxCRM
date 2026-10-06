import type { ApplicationStatus } from '@/constants/enums'
import type { Application, AuditLog, ListParams, Paged, Student } from '@/types'
import { http } from './apiClient'

export interface ApplicationInput {
  leadId?: string | null
  applicantName?: string
  phone?: string
  email?: string
  courseId?: string
  preferredBatchId?: string | null
  counselorId?: string
  notes?: string
}

export interface ApprovalInput {
  admissionDate?: string
  dateOfBirth?: string
  gender?: Student['gender']
  city?: string
  state?: string
  education?: string
}

export const applicationApi = {
  list: (params: ListParams) => http.get<Paged<Application>>('/applications', params),
  get: (id: string) => http.get<Application>(`/applications/${id}`),
  create: (body: ApplicationInput) => http.post<Application>('/applications', body),
  update: (id: string, body: ApplicationInput) => http.put<Application>(`/applications/${id}`, body),
  setStatus: (id: string, body: { status: ApplicationStatus; note?: string }) => http.post<Application>(`/applications/${id}/status`, body),
  approve: (id: string, body: ApprovalInput) => http.post<{ application: Application; studentId: string }>(`/applications/${id}/approve`, body),
  activity: (id: string) => http.get<AuditLog[]>(`/applications/${id}/activity`),
}
