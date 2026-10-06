import type { StudentStatus } from '@/constants/enums'
import type {
  Application,
  AssignmentSubmission,
  AuditLog,
  BatchStudent,
  FeePlan,
  ImportResult,
  ImportRow,
  ListParams,
  Paged,
  Payment,
  Student,
  StudentAttendanceDetail,
  StudentDetail,
  StudentListItem,
  StudentProgressDetail,
  StoredDocument,
} from '@/types'
import { http } from './apiClient'

export type StudentInput = Partial<Omit<Student, 'id' | 'createdAt' | 'status'>>

export const studentApi = {
  list: (params: ListParams) => http.get<Paged<StudentListItem>>('/students', params),
  export: (params: ListParams) => http.get<StudentListItem[]>('/students/export', params),
  import: (rows: ImportRow[]) => http.post<ImportResult>('/students/import', { rows }),
  get: (id: string) => http.get<StudentDetail>(`/students/${id}`),
  create: (body: StudentInput) => http.post<Student>('/students', body),
  update: (id: string, body: StudentInput) => http.put<Student>(`/students/${id}`, body),
  remove: (id: string) => http.delete<{ ok: boolean }>(`/students/${id}`),
  setStatus: (id: string, body: { status: StudentStatus; reason?: string }) => http.post<Student>(`/students/${id}/status`, body),
  complete: (id: string, body: { reason?: string }) => http.post<Student>(`/students/${id}/complete`, body),
  payments: (id: string) => http.get<Payment[]>(`/students/${id}/payments`),
  feePlan: (id: string) => http.get<FeePlan | null>(`/students/${id}/fee-plan`),
  attendance: (id: string) => http.get<StudentAttendanceDetail>(`/students/${id}/attendance`),
  progress: (id: string) => http.get<StudentProgressDetail>(`/students/${id}/progress`),
  updateProgress: (id: string, body: { moduleId: string; percent: number }) => http.put<StudentProgressDetail>(`/students/${id}/progress`, body),
  assignments: (id: string) => http.get<(AssignmentSubmission & { dueDate?: string })[]>(`/students/${id}/assignments`),
  activity: (id: string) => http.get<AuditLog[]>(`/students/${id}/activity`),
  batchHistory: (id: string) => http.get<(BatchStudent & { batchName?: string; fromBatchName?: string })[]>(`/students/${id}/batch-history`),
  application: (id: string) => http.get<Application | null>(`/students/${id}/application`),
}

export const documentApi = {
  list: (ownerId: string, ownerType?: StoredDocument['ownerType']) => http.get<StoredDocument[]>('/documents', { ownerId, ownerType }),
  /** Mock upload: sends metadata only. Swap for multipart/form-data or a pre-signed URL upload against cloud storage. */
  upload: (body: Pick<StoredDocument, 'ownerType' | 'ownerId' | 'category' | 'fileName' | 'sizeBytes' | 'mimeType'>) => http.post<StoredDocument>('/documents', body),
  remove: (id: string) => http.delete<{ ok: boolean }>(`/documents/${id}`),
}
