import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { batchApi, type BatchInput } from '@/api/batchApi'
import { employeeApi } from '@/api/employeeApi'
import { INVALIDATE, useApiMutation } from '@/hooks/useApiMutation'
import type { ListParams } from '@/types'

export const useBatches = (params: ListParams) => useQuery({ queryKey: ['batches', 'list', params], queryFn: () => batchApi.list(params), placeholderData: keepPreviousData })
export const useBatch = (id: string) => useQuery({ queryKey: ['batches', 'detail', id], queryFn: () => batchApi.get(id) })
export const useBatchStudents = (id: string, includeHistory = false) => useQuery({ queryKey: ['batches', 'students', id, includeHistory], queryFn: () => batchApi.students(id, includeHistory) })
export const useEligibleStudents = (id: string, enabled: boolean) => useQuery({ queryKey: ['batches', 'eligible', id], queryFn: () => batchApi.eligibleStudents(id), enabled })
export const useBatchSessions = (id: string) => useQuery({ queryKey: ['attendance', 'batchSessions', id], queryFn: () => batchApi.sessions(id) })
export const useBatchProgress = (id: string, enabled = true) => useQuery({ queryKey: ['progress', 'batch', id], queryFn: () => batchApi.progress(id), enabled })
export const useBatchActivity = (id: string) => useQuery({ queryKey: ['activity', 'batch', id], queryFn: () => batchApi.activity(id) })
export const useTrainers = (params: ListParams) => useQuery({ queryKey: ['trainers', 'list', params], queryFn: () => employeeApi.trainers(params), placeholderData: keepPreviousData })

export const useCreateBatch = () => useApiMutation({ mutationFn: (b: BatchInput) => batchApi.create(b), success: (b) => `Batch ${b.name} created`, invalidate: INVALIDATE.academic, silentError: true })
export const useUpdateBatch = () => useApiMutation({ mutationFn: (v: { id: string; body: BatchInput }) => batchApi.update(v.id, v.body), success: 'Batch updated', invalidate: INVALIDATE.academic, silentError: true })
export const useAssignStudent = () => useApiMutation({ mutationFn: (v: { id: string; studentId: string }) => batchApi.assignStudent(v.id, v.studentId), success: 'Student assigned to batch', invalidate: INVALIDATE.student, silentError: true })
export const useRemoveStudent = () => useApiMutation({ mutationFn: (v: { id: string; studentId: string; reason: string }) => batchApi.removeStudent(v.id, v.studentId, v.reason), success: 'Student removed from batch', invalidate: INVALIDATE.student })
export const useTransferStudent = () => useApiMutation({ mutationFn: (v: { id: string; studentId: string; toBatchId: string; reason: string }) => batchApi.transferStudent(v.id, v), success: 'Student transferred', invalidate: INVALIDATE.student, silentError: true })
