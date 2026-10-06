import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { followUpApi, leadApi, type FollowUpInput, type LeadInput } from '@/api/leadApi'
import { INVALIDATE, useApiMutation } from '@/hooks/useApiMutation'
import type { FollowUpBucket, ListParams } from '@/types'

export const useLeads = (params: ListParams) => useQuery({ queryKey: ['leads', 'list', params], queryFn: () => leadApi.list(params), placeholderData: keepPreviousData })
export const useLead = (id: string) => useQuery({ queryKey: ['leads', 'detail', id], queryFn: () => leadApi.get(id) })
export const useLeadFollowUps = (id: string) => useQuery({ queryKey: ['followUps', 'lead', id], queryFn: () => leadApi.followUps(id) })
export const useLeadActivity = (id: string) => useQuery({ queryKey: ['activity', 'lead', id], queryFn: () => leadApi.activity(id) })

export const useCreateLead = () => useApiMutation({ mutationFn: (b: LeadInput) => leadApi.create(b), success: (l) => `Lead ${l.name} created`, invalidate: INVALIDATE.crm, silentError: true })
export const useUpdateLead = () => useApiMutation({ mutationFn: (v: { id: string; body: Partial<LeadInput> }) => leadApi.update(v.id, v.body), success: 'Lead updated', invalidate: INVALIDATE.crm, silentError: true })
export const useDeleteLead = () => useApiMutation({ mutationFn: (id: string) => leadApi.remove(id), success: 'Lead deleted', invalidate: INVALIDATE.crm })
export const useAddLeadNote = () => useApiMutation({ mutationFn: (v: { id: string; text: string }) => leadApi.addNote(v.id, v.text), success: 'Note added', invalidate: INVALIDATE.crm })
export const useAssignLead = () => useApiMutation({ mutationFn: (v: { id: string; employeeId: string }) => leadApi.assign(v.id, v.employeeId), success: 'Lead reassigned', invalidate: INVALIDATE.crm })
export const useConvertLead = () => useApiMutation({ mutationFn: (v: { id: string; body: Parameters<typeof leadApi.convert>[1] }) => leadApi.convert(v.id, v.body), invalidate: INVALIDATE.student, silentError: true })

export const useFollowUps = (params: ListParams & { bucket?: FollowUpBucket }) => useQuery({ queryKey: ['followUps', 'list', params], queryFn: () => followUpApi.list(params), placeholderData: keepPreviousData })
export const useFollowUpCounts = () => useQuery({ queryKey: ['followUps', 'counts'], queryFn: followUpApi.counts })
export const useCreateFollowUp = () => useApiMutation({ mutationFn: (b: FollowUpInput) => followUpApi.create(b), success: 'Follow-up scheduled', invalidate: INVALIDATE.crm, silentError: true })
export const useCompleteFollowUp = () => useApiMutation({ mutationFn: (v: { id: string; outcome: string; leadStatus?: Parameters<typeof followUpApi.complete>[1]['leadStatus'] }) => followUpApi.complete(v.id, { outcome: v.outcome, leadStatus: v.leadStatus }), success: 'Follow-up marked completed', invalidate: INVALIDATE.crm, silentError: true })
export const useRescheduleFollowUp = () => useApiMutation({ mutationFn: (v: { id: string; date: string; time: string; reason?: string }) => followUpApi.reschedule(v.id, v), success: 'Follow-up rescheduled', invalidate: INVALIDATE.crm, silentError: true })
export const useCancelFollowUp = () => useApiMutation({ mutationFn: (id: string) => followUpApi.cancel(id), success: 'Follow-up cancelled', invalidate: INVALIDATE.crm })
