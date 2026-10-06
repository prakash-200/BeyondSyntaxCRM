import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowRight } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { FormError, FormGrid, FormInput, FormSelect, FormTextarea } from '@/components/forms/fields'
import { applyServerErrors } from '@/components/forms/utils'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { BATCH_STATUSES, COURSE_MODES, WEEKDAYS, type Weekday } from '@/constants/enums'
import { humanize, optionsFrom } from '@/constants/labels'
import { useLookups } from '@/hooks/useLookups'
import type { Batch } from '@/types'
import { cn } from '@/utils/cn'
import { useAssignStudent, useCreateBatch, useEligibleStudents, useTransferStudent, useUpdateBatch } from './hooks'

const schema = z
  .object({
    name: z.string().trim().min(3, 'Enter a batch name, e.g. DOTNET-OCT-2026-A').max(40),
    courseId: z.string().min(1, 'Select a course'),
    trainerId: z.string().min(1, 'Select a trainer'),
    startDate: z.string().min(1, 'Choose a start date'),
    endDate: z.string().min(1, 'Choose an end date'),
    startTime: z.string().min(1, 'Required'),
    endTime: z.string().min(1, 'Required'),
    days: z.array(z.enum(WEEKDAYS)).min(1, 'Select at least one class day'),
    capacity: z.number({ message: 'Enter the capacity' }).int().min(1, 'At least 1').max(200),
    mode: z.enum(COURSE_MODES),
    location: z.string().trim().max(100),
    status: z.enum(BATCH_STATUSES),
  })
  .superRefine((v, ctx) => {
    if (v.startDate && v.endDate && v.endDate <= v.startDate) ctx.addIssue({ code: 'custom', path: ['endDate'], message: 'End date must be after the start date' })
    if (v.startTime && v.endTime && v.endTime <= v.startTime) ctx.addIssue({ code: 'custom', path: ['endTime'], message: 'End time must be after the start time' })
  })
type Values = z.infer<typeof schema>

const EMPTY: Values = { name: '', courseId: '', trainerId: '', startDate: '', endDate: '', startTime: '19:00', endTime: '21:00', days: ['MON', 'TUE', 'WED', 'THU', 'FRI'], capacity: 30, mode: 'OFFLINE', location: '', status: 'UPCOMING' }

export function BatchFormDialog({ open, onClose, batch }: { open: boolean; onClose: () => void; batch?: Batch | null }) {
  const { courseOptions, employeeOptions } = useLookups()
  const create = useCreateBatch()
  const update = useUpdateBatch()
  const [formError, setFormError] = useState('')
  const editing = !!batch
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: EMPTY })
  const days = form.watch('days')

  useEffect(() => {
    if (!open) return
    setFormError('')
    form.reset(batch ? { name: batch.name, courseId: batch.courseId, trainerId: batch.trainerId, startDate: batch.startDate, endDate: batch.endDate, startTime: batch.startTime, endTime: batch.endTime, days: batch.days, capacity: batch.capacity, mode: batch.mode, location: batch.location, status: batch.status } : EMPTY)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, batch])

  const busy = create.isPending || update.isPending
  const submit = form.handleSubmit(async (v) => {
    setFormError('')
    try {
      if (editing) await update.mutateAsync({ id: batch!.id, body: v })
      else await create.mutateAsync(v)
      onClose()
    } catch (e) {
      setFormError(applyServerErrors(form, e))
    }
  })
  const e = form.formState.errors
  const toggleDay = (d: Weekday) => form.setValue('days', days.includes(d) ? days.filter((x) => x !== d) : WEEKDAYS.filter((x) => x === d || days.includes(x)), { shouldValidate: true })

  return (
    <Dialog
      open={open}
      onClose={onClose}
      locked={busy}
      size="lg"
      title={editing ? `Edit batch — ${batch!.name}` : 'Create batch'}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={submit} loading={busy}>
            {editing ? 'Save changes' : 'Create batch'}
          </Button>
        </>
      }
    >
      <form onSubmit={submit} noValidate className="space-y-4">
        <FormError message={formError} />
        <FormGrid>
          <FormInput label="Batch name" required wrapperClassName="sm:col-span-2" placeholder="DOTNET-OCT-2026-A" error={e.name?.message} {...form.register('name')} />
          <FormSelect label="Course" required placeholder="Select…" options={courseOptions} disabled={editing} error={e.courseId?.message} {...form.register('courseId')} />
          <FormSelect label="Trainer" required placeholder="Select…" options={employeeOptions('TRAINER')} error={e.trainerId?.message} {...form.register('trainerId')} />
          <FormInput label="Start date" type="date" required error={e.startDate?.message} {...form.register('startDate')} />
          <FormInput label="End date" type="date" required error={e.endDate?.message} {...form.register('endDate')} />
          <FormInput label="Start time" type="time" required error={e.startTime?.message} {...form.register('startTime')} />
          <FormInput label="End time" type="time" required error={e.endTime?.message} {...form.register('endTime')} />
          <FormInput label="Capacity" type="number" required error={e.capacity?.message} {...form.register('capacity', { valueAsNumber: true })} />
          <FormSelect label="Mode" options={optionsFrom(COURSE_MODES)} {...form.register('mode')} />
          <FormInput label="Location" wrapperClassName="sm:col-span-2" placeholder="Campus or meeting link" {...form.register('location')} />
          {editing && <FormSelect label="Status" options={optionsFrom(BATCH_STATUSES)} {...form.register('status')} />}
        </FormGrid>
        <fieldset>
          <legend className="mb-1.5 text-sm font-medium text-slate-700">
            Class days <span className="text-red-600" aria-hidden>*</span>
          </legend>
          <div className="flex flex-wrap gap-2">
            {WEEKDAYS.map((d) => (
              <button key={d} type="button" aria-pressed={days.includes(d)} onClick={() => toggleDay(d)} className={cn('rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors', days.includes(d) ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50')}>
                {humanize(d)}
              </button>
            ))}
          </div>
          {e.days?.message && <p role="alert" className="mt-1 text-xs font-medium text-red-600">{e.days.message}</p>}
        </fieldset>
      </form>
    </Dialog>
  )
}

export function AssignStudentDialog({ batch, open, onClose }: { batch: Batch; open: boolean; onClose: () => void }) {
  const eligible = useEligibleStudents(batch.id, open)
  const assign = useAssignStudent()
  const [studentId, setStudentId] = useState('')
  const [error, setError] = useState('')
  useEffect(() => {
    if (open) {
      setStudentId('')
      setError('')
    }
  }, [open])
  const full = batch.currentStudentCount >= batch.capacity
  return (
    <Dialog
      open={open}
      onClose={onClose}
      locked={assign.isPending}
      size="sm"
      title="Assign student"
      description={`${batch.name} · ${batch.currentStudentCount}/${batch.capacity} seats filled`}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={assign.isPending}>
            Cancel
          </Button>
          <Button
            disabled={!studentId || full}
            loading={assign.isPending}
            onClick={async () => {
              try {
                await assign.mutateAsync({ id: batch.id, studentId })
                onClose()
              } catch (e) {
                setError(e instanceof Error ? e.message : 'Failed')
              }
            }}
          >
            Assign
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <FormError message={error || (full ? `This batch is full (capacity ${batch.capacity}).` : '')} />
        <FormSelect
          label="Student"
          placeholder={eligible.isLoading ? 'Loading…' : eligible.data?.length ? 'Select a student…' : 'No eligible students'}
          value={studentId}
          onChange={(e) => setStudentId(e.target.value)}
          options={(eligible.data ?? []).map((s) => ({ value: s.id, label: `${s.fullName} (${s.id})` }))}
          hint="Active students of this course who are not yet in a batch."
        />
      </div>
    </Dialog>
  )
}

export function TransferStudentDialog({ batch, student, onClose }: { batch: Batch; student: { id: string; name: string } | null; onClose: () => void }) {
  const { lookups } = useLookups()
  const transfer = useTransferStudent()
  const [error, setError] = useState('')
  const schema2 = z.object({ toBatchId: z.string().min(1, 'Select the destination batch'), reason: z.string().trim().min(5, 'Record why the student is moving (min 5 characters)') })
  const form = useForm<z.infer<typeof schema2>>({ resolver: zodResolver(schema2), defaultValues: { toBatchId: '', reason: '' } })
  const to = form.watch('toBatchId')
  useEffect(() => {
    if (student) {
      form.reset({ toBatchId: '', reason: '' })
      setError('')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [student?.id])
  const targets = (lookups?.batches ?? []).filter((b) => b.courseId === batch.courseId && b.id !== batch.id && (b.status === 'UPCOMING' || b.status === 'ACTIVE'))
  const submit = form.handleSubmit(async (v) => {
    try {
      await transfer.mutateAsync({ id: batch.id, studentId: student!.id, ...v })
      onClose()
    } catch (e) {
      setError(applyServerErrors(form, e))
    }
  })
  const toName = targets.find((b) => b.id === to)?.name
  return (
    <Dialog
      open={!!student}
      onClose={onClose}
      locked={transfer.isPending}
      title="Transfer student"
      description={student?.name}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={transfer.isPending}>
            Cancel
          </Button>
          <Button onClick={submit} loading={transfer.isPending}>
            Transfer
          </Button>
        </>
      }
    >
      <form onSubmit={submit} noValidate className="space-y-4">
        <FormError message={error} />
        <div className="flex items-center justify-center gap-3 rounded-lg bg-slate-50 px-4 py-3 text-sm font-medium">
          <span>{batch.name}</span>
          <ArrowRight className="h-4 w-4 text-slate-400" aria-hidden />
          <span className={toName ? 'text-brand-700' : 'text-slate-400'}>{toName ?? 'Select destination'}</span>
        </div>
        <FormSelect label="Transfer to" required placeholder="Select batch…" options={targets.map((b) => ({ value: b.id, label: `${b.name} (${humanize(b.status)})` }))} error={form.formState.errors.toBatchId?.message} {...form.register('toBatchId')} />
        <FormTextarea label="Reason" required placeholder="e.g. Student requested weekend batch." error={form.formState.errors.reason?.message} {...form.register('reason')} />
      </form>
    </Dialog>
  )
}
