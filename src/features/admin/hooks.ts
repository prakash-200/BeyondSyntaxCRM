import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { auditApi } from '@/api/auditApi'
import { employeeApi, roleApi, type EmployeeInput } from '@/api/employeeApi'
import { commonApi } from '@/api/reportApi'
import type { Role } from '@/constants/enums'
import type { Permission } from '@/constants/permissions'
import { INVALIDATE, useApiMutation } from '@/hooks/useApiMutation'
import type { AppSettings, ListParams } from '@/types'

export const useEmployees = (params: ListParams) => useQuery({ queryKey: ['employees', 'list', params], queryFn: () => employeeApi.list(params), placeholderData: keepPreviousData })
export const useRoles = () => useQuery({ queryKey: ['roles'], queryFn: roleApi.list })
export const useAuditLogs = (params: ListParams) => useQuery({ queryKey: ['audit', 'list', params], queryFn: () => auditApi.list(params), placeholderData: keepPreviousData })
export const useSettings = () => useQuery({ queryKey: ['settings'], queryFn: commonApi.settings })

export const useCreateEmployee = () => useApiMutation({ mutationFn: (b: EmployeeInput) => employeeApi.create(b), success: (e) => `${e.name} added. Temporary password: Password@123`, invalidate: INVALIDATE.admin, silentError: true })
export const useUpdateEmployee = () => useApiMutation({ mutationFn: (v: { id: string; body: EmployeeInput }) => employeeApi.update(v.id, v.body), success: 'Employee updated', invalidate: INVALIDATE.admin, silentError: true })
export const useSetEmployeeStatus = () => useApiMutation({ mutationFn: (v: { id: string; status: 'ACTIVE' | 'INACTIVE'; reason?: string }) => employeeApi.setStatus(v.id, v.status, v.reason), success: (e) => `${e.name} ${e.status === 'ACTIVE' ? 'activated' : 'deactivated'}`, invalidate: INVALIDATE.admin })
export const useUpdateRole = () => useApiMutation({ mutationFn: (v: { role: Role; permissions: Permission[] }) => roleApi.update(v.role, v.permissions), invalidate: INVALIDATE.admin, silentError: true })
export const useUpdateSettings = () => useApiMutation({ mutationFn: (b: Partial<AppSettings>) => commonApi.updateSettings(b), success: 'Settings saved', invalidate: ['settings', 'audit'], silentError: true })
