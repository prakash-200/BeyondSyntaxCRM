import type { Permission } from '@/constants/permissions'
import type { Employee, Paged } from '@/types'
import { today } from '@/utils/clock'
import type { Db } from '../db'

/**
 * A tiny REST router that stands in for the ASP.NET Core API. Handlers receive
 * parsed route params / query / JSON body and return plain data (or throw
 * HttpError). The axios adapter in ./adapter.ts connects it to the client.
 */

export class HttpError extends Error {
  status: number
  errors?: Record<string, string[]>
  constructor(status: number, message: string, errors?: Record<string, string[]>) {
    super(message)
    this.status = status
    this.errors = errors
  }
}

export const notFound = (what: string) => new HttpError(404, `${what} not found`)
export const badRequest = (message: string, errors?: Record<string, string[]>) => new HttpError(400, message, errors)
export const conflict = (message: string) => new HttpError(409, message)

export interface Ctx {
  params: Record<string, string>
  query: Record<string, string>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  body: any
  user: Employee
  db: Db
  can: (p: Permission) => boolean
}

type Handler = (ctx: Ctx) => unknown
export type RoutePermission = Permission | Permission[] | 'public' | 'authenticated'

interface Route {
  method: string
  regex: RegExp
  keys: string[]
  permission: RoutePermission
  handler: Handler
}

const routes: Route[] = []

function compile(path: string) {
  const keys: string[] = []
  const pattern = path.replace(/:([A-Za-z]+)/g, (_, k: string) => {
    keys.push(k)
    return '([^/]+)'
  })
  return { regex: new RegExp(`^${pattern}/?$`), keys }
}

export function route(method: 'GET' | 'POST' | 'PUT' | 'DELETE', path: string, permission: RoutePermission, handler: Handler) {
  routes.push({ method, ...compile(path), permission, handler })
}
export const get = (p: string, perm: RoutePermission, h: Handler) => route('GET', p, perm, h)
export const post = (p: string, perm: RoutePermission, h: Handler) => route('POST', p, perm, h)
export const put = (p: string, perm: RoutePermission, h: Handler) => route('PUT', p, perm, h)
export const del = (p: string, perm: RoutePermission, h: Handler) => route('DELETE', p, perm, h)

export function matchRoute(method: string, path: string) {
  for (const r of routes) {
    if (r.method !== method) continue
    const m = r.regex.exec(path)
    if (!m) continue
    const params: Record<string, string> = {}
    r.keys.forEach((k, i) => (params[k] = decodeURIComponent(m[i + 1])))
    return { route: r, params }
  }
  return null
}

/* ───────────── list helper (search / filter / sort / paginate) ───────────── */

export interface ListOptions<T> {
  searchText?: (item: T) => string
  /** Field used by from/to date filters (YYYY-MM-DD or ISO). */
  dateOf?: (item: T) => string | undefined
  sorters?: Record<string, (item: T) => string | number>
  defaultSort?: string
  defaultOrder?: 'asc' | 'desc'
}

export function listResponse<T>(items: T[], query: Record<string, string>, opts: ListOptions<T> = {}): Paged<T> {
  let rows = items
  const q = query.search?.trim().toLowerCase()
  if (q && opts.searchText) rows = rows.filter((r) => opts.searchText!(r).toLowerCase().includes(q))
  if (opts.dateOf && (query.from || query.to)) {
    rows = rows.filter((r) => {
      const d = opts.dateOf!(r)?.slice(0, 10)
      if (!d) return false
      if (query.from && d < query.from) return false
      if (query.to && d > query.to) return false
      return true
    })
  }
  const sortKey = query.sort && opts.sorters?.[query.sort] ? query.sort : opts.defaultSort
  if (sortKey && opts.sorters?.[sortKey]) {
    const get = opts.sorters[sortKey]
    const dir = (query.order ?? opts.defaultOrder ?? 'asc') === 'desc' ? -1 : 1
    rows = [...rows].sort((a, b) => {
      const x = get(a)
      const y = get(b)
      if (typeof x === 'number' && typeof y === 'number') return (x - y) * dir
      return String(x).localeCompare(String(y)) * dir
    })
  }
  const pageSize = Math.min(500, Math.max(1, Number(query.pageSize) || 10))
  const page = Math.max(1, Number(query.page) || 1)
  const total = rows.length
  return { items: rows.slice((page - 1) * pageSize, page * pageSize), total, page, pageSize }
}

export const todayStr = today

/** Validate required fields; throws a 400 with ProblemDetails-style errors. */
export function requireFields(body: Record<string, unknown>, fields: string[]) {
  const errors: Record<string, string[]> = {}
  for (const f of fields) {
    const v = body?.[f]
    if (v === undefined || v === null || v === '') errors[f] = [`${f} is required`]
  }
  if (Object.keys(errors).length) throw badRequest('Validation failed', errors)
}
