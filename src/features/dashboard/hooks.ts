import { useQuery } from '@tanstack/react-query'
import { dashboardApi } from '@/api/reportApi'

export const useDashboardSummary = () => useQuery({ queryKey: ['dashboard', 'summary'], queryFn: dashboardApi.summary, staleTime: 30_000 })
export const useTrainerDashboard = (enabled = true) => useQuery({ queryKey: ['dashboard', 'trainer'], queryFn: dashboardApi.trainer, enabled, staleTime: 30_000 })
