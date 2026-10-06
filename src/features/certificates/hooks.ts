import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { certificateApi } from '@/api/certificateApi'
import { INVALIDATE, useApiMutation } from '@/hooks/useApiMutation'
import type { ListParams } from '@/types'

export const useCertificates = (params: ListParams) => useQuery({ queryKey: ['certificates', 'list', params], queryFn: () => certificateApi.list(params), placeholderData: keepPreviousData })
export const useCertificate = (id: string) => useQuery({ queryKey: ['certificates', 'detail', id], queryFn: () => certificateApi.get(id) })
export const useEligibleForCertificate = (enabled = true) => useQuery({ queryKey: ['certificates', 'eligible'], queryFn: certificateApi.eligible, enabled })
export const useVerifyCertificate = (id: string) => useQuery({ queryKey: ['certificates', 'verify', id], queryFn: () => certificateApi.verify(id), enabled: !!id, retry: false })
export const useIssueCertificate = () => useApiMutation({ mutationFn: (v: { studentId: string; overrideReason?: string }) => certificateApi.issue(v), success: (c) => `Certificate ${c.id} issued`, invalidate: INVALIDATE.student })
