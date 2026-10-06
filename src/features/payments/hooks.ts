import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { feeApi, invoiceApi, paymentApi, refundApi, type FeePlanInput, type PaymentInput, type ScheduleItem } from '@/api/paymentApi'
import { INVALIDATE, useApiMutation } from '@/hooks/useApiMutation'
import type { ListParams } from '@/types'

export const useFeePlans = (params: ListParams) => useQuery({ queryKey: ['fees', 'list', params], queryFn: () => feeApi.list(params), placeholderData: keepPreviousData })
export const usePendingInstallments = (params: ListParams) => useQuery({ queryKey: ['fees', 'pending', params], queryFn: () => feeApi.pending(params), placeholderData: keepPreviousData })
export const usePayments = (params: ListParams) => useQuery({ queryKey: ['payments', 'list', params], queryFn: () => paymentApi.list(params), placeholderData: keepPreviousData })
export const usePayment = (id: string) => useQuery({ queryKey: ['payments', 'detail', id], queryFn: () => paymentApi.get(id) })
export const usePaymentActivity = (id: string) => useQuery({ queryKey: ['activity', 'payment', id], queryFn: () => paymentApi.activity(id) })
export const useRefunds = (params: ListParams) => useQuery({ queryKey: ['refunds', 'list', params], queryFn: () => refundApi.list(params), placeholderData: keepPreviousData })
export const useInvoices = (params: ListParams) => useQuery({ queryKey: ['invoices', 'list', params], queryFn: () => invoiceApi.list(params), placeholderData: keepPreviousData })
export const useInvoice = (id: string) => useQuery({ queryKey: ['invoices', 'detail', id], queryFn: () => invoiceApi.get(id) })

export const useCreateFeePlan = () => useApiMutation({ mutationFn: (b: FeePlanInput) => feeApi.create(b), success: 'Fee plan created', invalidate: INVALIDATE.finance, silentError: true })
export const useChangeFee = () => useApiMutation({ mutationFn: (v: { id: string } & Parameters<typeof feeApi.update>[1]) => feeApi.update(v.id, v), success: 'Fee updated', invalidate: INVALIDATE.finance, silentError: true })
export const useRescheduleInstallments = () => useApiMutation({ mutationFn: (v: { id: string; installments: ScheduleItem[]; reason: string }) => feeApi.reschedule(v.id, v), success: 'Installment plan updated', invalidate: INVALIDATE.finance, silentError: true })
export const useRecordPayment = () => useApiMutation({ mutationFn: (b: PaymentInput) => paymentApi.create(b), success: 'Payment recorded', invalidate: INVALIDATE.finance, silentError: true })
export const useUpdatePayment = () => useApiMutation({ mutationFn: (v: { id: string } & Parameters<typeof paymentApi.update>[1]) => paymentApi.update(v.id, v), success: 'Payment updated', invalidate: INVALIDATE.finance, silentError: true })
export const useRefundPayment = () => useApiMutation({ mutationFn: (v: { id: string; amount: number; reason: string }) => paymentApi.refund(v.id, v), success: 'Refund issued', invalidate: INVALIDATE.finance, silentError: true })
