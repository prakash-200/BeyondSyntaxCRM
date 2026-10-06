export type Id = string

/** ISO date (YYYY-MM-DD) */
export type DateString = string
/** ISO date-time */
export type DateTimeString = string

export interface Paged<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}

export interface ListParams {
  search?: string
  page?: number
  pageSize?: number
  sort?: string
  order?: 'asc' | 'desc'
  from?: DateString
  to?: DateString
  [key: string]: string | number | boolean | undefined
}

export interface ApiErrorBody {
  status: number
  message: string
  /** Field-level validation errors, mirrors ASP.NET ProblemDetails.errors */
  errors?: Record<string, string[]>
}

export interface SoftDeletable {
  deletedAt?: DateTimeString | null
}

export interface Lookups {
  courses: { id: Id; name: string; code: string; totalFee: number }[]
  batches: { id: Id; name: string; courseId: Id; status: string }[]
  employees: { id: Id; name: string; role: string }[]
}
