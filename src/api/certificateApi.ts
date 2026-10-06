import type { Certificate, CertificateVerification, EligibleStudent, ListParams, Paged } from '@/types'
import { http } from './apiClient'

export const certificateApi = {
  list: (params: ListParams) => http.get<Paged<Certificate>>('/certificates', params),
  get: (id: string) => http.get<Certificate>(`/certificates/${id}`),
  eligible: () => http.get<EligibleStudent[]>('/certificates/eligible'),
  issue: (body: { studentId: string; overrideReason?: string }) => http.post<Certificate>('/certificates', body),
  /** Public endpoint — no authentication required. */
  verify: (id: string) => http.get<CertificateVerification>(`/certificates/verify/${encodeURIComponent(id)}`),
}
