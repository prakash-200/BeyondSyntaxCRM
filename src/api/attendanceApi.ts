import type { AttendanceStatus } from '@/constants/enums'
import type { AttendanceSessionDetail, AttendanceSummaryRow, ClassSession, ListParams, Paged } from '@/types'
import { http } from './apiClient'

export const attendanceApi = {
  sessions: (params: ListParams) => http.get<Paged<ClassSession>>('/attendance/sessions', params),
  session: (id: string) => http.get<AttendanceSessionDetail>(`/attendance/sessions/${id}`),
  createSession: (body: { batchId: string; date: string; topic: string; moduleId?: string | null }) => http.post<ClassSession>('/attendance/sessions', body),
  save: (id: string, records: { studentId: string; status: AttendanceStatus }[]) => http.put<ClassSession>(`/attendance/sessions/${id}`, { records }),
  summary: (batchId: string) => http.get<AttendanceSummaryRow[]>('/attendance/summary', { batchId }),
}
