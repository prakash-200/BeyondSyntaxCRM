import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { applicationApi, type ApplicationInput, type ApprovalInput } from '@/api/applicationApi'
import { INVALIDATE, useApiMutation } from '@/hooks/useApiMutation'
import type { ApplicationStatus } from '@/constants/enums'
import type { ListParams } from '@/types'

export const useApplications = (params: ListParams) => useQuery({ queryKey: ['applications', 'list', params], queryFn: () => applicationApi.list(params), placeholderData: keepPreviousData })
export const useApplication = (id: string) => useQuery({ queryKey: ['applications', 'detail', id], queryFn: () => applicationApi.get(id) })
export const useApplicationActivity = (id: string) => useQuery({ queryKey: ['activity', 'application', id], queryFn: () => applicationApi.activity(id) })

export const useCreateApplication = () => useApiMutation({ mutationFn: (b: ApplicationInput) => applicationApi.create(b), success: (a) => `Application ${a.id} created`, invalidate: INVALIDATE.crm, silentError: true })
export const useSetApplicationStatus = () =>
  useApiMutation({ mutationFn: (v: { id: string; status: ApplicationStatus; note?: string }) => applicationApi.setStatus(v.id, { status: v.status, note: v.note }), success: 'Application status updated', invalidate: INVALIDATE.crm })
export const useApproveApplication = () => useApiMutation({ mutationFn: (v: { id: string; body: ApprovalInput }) => applicationApi.approve(v.id, v.body), success: 'Admission approved — student record created', invalidate: INVALIDATE.student, silentError: true })
