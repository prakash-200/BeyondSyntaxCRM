import type { FeePlan, Invoice, InvoiceDetail, ListParams, Paged, Payment, PaymentDetail, PendingInstallment, Refund, AuditLog } from '@/types'
import { http } from './apiClient'

export interface ScheduleItem {
  amount: number
  dueDate: string
}

export interface FeePlanInput {
  studentId: string
  courseFee?: number
  discount?: number
  scholarship?: number
  installments: ScheduleItem[]
}

export interface PaymentInput {
  studentId: string
  amount: number
  method: Payment['method']
  paymentDate: string
  transactionId?: string
  installmentId?: string | null
  notes?: string
  status?: Payment['status']
  allowOverpayment?: boolean
}

export const feeApi = {
  list: (params: ListParams) => http.get<Paged<FeePlan>>('/fee-plans', params),
  get: (id: string) => http.get<FeePlan>(`/fee-plans/${id}`),
  create: (body: FeePlanInput) => http.post<FeePlan>('/fee-plans', body),
  update: (id: string, body: { courseFee?: number; discount?: number; scholarship?: number; reason: string; installments?: ScheduleItem[] }) => http.put<FeePlan>(`/fee-plans/${id}`, body),
  reschedule: (id: string, body: { installments: ScheduleItem[]; reason: string }) => http.post<FeePlan>(`/fee-plans/${id}/installments`, body),
  pending: (params: ListParams) => http.get<Paged<PendingInstallment>>('/installments', params),
}

export const paymentApi = {
  list: (params: ListParams) => http.get<Paged<Payment>>('/payments', params),
  get: (id: string) => http.get<PaymentDetail>(`/payments/${id}`),
  create: (body: PaymentInput) => http.post<Payment>('/payments', body),
  update: (id: string, body: Partial<PaymentInput> & { reason: string }) => http.put<Payment>(`/payments/${id}`, body),
  refund: (id: string, body: { amount: number; reason: string }) => http.post<Refund>(`/payments/${id}/refund`, body),
  activity: (id: string) => http.get<AuditLog[]>(`/payments/${id}/activity`),
}

export const refundApi = {
  list: (params: ListParams) => http.get<Paged<Refund>>('/refunds', params),
}

export const invoiceApi = {
  list: (params: ListParams) => http.get<Paged<Invoice>>('/invoices', params),
  get: (id: string) => http.get<InvoiceDetail>(`/invoices/${id}`),
}
