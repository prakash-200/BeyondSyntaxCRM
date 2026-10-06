import { AxiosError, type AxiosAdapter, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios'
import type { Permission } from '@/constants/permissions'
import { getDb } from '../db'
import './handlers'
import { HttpError, matchRoute, type Ctx } from './router'

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

function userFromAuthHeader(header: unknown) {
  if (typeof header !== 'string' || !header.startsWith('Bearer ')) return null
  const [kind, empId, exp] = header.slice(7).split('.')
  if (kind !== 'mock' || !empId || Number(exp) < Date.now()) return null
  const user = getDb().employees.find((e) => e.id === empId)
  return user && user.status === 'ACTIVE' ? user : null
}

function respond(config: InternalAxiosRequestConfig, status: number, data: unknown): AxiosResponse {
  return {
    data: data === undefined ? undefined : JSON.parse(JSON.stringify(data)), // deep clone: UI can never mutate the "database"
    status,
    statusText: String(status),
    headers: {},
    config,
    request: {},
  }
}

function fail(config: InternalAxiosRequestConfig, status: number, message: string, errors?: Record<string, string[]>) {
  const response = respond(config, status, { status, message, errors })
  return new AxiosError(message, status >= 500 ? 'ERR_BAD_RESPONSE' : 'ERR_BAD_REQUEST', config, {}, response)
}

/** Axios adapter that serves requests from the in-memory mock API. */
export const mockAdapter: AxiosAdapter = async (config) => {
  await sleep(110 + Math.random() * 190)
  const db = getDb()
  const rawUrl = (config.url ?? '/').replace(config.baseURL ?? '', '')
  const url = new URL(rawUrl, 'http://mock')
  const path = url.pathname.replace(/^\/api/, '')
  const query: Record<string, string> = {}
  url.searchParams.forEach((v, k) => (query[k] = v))
  for (const [k, v] of Object.entries((config.params ?? {}) as Record<string, unknown>)) {
    if (v !== undefined && v !== null && v !== '') query[k] = String(v)
  }
  let body: unknown = config.data
  if (typeof body === 'string' && body.length) {
    try {
      body = JSON.parse(body)
    } catch {
      body = undefined
    }
  }

  const matched = matchRoute((config.method ?? 'get').toUpperCase(), path)
  if (!matched) throw fail(config, 404, `No route for ${config.method?.toUpperCase()} ${path}`)
  const { route, params } = matched

  const user = userFromAuthHeader(config.headers?.Authorization ?? config.headers?.authorization)
  if (route.permission !== 'public' && !user) throw fail(config, 401, 'Your session has expired. Please sign in again.')

  const permissions = user ? db.rolePermissions[user.role] : []
  const can = (p: Permission) => permissions.includes(p)
  if (route.permission !== 'public' && route.permission !== 'authenticated') {
    const needed = Array.isArray(route.permission) ? route.permission : [route.permission]
    if (!needed.some(can)) throw fail(config, 403, 'You do not have permission to perform this action.')
  }

  const ctx: Ctx = { params, query, body, user: user!, db, can }
  try {
    const result = route.handler(ctx)
    return respond(config, 200, result)
  } catch (e) {
    if (e instanceof HttpError) throw fail(config, e.status, e.message, e.errors)
    console.error('[mock-api]', e)
    throw fail(config, 500, 'Unexpected server error')
  }
}
