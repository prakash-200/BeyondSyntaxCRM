import { useQuery } from '@tanstack/react-query'
import { commonApi } from '@/api/reportApi'
import { ROLE_LABELS } from '@/constants/permissions'
import type { Option } from '@/components/forms/fields'

/** Reference data used by filters and form dropdowns (available to every signed-in role). */
export function useLookups() {
  const query = useQuery({ queryKey: ['lookups'], queryFn: commonApi.lookups, staleTime: 5 * 60_000 })
  const data = query.data
  const courseOptions: Option[] = (data?.courses ?? []).map((c) => ({ value: c.id, label: c.name }))
  const batchOptions: Option[] = (data?.batches ?? []).map((b) => ({ value: b.id, label: b.name }))
  const employeeOptions = (role?: string): Option[] => (data?.employees ?? []).filter((e) => !role || e.role === role).map((e) => ({ value: e.id, label: role ? e.name : `${e.name} (${ROLE_LABELS[e.role as keyof typeof ROLE_LABELS] ?? e.role})` }))
  return { ...query, lookups: data, courseOptions, batchOptions, employeeOptions }
}
