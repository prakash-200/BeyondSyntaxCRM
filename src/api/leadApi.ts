import type { ListParams, Lead, FollowUp, AuditLog, Paged, FollowUpBucket } from '@/types'
import { http } from './apiClient'

export type LeadInput = Pick<Lead, 'name' | 'phone' | 'email' | 'location' | 'education' | 'interestedCourseId' | 'source' | 'assignedToId' | 'priority'> & {
  status?: Lead['status']
  notes?: string
}

export interface FollowUpInput {
  entityType?: 'LEAD' | 'STUDENT'
  entityId: string
  employeeId?: string
  date: string
  time: string
  type: FollowUp['type']
  notes: string
}

export const leadApi = {
  list: (params: ListParams) => http.get<Paged<Lead>>('/leads', params),
  get: (id: string) => http.get<Lead>(`/leads/${id}`),
  create: (body: LeadInput) => http.post<Lead>('/leads', body),
  update: (id: string, body: Partial<LeadInput>) => http.put<Lead>(`/leads/${id}`, body),
  remove: (id: string) => http.delete<{ ok: boolean }>(`/leads/${id}`),
  addNote: (id: string, text: string) => http.post<Lead>(`/leads/${id}/notes`, { text }),
  assign: (id: string, employeeId: string) => http.post<Lead>(`/leads/${id}/assign`, { employeeId }),
  convert: (id: string, body: { mode: 'application' | 'student'; courseId?: string; preferredBatchId?: string | null; dateOfBirth?: string; gender?: string; city?: string; education?: string }) =>
    http.post<{ leadId: string; applicationId: string; studentId: string | null }>(`/leads/${id}/convert`, body),
  followUps: (id: string) => http.get<FollowUp[]>(`/leads/${id}/followups`),
  activity: (id: string) => http.get<AuditLog[]>(`/leads/${id}/activity`),
}

export const followUpApi = {
  list: (params: ListParams & { bucket?: FollowUpBucket }) => http.get<Paged<FollowUp>>('/follow-ups', params),
  counts: () => http.get<Record<FollowUpBucket, number>>('/follow-ups/counts'),
  create: (body: FollowUpInput) => http.post<FollowUp>('/follow-ups', body),
  update: (id: string, body: Partial<FollowUpInput>) => http.put<FollowUp>(`/follow-ups/${id}`, body),
  complete: (id: string, body: { outcome: string; leadStatus?: Lead['status'] }) => http.post<FollowUp>(`/follow-ups/${id}/complete`, body),
  reschedule: (id: string, body: { date: string; time: string; reason?: string }) => http.post<FollowUp>(`/follow-ups/${id}/reschedule`, body),
  cancel: (id: string) => http.post<FollowUp>(`/follow-ups/${id}/cancel`),
}
