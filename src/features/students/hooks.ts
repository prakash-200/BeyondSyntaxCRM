import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { documentApi, studentApi, type StudentInput } from '@/api/studentApi'
import type { StudentStatus } from '@/constants/enums'
import { INVALIDATE, useApiMutation } from '@/hooks/useApiMutation'
import type { ImportRow, ListParams, StoredDocument } from '@/types'

export const useStudents = (params: ListParams) => useQuery({ queryKey: ['students', 'list', params], queryFn: () => studentApi.list(params), placeholderData: keepPreviousData })
export const useStudent = (id: string) => useQuery({ queryKey: ['students', 'detail', id], queryFn: () => studentApi.get(id) })
export const useStudentPayments = (id: string, enabled = true) => useQuery({ queryKey: ['payments', 'student', id], queryFn: () => studentApi.payments(id), enabled })
export const useStudentFeePlan = (id: string, enabled = true) => useQuery({ queryKey: ['fees', 'student', id], queryFn: () => studentApi.feePlan(id), enabled })
export const useStudentAttendance = (id: string, enabled = true) => useQuery({ queryKey: ['attendance', 'student', id], queryFn: () => studentApi.attendance(id), enabled })
export const useStudentProgress = (id: string, enabled = true) => useQuery({ queryKey: ['progress', 'student', id], queryFn: () => studentApi.progress(id), enabled })
export const useStudentAssignments = (id: string) => useQuery({ queryKey: ['assignments', 'student', id], queryFn: () => studentApi.assignments(id) })
export const useStudentActivity = (id: string) => useQuery({ queryKey: ['activity', 'student', id], queryFn: () => studentApi.activity(id) })
export const useStudentBatchHistory = (id: string) => useQuery({ queryKey: ['batches', 'student', id], queryFn: () => studentApi.batchHistory(id) })
export const useStudentApplication = (id: string, enabled = true) => useQuery({ queryKey: ['applications', 'student', id], queryFn: () => studentApi.application(id), enabled })
export const useDocuments = (ownerId: string, ownerType?: StoredDocument['ownerType']) => useQuery({ queryKey: ['documents', ownerId, ownerType], queryFn: () => documentApi.list(ownerId, ownerType) })

export const useCreateStudent = () => useApiMutation({ mutationFn: (b: StudentInput) => studentApi.create(b), success: (s) => `Student ${s.fullName} created`, invalidate: INVALIDATE.student, silentError: true })
export const useUpdateStudent = () => useApiMutation({ mutationFn: (v: { id: string; body: StudentInput }) => studentApi.update(v.id, v.body), success: 'Student updated', invalidate: INVALIDATE.student, silentError: true })
export const useDeleteStudent = () => useApiMutation({ mutationFn: (id: string) => studentApi.remove(id), success: 'Student deleted', invalidate: INVALIDATE.student })
export const useSetStudentStatus = () => useApiMutation({ mutationFn: (v: { id: string; status: StudentStatus; reason?: string }) => studentApi.setStatus(v.id, { status: v.status, reason: v.reason }), success: 'Student status updated', invalidate: INVALIDATE.student })
export const useCompleteStudent = () => useApiMutation({ mutationFn: (v: { id: string; reason?: string }) => studentApi.complete(v.id, { reason: v.reason }), success: 'Course marked as completed', invalidate: INVALIDATE.student })
export const useImportStudents = () => useApiMutation({ mutationFn: (rows: ImportRow[]) => studentApi.import(rows), invalidate: INVALIDATE.student, silentError: true })
export const useUpdateProgress = () => useApiMutation({ mutationFn: (v: { id: string; moduleId: string; percent: number }) => studentApi.updateProgress(v.id, { moduleId: v.moduleId, percent: v.percent }), success: 'Progress updated', invalidate: ['progress', 'students', 'activity', 'audit', 'dashboard', 'batches'] })
export const useUploadDocument = () => useApiMutation({ mutationFn: (b: Parameters<typeof documentApi.upload>[0]) => documentApi.upload(b), success: 'Document uploaded', invalidate: ['documents', 'activity', 'audit', 'applications'] })
export const useRemoveDocument = () => useApiMutation({ mutationFn: (id: string) => documentApi.remove(id), success: 'Document removed', invalidate: ['documents', 'applications'] })
