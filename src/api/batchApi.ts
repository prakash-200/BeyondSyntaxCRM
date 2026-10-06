import type { AuditLog, Batch, BatchProgress, BatchStudent, ClassSession, ListParams, Paged } from '@/types'
import { http } from './apiClient'

export type BatchInput = Partial<Pick<Batch, 'name' | 'courseId' | 'trainerId' | 'startDate' | 'endDate' | 'startTime' | 'endTime' | 'days' | 'capacity' | 'mode' | 'location' | 'status'>>

export const batchApi = {
  list: (params: ListParams) => http.get<Paged<Batch>>('/batches', params),
  get: (id: string) => http.get<Batch>(`/batches/${id}`),
  create: (body: BatchInput) => http.post<Batch>('/batches', body),
  update: (id: string, body: BatchInput) => http.put<Batch>(`/batches/${id}`, body),
  students: (id: string, includeHistory = false) => http.get<BatchStudent[]>(`/batches/${id}/students`, { includeHistory }),
  eligibleStudents: (id: string) => http.get<{ id: string; fullName: string; phone: string }[]>(`/batches/${id}/eligible-students`),
  assignStudent: (id: string, studentId: string) => http.post<Batch>(`/batches/${id}/students`, { studentId }),
  removeStudent: (id: string, studentId: string, reason: string) => http.post<Batch>(`/batches/${id}/students/${studentId}/remove`, { reason }),
  transferStudent: (id: string, body: { studentId: string; toBatchId: string; reason: string }) => http.post<Batch>(`/batches/${id}/transfer`, body),
  sessions: (id: string, limit = 60) => http.get<ClassSession[]>(`/batches/${id}/sessions`, { limit }),
  progress: (id: string) => http.get<BatchProgress>(`/batches/${id}/progress`),
  activity: (id: string) => http.get<AuditLog[]>(`/batches/${id}/activity`),
}

export type { Paged }
