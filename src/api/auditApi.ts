import type { AppNotification, AuditLog, ListParams, Paged } from '@/types'
import { http } from './apiClient'

export const auditApi = {
  list: (params: ListParams) => http.get<Paged<AuditLog>>('/audit-logs', params),
}

export const notificationApi = {
  list: () => http.get<AppNotification[]>('/notifications'),
  markRead: (id: string) => http.post<AppNotification>(`/notifications/${id}/read`),
  markAllRead: () => http.post<{ ok: boolean }>('/notifications/read-all'),
}
