import type { Assignment, AssignmentSubmission, ListParams, Paged } from '@/types'
import { http } from './apiClient'

export type AssignmentInput = Partial<Pick<Assignment, 'batchId' | 'moduleId' | 'title' | 'description' | 'dueDate' | 'maxMarks'>>

export const assignmentApi = {
  list: (params: ListParams) => http.get<Paged<Assignment>>('/assignments', params),
  get: (id: string) => http.get<Assignment>(`/assignments/${id}`),
  create: (body: AssignmentInput) => http.post<Assignment>('/assignments', body),
  update: (id: string, body: AssignmentInput) => http.put<Assignment>(`/assignments/${id}`, body),
  remove: (id: string) => http.delete<{ ok: boolean }>(`/assignments/${id}`),
  submissions: (id: string) => http.get<AssignmentSubmission[]>(`/assignments/${id}/submissions`),
  grade: (submissionId: string, body: Partial<Pick<AssignmentSubmission, 'status' | 'score' | 'feedback'>>) => http.put<AssignmentSubmission>(`/submissions/${submissionId}`, body),
}
