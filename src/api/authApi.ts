import type { AuthSession, LoginRequest } from '@/types'
import { http } from './apiClient'

export const authApi = {
  login: (body: LoginRequest) => http.post<AuthSession>('/auth/login', body),
  me: () => http.get<AuthSession>('/auth/me'),
  logout: () => http.post<{ ok: boolean }>('/auth/logout'),
  forgotPassword: (email: string) => http.post<{ ok: boolean }>('/auth/forgot-password', { email }),
}
