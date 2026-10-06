import type { FeeStatus, InstallmentStatus, PaymentMethod, PaymentStatus } from '@/constants/enums'
import type { DateString, DateTimeString, Id } from './common'

export interface Installment {
  id: Id
  feePlanId: Id
  studentId: Id
  number: number
  amount: number
  dueDate: DateString
  status: InstallmentStatus
  paidAmount: number
  paidAt?: DateTimeString | null
}

export interface FeePlan {
  id: Id
  studentId: Id
  studentName?: string
  courseId: Id
  courseName?: string
  courseFee: number
  discount: number
  scholarship: number
  finalFee: number
  paid: number
  refunded: number
  outstanding: number
  status: FeeStatus
  createdAt: DateTimeString
  invoiceId?: Id | null
  installments: Installment[]
}

export interface Payment {
  id: Id
  studentId: Id
  studentName?: string
  invoiceId: Id
  invoiceNumber?: string
  installmentId?: Id | null
  amount: number
  method: PaymentMethod
  transactionId: string
  paymentDate: DateString
  status: PaymentStatus
  recordedById: Id
  recordedByName?: string
  notes: string
  isOverpayment?: boolean
  createdAt: DateTimeString
}

export interface Refund {
  id: Id
  paymentId: Id
  studentId: Id
  studentName?: string
  amount: number
  reason: string
  date: DateString
  processedById: Id
  processedByName?: string
}

export interface InvoiceLineItem {
  description: string
  amount: number
}

export interface Invoice {
  id: Id
  number: string
  studentId: Id
  studentName?: string
  feePlanId: Id
  courseName?: string
  date: DateString
  items: InvoiceLineItem[]
  subtotal: number
  discount: number
  scholarship: number
  taxRate: number
  taxAmount: number
  total: number
  paid: number
  balance: number
  status: FeeStatus
}

export interface InvoiceDetail extends Invoice {
  student: {
    id: Id
    fullName: string
    email: string
    phone: string
    address: string
    city: string
    state: string
    postalCode: string
  }
  payments: Payment[]
}

export interface PaymentDetail extends Payment {
  invoice?: Invoice
  student?: { id: Id; fullName: string; phone: string; courseName?: string }
}

/** Row on the "Pending payments" page. */
export interface PendingInstallment extends Installment {
  studentName: string
  courseName?: string
  phone: string
  daysOverdue: number
}
