import axios, { AxiosError, type AxiosAdapter, type AxiosRequestConfig, type InternalAxiosRequestConfig } from 'axios'
import type { ApiErrorBody, AuthSession } from '@/types'
import { tokenStore } from './tokenStore'

export const API_BASE_URL: string = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000/api'
/** When true every request is served by the in-browser mock API (src/mock). */
export const USE_MOCK_API: boolean = import.meta.env.VITE_USE_MOCK_API !== 'false'

export const AUTH_EXPIRED_EVENT = 'tms:auth-expired'

export class ApiError extends Error {
  status: number
  errors?: Record<string, string[]>
  constructor(status: number, message: string, errors?: Record<string, string[]>) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.errors = errors
  }
}

export function getErrorMessage(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (error instanceof ApiError) return error.message
  if (error instanceof Error && error.message) return error.message
  return fallback
}

// The mock layer is loaded lazily so it is never part of a real-API build's critical path.
const mockAdapter: AxiosAdapter = async (config) => {
  const { mockAdapter: adapter } = await import('@/mock/server/adapter')
  return adapter(config)
}

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 20_000,
  headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
  adapter: USE_MOCK_API ? mockAdapter : undefined,
})

/* ───────────── request: attach bearer token ───────────── */
apiClient.interceptors.request.use((config) => {
  const session = tokenStore.get()
  if (session?.accessToken) config.headers.set('Authorization', `Bearer ${session.accessToken}`)
  return config
})

/* ───────────── response: normalise errors, refresh once on 401 ───────────── */
let refreshing: Promise<AuthSession> | null = null

async function refreshSession(): Promise<AuthSession> {
  const current = tokenStore.get()
  if (!current?.refreshToken) throw new Error('No refresh token')
  const res = await apiClient.post<AuthSession>('/auth/refresh', { refreshToken: current.refreshToken }, { _skipAuthRefresh: true } as AxiosRequestConfig)
  tokenStore.update(res.data)
  return res.data
}

declare module 'axios' {
  interface AxiosRequestConfig {
    _skipAuthRefresh?: boolean
    _retried?: boolean
  }
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiErrorBody>) => {
    const config = error.config as (InternalAxiosRequestConfig & { _retried?: boolean; _skipAuthRefresh?: boolean }) | undefined
    const status = error.response?.status ?? 0

    if (status === 401 && config && !config._retried && !config._skipAuthRefresh && !config.url?.includes('/auth/login') && tokenStore.get()) {
      config._retried = true
      try {
        refreshing ??= refreshSession().finally(() => (refreshing = null))
        await refreshing
        return apiClient(config)
      } catch {
        tokenStore.clear()
        window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT))
      }
    }

    const body = error.response?.data
    if (!error.response) {
      return Promise.reject(new ApiError(0, 'Cannot reach the server. Check your connection and try again.'))
    }
    return Promise.reject(new ApiError(status, body?.message ?? error.message, body?.errors))
  },
)

/** Thin typed helpers so API modules stay one-liners. */
export const http = {
  get: <T>(url: string, params?: object) => apiClient.get<T>(url, { params }).then((r) => r.data),
  post: <T>(url: string, body?: unknown) => apiClient.post<T>(url, body).then((r) => r.data),
  put: <T>(url: string, body?: unknown) => apiClient.put<T>(url, body).then((r) => r.data),
  delete: <T>(url: string) => apiClient.delete<T>(url).then((r) => r.data),
}
