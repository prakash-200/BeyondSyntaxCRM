import type { Permission } from '@/constants/permissions'
import type { Employee, ListParams, Paged, RoleDefinition, Trainer } from '@/types'
import type { Role } from '@/constants/enums'
import { http } from './apiClient'

export type EmployeeInput = Partial<Omit<Employee, 'id' | 'status'>>

export const employeeApi = {
  list: (params: ListParams) => http.get<Paged<Employee>>('/employees', params),
  get: (id: string) => http.get<Employee>(`/employees/${id}`),
  create: (body: EmployeeInput) => http.post<Employee>('/employees', body),
  update: (id: string, body: EmployeeInput) => http.put<Employee>(`/employees/${id}`, body),
  setStatus: (id: string, status: 'ACTIVE' | 'INACTIVE', reason?: string) => http.post<Employee>(`/employees/${id}/status`, { status, reason }),
  trainers: (params: ListParams) => http.get<Paged<Trainer>>('/trainers', params),
}

export const roleApi = {
  list: () => http.get<RoleDefinition[]>('/roles'),
  update: (role: Role, permissions: Permission[]) => http.put<{ role: Role; permissions: Permission[] }>(`/roles/${role}`, { permissions }),
}
