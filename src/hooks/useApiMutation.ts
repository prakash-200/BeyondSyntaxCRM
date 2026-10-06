import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { getErrorMessage } from '@/api/apiClient'

/**
 * Query roots touched by multi-entity workflows. Mutations invalidate the
 * roots that can be affected so every screen shows consistent data.
 */
export const INVALIDATE = {
  crm: ['leads', 'followUps', 'applications', 'students', 'dashboard', 'activity', 'audit', 'notifications', 'search', 'reports'],
  student: ['students', 'applications', 'batches', 'fees', 'payments', 'invoices', 'certificates', 'progress', 'attendance', 'documents', 'dashboard', 'activity', 'audit', 'reports', 'lookups', 'trainers', 'notifications', 'search', 'followUps'],
  finance: ['fees', 'payments', 'invoices', 'refunds', 'students', 'applications', 'dashboard', 'activity', 'audit', 'reports', 'notifications', 'search'],
  academic: ['courses', 'batches', 'trainers', 'lookups', 'students', 'dashboard', 'activity', 'audit', 'attendance', 'assignments', 'progress', 'reports', 'certificates', 'search'],
  admin: ['employees', 'roles', 'audit', 'lookups', 'trainers', 'dashboard', 'reports'],
} as const

interface Options<TData, TVars> {
  mutationFn: (vars: TVars) => Promise<TData>
  /** Toast shown on success. */
  success?: string | ((data: TData, vars: TVars) => string)
  invalidate?: readonly string[]
  onSuccess?: (data: TData, vars: TVars) => void
  /** Suppress the automatic error toast (e.g. when the form shows the error inline). */
  silentError?: boolean
}

export function useApiMutation<TData, TVars = void>({ mutationFn, success, invalidate = [], onSuccess, silentError }: Options<TData, TVars>) {
  const queryClient = useQueryClient()
  return useMutation<TData, Error, TVars>({
    mutationFn,
    onSuccess: async (data, vars) => {
      if (success) toast.success(typeof success === 'function' ? success(data, vars) : success)
      await Promise.all(invalidate.map((root) => queryClient.invalidateQueries({ queryKey: [root] })))
      onSuccess?.(data, vars)
    },
    onError: (error) => {
      if (!silentError) toast.error(getErrorMessage(error))
    },
  })
}
