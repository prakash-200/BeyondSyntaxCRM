import { zodResolver } from '@hookform/resolvers/zod'
import { addMonths, format, parseISO } from 'date-fns'
import { Plus, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useFieldArray, useForm, useWatch, type Control, type FieldErrors, type UseFormRegister } from 'react-hook-form'
import { z } from 'zod'
import { FormError, FormGrid, FormInput, FormSelect, FormTextarea } from '@/components/forms/fields'
import { applyServerErrors } from '@/components/forms/utils'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Checkbox } from '@/components/ui/input'
import { PAYMENT_METHODS } from '@/constants/enums'
import { humanize, optionsFrom } from '@/constants/labels'
import { useLookups } from '@/hooks/useLookups'
import type { FeePlan, Payment } from '@/types'
import { discountedFee, splitAmount, sum } from '@/utils/calc'
import { today } from '@/utils/clock'
import { formatCurrency, formatDate } from '@/utils/format'
import { useChangeFee, useCreateFeePlan, useRecordPayment, useRefundPayment, useRescheduleInstallments, useUpdatePayment } from './hooks'

/* ───────────── shared installment editor ───────────── */

interface ScheduleValues {
  installments: { amount: number; dueDate: string }[]
}

function InstallmentsEditor({
  control,
  register,
  errors,
  total,
  minDate,
}: {
  control: Control<ScheduleValues>
  register: UseFormRegister<ScheduleValues>
  errors: FieldErrors<ScheduleValues>
  total: number
  minDate?: string
}) {
  const { fields, append, remove, replace } = useFieldArray({ control, name: 'installments' })
  const [count, setCount] = useState(3)
  const [first, setFirst] = useState(minDate ?? today())
  const rows = (useWatch({ control, name: 'installments' }) ?? []) as { amount: number }[]
  const entered = sum(rows.map((r) => Number(r.amount) || 0))
  const diff = total - entered

  const generate = () => {
    if (!first || total <= 0) return
    replace(splitAmount(total, count).map((amount, i) => ({ amount, dueDate: format(addMonths(parseISO(first), i), 'yyyy-MM-dd') })))
  }

  return (
    <fieldset className="rounded-xl border border-slate-200 p-4">
      <legend className="px-1 text-sm font-semibold text-slate-900">Installments</legend>
      <div className="mb-3 flex flex-wrap items-end gap-3">
        <FormSelect label="Number of installments" value={count} onChange={(e) => setCount(Number(e.target.value))} options={Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: String(i + 1) }))} />
        <FormInput label="First due date" type="date" min={minDate} value={first} onChange={(e) => setFirst(e.target.value)} />
        <Button variant="outline" onClick={generate}>
          Split equally
        </Button>
      </div>
      <ul className="space-y-2">
        {fields.map((f, i) => (
          <li key={f.id} className="grid grid-cols-[auto_1fr_1fr_auto] items-start gap-2">
            <span className="mt-2 w-6 text-sm font-medium text-slate-500">#{i + 1}</span>
            <FormInput label={`Installment ${i + 1} amount`} wrapperClassName="[&>label]:sr-only" type="number" min={1} placeholder="Amount (₹)" error={errors.installments?.[i]?.amount?.message} {...register(`installments.${i}.amount`, { valueAsNumber: true })} />
            <FormInput label={`Installment ${i + 1} due date`} wrapperClassName="[&>label]:sr-only" type="date" min={minDate} error={errors.installments?.[i]?.dueDate?.message} {...register(`installments.${i}.dueDate`)} />
            <Button variant="ghost" size="icon" aria-label={`Remove installment ${i + 1}`} onClick={() => remove(i)} disabled={fields.length <= 1}>
              <Trash2 className="h-4 w-4 text-slate-400" />
            </Button>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <Button variant="ghost" size="sm" onClick={() => append({ amount: Math.max(0, diff), dueDate: '' })}>
          <Plus className="h-3.5 w-3.5" aria-hidden /> Add installment
        </Button>
        <p className={`text-sm ${diff === 0 ? 'text-emerald-700' : 'text-amber-700'}`} role="status">
          Allocated {formatCurrency(entered)} of {formatCurrency(total)}
          {diff !== 0 && ` (${diff > 0 ? `${formatCurrency(diff)} left` : `${formatCurrency(-diff)} over`})`}
        </p>
      </div>
      {typeof errors.installments?.message === 'string' && (
        <p role="alert" className="mt-2 text-xs font-medium text-red-600">
          {errors.installments.message}
        </p>
      )}
    </fieldset>
  )
}

const scheduleSchema = (total: () => number) =>
  z
    .array(z.object({ amount: z.number({ message: 'Enter an amount' }).positive('Must be > 0'), dueDate: z.string().min(1, 'Required') }))
    .min(1, 'Add at least one installment')
    .superRefine((rows, ctx) => {
      const t = total()
      const s = sum(rows.map((r) => r.amount || 0))
      if (s !== t) ctx.addIssue({ code: 'custom', message: `Installments total ${formatCurrency(s)} but must equal ${formatCurrency(t)}` })
      const dates = rows.map((r) => r.dueDate)
      if (dates.every(Boolean) && [...dates].sort().join() !== dates.join()) ctx.addIssue({ code: 'custom', message: 'Due dates must be in chronological order' })
    })

/* ───────────── create fee plan ───────────── */

export function FeePlanDialog({ open, onClose, student }: { open: boolean; onClose: () => void; student: { id: string; fullName: string; courseId: string; courseName?: string } | null }) {
  const { lookups } = useLookups()
  const course = lookups?.courses.find((c) => c.id === student?.courseId)
  const create = useCreateFeePlan()
  const [formError, setFormError] = useState('')
  const totalRef = useMemo(() => ({ current: 0 }), [])
  const schema = useMemo(
    () =>
      z.object({
        courseFee: z.number({ message: 'Enter the course fee' }).positive('Must be > 0'),
        discount: z.number({ message: 'Enter 0 if none' }).min(0, 'Cannot be negative'),
        scholarship: z.number({ message: 'Enter 0 if none' }).min(0, 'Cannot be negative'),
        installments: scheduleSchema(() => totalRef.current),
      }),
    [totalRef],
  )
  const form = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema), defaultValues: { courseFee: 0, discount: 0, scholarship: 0, installments: [] } })
  const [courseFee, discount, scholarship] = form.watch(['courseFee', 'discount', 'scholarship'])
  const finalFee = discountedFee(Number(courseFee) || 0, Number(discount) || 0, Number(scholarship) || 0)
  totalRef.current = finalFee

  useEffect(() => {
    if (!open || !course) return
    setFormError('')
    const fee = course.totalFee
    form.reset({ courseFee: fee, discount: 0, scholarship: 0, installments: splitAmount(fee, 3).map((amount, i) => ({ amount, dueDate: format(addMonths(parseISO(today()), i), 'yyyy-MM-dd') })) })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, course?.id])

  const submit = form.handleSubmit(async (v) => {
    setFormError('')
    try {
      await create.mutateAsync({ studentId: student!.id, ...v })
      onClose()
    } catch (e) {
      setFormError(applyServerErrors(form, e))
    }
  })
  const e = form.formState.errors

  return (
    <Dialog
      open={open}
      onClose={onClose}
      locked={create.isPending}
      size="lg"
      title="Create fee plan"
      description={student ? `${student.fullName} · ${student.courseName ?? ''}` : undefined}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={create.isPending}>
            Cancel
          </Button>
          <Button onClick={submit} loading={create.isPending} disabled={finalFee <= 0}>
            Create plan · {formatCurrency(finalFee)}
          </Button>
        </>
      }
    >
      <form onSubmit={submit} noValidate className="space-y-5">
        <FormError message={formError} />
        <FormGrid columns={3}>
          <FormInput label="Course fee (₹)" type="number" required hint={course && Number(courseFee) !== course.totalFee ? `Custom fee (standard ${formatCurrency(course.totalFee)})` : 'Standard course fee'} error={e.courseFee?.message} {...form.register('courseFee', { valueAsNumber: true })} />
          <FormInput label="Discount (₹)" type="number" min={0} error={e.discount?.message} {...form.register('discount', { valueAsNumber: true })} />
          <FormInput label="Scholarship (₹)" type="number" min={0} error={e.scholarship?.message} {...form.register('scholarship', { valueAsNumber: true })} />
        </FormGrid>
        <p className="rounded-lg bg-slate-50 px-4 py-2.5 text-sm">
          Final fee: <span className="font-semibold text-slate-900">{formatCurrency(finalFee)}</span>
        </p>
        <InstallmentsEditor control={form.control as unknown as Control<ScheduleValues>} register={form.register as unknown as UseFormRegister<ScheduleValues>} errors={e as unknown as FieldErrors<ScheduleValues>} total={finalFee} />
      </form>
    </Dialog>
  )
}

/* ───────────── change fee (sensitive) ───────────── */

export function ChangeFeeDialog({ plan, onClose }: { plan: FeePlan | null; onClose: () => void }) {
  const change = useChangeFee()
  const [formError, setFormError] = useState('')
  const schema = z.object({
    courseFee: z.number({ message: 'Enter the course fee' }).positive('Must be > 0'),
    discount: z.number({ message: 'Enter 0 if none' }).min(0),
    scholarship: z.number({ message: 'Enter 0 if none' }).min(0),
    reason: z.string().trim().min(5, 'Explain why the fee is changing (min 5 characters)'),
  })
  const form = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema), defaultValues: { courseFee: 0, discount: 0, scholarship: 0, reason: '' } })
  useEffect(() => {
    if (plan) {
      setFormError('')
      form.reset({ courseFee: plan.courseFee, discount: plan.discount, scholarship: plan.scholarship, reason: '' })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan?.id])
  const [fee, disc, schol] = form.watch(['courseFee', 'discount', 'scholarship'])
  const next = discountedFee(Number(fee) || 0, Number(disc) || 0, Number(schol) || 0)
  const submit = form.handleSubmit(async (v) => {
    setFormError('')
    try {
      await change.mutateAsync({ id: plan!.id, ...v })
      onClose()
    } catch (e) {
      setFormError(applyServerErrors(form, e))
    }
  })
  const e = form.formState.errors
  return (
    <Dialog
      open={!!plan}
      onClose={onClose}
      locked={change.isPending}
      title="Change fee"
      description={plan ? `${plan.studentName} · already paid ${formatCurrency(plan.paid)}` : undefined}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={change.isPending}>
            Cancel
          </Button>
          <Button onClick={submit} loading={change.isPending} disabled={!plan || next === plan.finalFee}>
            Confirm
          </Button>
        </>
      }
    >
      <form onSubmit={submit} noValidate className="space-y-4">
        <FormError message={formError} />
        <FormGrid columns={3}>
          <FormInput label="Course fee (₹)" type="number" error={e.courseFee?.message} {...form.register('courseFee', { valueAsNumber: true })} />
          <FormInput label="Discount (₹)" type="number" error={e.discount?.message} {...form.register('discount', { valueAsNumber: true })} />
          <FormInput label="Scholarship (₹)" type="number" error={e.scholarship?.message} {...form.register('scholarship', { valueAsNumber: true })} />
        </FormGrid>
        {plan && (
          <p role="status" className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Are you sure you want to change the fee from <strong>{formatCurrency(plan.finalFee)}</strong> to <strong>{formatCurrency(next)}</strong>? Unpaid installments will be rebalanced automatically.
          </p>
        )}
        <FormTextarea label="Reason" required placeholder="Recorded in the audit log" error={e.reason?.message} {...form.register('reason')} />
      </form>
    </Dialog>
  )
}

/* ───────────── reschedule remaining installments ───────────── */

export function RescheduleInstallmentsDialog({ plan, onClose }: { plan: FeePlan | null; onClose: () => void }) {
  const resched = useRescheduleInstallments()
  const [formError, setFormError] = useState('')
  const totalRef = useMemo(() => ({ current: 0 }), [])
  totalRef.current = plan?.outstanding ?? 0
  const schema = useMemo(() => z.object({ installments: scheduleSchema(() => totalRef.current), reason: z.string().trim().min(5, 'Explain why the plan is changing (min 5 characters)') }), [totalRef])
  const form = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema), defaultValues: { installments: [], reason: '' } })
  useEffect(() => {
    if (!plan) return
    setFormError('')
    const open = plan.installments.filter((i) => i.status !== 'PAID' && i.status !== 'CANCELLED')
    form.reset({ installments: (open.length ? open : [{ amount: plan.outstanding, dueDate: today() }]).map((i) => ({ amount: i.amount - ('paidAmount' in i ? i.paidAmount : 0), dueDate: i.dueDate })), reason: '' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan?.id])
  const submit = form.handleSubmit(async (v) => {
    setFormError('')
    try {
      await resched.mutateAsync({ id: plan!.id, installments: v.installments, reason: v.reason })
      onClose()
    } catch (e) {
      setFormError(applyServerErrors(form, e))
    }
  })
  const e = form.formState.errors
  return (
    <Dialog
      open={!!plan}
      onClose={onClose}
      locked={resched.isPending}
      size="lg"
      title="Edit installment plan"
      description={plan ? `Outstanding ${formatCurrency(plan.outstanding)} will be spread over the schedule below.` : undefined}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={resched.isPending}>
            Cancel
          </Button>
          <Button onClick={submit} loading={resched.isPending}>
            Save schedule
          </Button>
        </>
      }
    >
      <form onSubmit={submit} noValidate className="space-y-4">
        <FormError message={formError} />
        <InstallmentsEditor control={form.control as unknown as Control<ScheduleValues>} register={form.register as unknown as UseFormRegister<ScheduleValues>} errors={e as unknown as FieldErrors<ScheduleValues>} total={plan?.outstanding ?? 0} minDate={undefined} />
        <FormTextarea label="Reason" required error={e.reason?.message} {...form.register('reason')} />
      </form>
    </Dialog>
  )
}

/* ───────────── record payment ───────────── */

export function RecordPaymentDialog({ open, onClose, plan, defaultInstallmentId }: { open: boolean; onClose: () => void; plan: FeePlan | null; defaultInstallmentId?: string }) {
  const record = useRecordPayment()
  const [formError, setFormError] = useState('')
  const [overpay, setOverpay] = useState(false)
  const schema = z.object({
    amount: z.number({ message: 'Enter the amount received' }).positive('Amount must be greater than ₹0'),
    method: z.enum(PAYMENT_METHODS),
    paymentDate: z.string().min(1, 'Choose the payment date').refine((d) => d <= today(), 'Payment date cannot be in the future'),
    transactionId: z.string().trim(),
    installmentId: z.string(),
    status: z.enum(['SUCCESS', 'PENDING']),
    notes: z.string().max(300),
  }).superRefine((v, ctx) => {
    if (v.method !== 'CASH' && v.method !== 'OTHER' && !v.transactionId) ctx.addIssue({ code: 'custom', path: ['transactionId'], message: 'Transaction ID is required for this method' })
  })
  const form = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema), defaultValues: { amount: 0, method: 'UPI', paymentDate: today(), transactionId: '', installmentId: '', status: 'SUCCESS', notes: '' } })
  const unpaid = plan?.installments.filter((i) => i.status === 'PENDING' || i.status === 'OVERDUE') ?? []
  const [amount, installmentId, method, status] = form.watch(['amount', 'installmentId', 'method', 'status'])

  useEffect(() => {
    if (!open || !plan) return
    setFormError('')
    setOverpay(false)
    const inst = unpaid.find((i) => i.id === defaultInstallmentId) ?? unpaid[0]
    form.reset({ amount: inst ? inst.amount - inst.paidAmount : plan.outstanding, method: 'UPI', paymentDate: today(), transactionId: '', installmentId: inst?.id ?? '', status: 'SUCCESS', notes: '' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, plan?.id, defaultInstallmentId])

  const exceeds = !!plan && status === 'SUCCESS' && (Number(amount) || 0) > plan.outstanding
  const submit = form.handleSubmit(async (v) => {
    setFormError('')
    try {
      await record.mutateAsync({ studentId: plan!.studentId, ...v, installmentId: v.installmentId || null, allowOverpayment: overpay })
      onClose()
    } catch (e) {
      setFormError(applyServerErrors(form, e))
    }
  })
  const e = form.formState.errors

  return (
    <Dialog
      open={open}
      onClose={onClose}
      locked={record.isPending}
      title="Record payment"
      description={plan ? `${plan.studentName} · outstanding ${formatCurrency(plan.outstanding)}` : undefined}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={record.isPending}>
            Cancel
          </Button>
          <Button onClick={submit} loading={record.isPending} disabled={exceeds && !overpay}>
            Record {formatCurrency(Number(amount) || 0)}
          </Button>
        </>
      }
    >
      <form onSubmit={submit} noValidate className="space-y-4">
        <FormError message={formError} />
        <FormGrid>
          <FormInput label="Amount (₹)" type="number" required min={1} error={e.amount?.message} {...form.register('amount', { valueAsNumber: true })} />
          <FormInput label="Payment date" type="date" required max={today()} error={e.paymentDate?.message} {...form.register('paymentDate')} />
          <FormSelect label="Payment method" options={optionsFrom(PAYMENT_METHODS)} {...form.register('method')} />
          <FormInput label="Transaction ID" required={method !== 'CASH' && method !== 'OTHER'} placeholder={method === 'CASH' ? 'Auto-generated receipt no.' : 'UTR / reference'} error={e.transactionId?.message} {...form.register('transactionId')} />
          <FormSelect label="Apply to installment" placeholder="Auto-allocate (oldest first)" options={unpaid.map((i) => ({ value: i.id, label: `#${i.number} · ${formatCurrency(i.amount - i.paidAmount)} due ${formatDate(i.dueDate)}${i.status === 'OVERDUE' ? ' (overdue)' : ''}` }))} {...form.register('installmentId')} />
          <FormSelect label="Status" options={[{ value: 'SUCCESS', label: 'Success (received)' }, { value: 'PENDING', label: 'Pending (awaiting confirmation)' }]} {...form.register('status')} />
        </FormGrid>
        {exceeds && (
          <div role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <p>
              This amount exceeds the outstanding balance of <strong>{formatCurrency(plan!.outstanding)}</strong>.
            </p>
            <label className="mt-2 flex items-center gap-2 font-medium">
              <Checkbox checked={overpay} onChange={(ev) => setOverpay(ev.target.checked)} /> Record the excess as an overpayment
            </label>
          </div>
        )}
        <FormTextarea label="Notes" error={e.notes?.message} {...form.register('notes')} />
        {installmentId === '' && unpaid.length === 0 && <p className="text-xs text-slate-500">All installments are settled; any payment recorded now will be flagged as an overpayment.</p>}
      </form>
    </Dialog>
  )
}

/* ───────────── edit payment ───────────── */

export function EditPaymentDialog({ payment, onClose }: { payment: Payment | null; onClose: () => void }) {
  const update = useUpdatePayment()
  const [formError, setFormError] = useState('')
  const [needsOverpay, setNeedsOverpay] = useState(false)
  const [overpay, setOverpay] = useState(false)
  const schema = z.object({
    amount: z.number({ message: 'Enter the amount' }).positive('Amount must be greater than ₹0'),
    method: z.enum(PAYMENT_METHODS),
    paymentDate: z.string().min(1, 'Required').refine((d) => d <= today(), 'Cannot be in the future'),
    transactionId: z.string().trim(),
    status: z.enum(['SUCCESS', 'PENDING', 'FAILED']),
    notes: z.string().max(300),
    reason: z.string().trim().min(5, 'Explain why this payment is being modified (min 5 characters)'),
  })
  const form = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema), defaultValues: { amount: 0, method: 'UPI', paymentDate: today(), transactionId: '', status: 'SUCCESS', notes: '', reason: '' } })
  useEffect(() => {
    if (payment) {
      setFormError('')
      setNeedsOverpay(false)
      setOverpay(false)
      form.reset({ amount: payment.amount, method: payment.method, paymentDate: payment.paymentDate, transactionId: payment.transactionId, status: payment.status === 'REFUNDED' ? 'SUCCESS' : payment.status, notes: payment.notes, reason: '' })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payment?.id])
  const submit = form.handleSubmit(async (v) => {
    setFormError('')
    try {
      await update.mutateAsync({ id: payment!.id, ...v, allowOverpayment: overpay })
      onClose()
    } catch (e) {
      const msg = applyServerErrors(form, e)
      if (/overpayment/i.test(msg)) setNeedsOverpay(true)
      setFormError(msg)
    }
  })
  const e = form.formState.errors
  return (
    <Dialog
      open={!!payment}
      onClose={onClose}
      locked={update.isPending}
      title={`Modify payment ${payment?.id ?? ''}`}
      description="Changes are written to the audit log together with your reason. Payments cannot be deleted."
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={update.isPending}>
            Cancel
          </Button>
          <Button onClick={submit} loading={update.isPending} disabled={needsOverpay && !overpay}>
            Save changes
          </Button>
        </>
      }
    >
      <form onSubmit={submit} noValidate className="space-y-4">
        <FormError message={formError} />
        <FormGrid>
          <FormInput label="Amount (₹)" type="number" error={e.amount?.message} {...form.register('amount', { valueAsNumber: true })} />
          <FormInput label="Payment date" type="date" max={today()} error={e.paymentDate?.message} {...form.register('paymentDate')} />
          <FormSelect label="Method" options={optionsFrom(PAYMENT_METHODS)} {...form.register('method')} />
          <FormInput label="Transaction ID" error={e.transactionId?.message} {...form.register('transactionId')} />
          <FormSelect label="Status" options={[{ value: 'SUCCESS', label: 'Success' }, { value: 'PENDING', label: 'Pending' }, { value: 'FAILED', label: 'Failed / void' }]} {...form.register('status')} />
        </FormGrid>
        {needsOverpay && (
          <label className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm font-medium text-amber-900">
            <Checkbox checked={overpay} onChange={(ev) => setOverpay(ev.target.checked)} /> Allow this to be recorded as an overpayment
          </label>
        )}
        <FormTextarea label="Notes" {...form.register('notes')} />
        <FormTextarea label="Reason for change" required error={e.reason?.message} {...form.register('reason')} />
      </form>
    </Dialog>
  )
}

/* ───────────── refund ───────────── */

export function RefundDialog({ payment, onClose }: { payment: Payment | null; onClose: () => void }) {
  const refund = useRefundPayment()
  const [formError, setFormError] = useState('')
  const schema = z.object({ amount: z.number({ message: 'Enter the refund amount' }).positive('Must be greater than ₹0'), reason: z.string().trim().min(5, 'Provide a reason (min 5 characters)') })
  const form = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema), defaultValues: { amount: 0, reason: '' } })
  useEffect(() => {
    if (payment) {
      setFormError('')
      form.reset({ amount: payment.amount, reason: '' })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payment?.id])
  const submit = form.handleSubmit(async (v) => {
    setFormError('')
    try {
      await refund.mutateAsync({ id: payment!.id, ...v })
      onClose()
    } catch (e) {
      setFormError(applyServerErrors(form, e))
    }
  })
  const e = form.formState.errors
  return (
    <Dialog
      open={!!payment}
      onClose={onClose}
      locked={refund.isPending}
      size="sm"
      title="Issue refund"
      description={payment ? `${payment.id} · ${formatCurrency(payment.amount)} via ${humanize(payment.method)}` : undefined}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={refund.isPending}>
            Cancel
          </Button>
          <Button variant="danger" onClick={submit} loading={refund.isPending}>
            Issue refund
          </Button>
        </>
      }
    >
      <form onSubmit={submit} noValidate className="space-y-4">
        <FormError message={formError} />
        <FormInput label="Refund amount (₹)" type="number" required hint="Partial refunds are allowed." error={e.amount?.message} {...form.register('amount', { valueAsNumber: true })} />
        <FormTextarea label="Reason" required error={e.reason?.message} {...form.register('reason')} />
      </form>
    </Dialog>
  )
}
