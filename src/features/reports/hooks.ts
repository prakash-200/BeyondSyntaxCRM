import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { reportApi } from '@/api/reportApi'
import type { ListParams } from '@/types'

export const useStudentReport = (p: ListParams) => useQuery({ queryKey: ['reports', 'students', p], queryFn: () => reportApi.students(p), placeholderData: keepPreviousData })
export const useLeadReport = (p: ListParams) => useQuery({ queryKey: ['reports', 'leads', p], queryFn: () => reportApi.leads(p) })
export const useFinancialReport = (p: ListParams) => useQuery({ queryKey: ['reports', 'financial', p], queryFn: () => reportApi.financial(p) })
export const useEmployeeReport = () => useQuery({ queryKey: ['reports', 'employees'], queryFn: reportApi.employees })
export const useBusinessReport = () => useQuery({ queryKey: ['reports', 'business'], queryFn: reportApi.business })
