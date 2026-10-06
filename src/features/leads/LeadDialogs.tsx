import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { FormError, FormGrid, FormInput, FormSelect, FormTextarea } from '@/components/forms/fields'
import { applyServerErrors, PHONE_MESSAGE, PHONE_REGEX } from '@/components/forms/utils'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { EDUCATION_LEVELS, FOLLOW_UP_TYPES, GENDERS, LEAD_SOURCES, LEAD_STATUSES, PRIORITIES } from '@/constants/enums'
import { optionsFrom } from '@/constants/labels'
import { useAuth } from '@/features/auth/AuthContext'
import { useLookups } from '@/hooks/useLookups'
import type { FollowUp, Lead } from '@/types'
import { today } from '@/utils/clock'
import { useCompleteFollowUp, useConvertLead, useCreateFollowUp, useCreateLead, useRescheduleFollowUp, useUpdateLead } from './hooks'
import { toast } from 'sonner'

/* ───────────── lead form ───────────── */

const leadSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(80),
  phone: z.string().trim().regex(PHONE_REGEX, PHONE_MESSAGE),
  email: z.string().trim().refine((v) => v === '' || /^\S+@\S+\.\S+$/.test(v), 'Enter a valid email address'),
  location: z.string().trim().max(80),
  education: z.string(),
  interestedCourseId: z.string().min(1, 'Select a course'),
  source: z.enum(LEAD_SOURCES, { message: 'Select a lead source' }),
  assignedToId: z.string().min(1, 'Assign a counselor'),
  priority: z.enum(PRIORITIES),
  status: z.enum(LEAD_STATUSES),
  notes: z.string().max(500),
})
type LeadValues = z.infer<typeof leadSchema>

export function LeadFormDialog({ open, onClose, lead }: { open: boolean; onClose: () => void; lead?: Lead | null }) {
  const { user } = useAuth()
  const { courseOptions, employeeOptions } = useLookups()
  const create = useCreateLead()
  const update = useUpdateLead()
  const [formError, setFormError] = useState('')
  const editing = !!lead
  const form = useForm<LeadValues>({
    resolver: zodResolver(leadSchema),
    defaultValues: { name: '', phone: '', email: '', location: '', education: '', interestedCourseId: '', source: 'WEBSITE', assignedToId: '', priority: 'MEDIUM', status: 'NEW', notes: '' },
  })

  useEffect(() => {
    if (!open) return
    setFormError('')
    form.reset(
      lead
        ? { name: lead.name, phone: lead.phone, email: lead.email, location: lead.location, education: lead.education, interestedCourseId: lead.interestedCourseId, source: lead.source, assignedToId: lead.assignedToId, priority: lead.priority, status: lead.status, notes: '' }
        : { name: '', phone: '', email: '', location: '', education: '', interestedCourseId: '', source: 'WEBSITE', assignedToId: user?.role === 'COUNSELOR' ? user.id : '', priority: 'MEDIUM', status: 'NEW', notes: '' },
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, lead])

  const busy = create.isPending || update.isPending
  const submit = form.handleSubmit(async (values) => {
    setFormError('')
    try {
      if (editing) await update.mutateAsync({ id: lead!.id, body: values })
      else await create.mutateAsync(values)
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
      locked={busy}
      size="lg"
      title={editing ? `Edit lead — ${lead!.name}` : 'Add new lead'}
      description={editing ? lead!.id : 'Capture the enquiry details. A follow-up can be scheduled right after.'}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={submit} loading={busy}>
            {editing ? 'Save changes' : 'Create lead'}
          </Button>
        </>
      }
    >
      <form onSubmit={submit} noValidate className="space-y-4">
        <FormError message={formError} />
        <FormGrid>
          <FormInput label="Full name" required error={e.name?.message} {...form.register('name')} />
          <FormInput label="Phone" required inputMode="tel" placeholder="98765 43210" error={e.phone?.message} {...form.register('phone')} />
          <FormInput label="Email" type="email" error={e.email?.message} {...form.register('email')} />
          <FormInput label="Location" placeholder="City" error={e.location?.message} {...form.register('location')} />
          <FormSelect label="Education" placeholder="Select…" options={EDUCATION_LEVELS.map((v) => ({ value: v, label: v }))} error={e.education?.message} {...form.register('education')} />
          <FormSelect label="Interested course" required placeholder="Select course…" options={courseOptions} error={e.interestedCourseId?.message} {...form.register('interestedCourseId')} />
          <FormSelect label="Lead source" required options={optionsFrom(LEAD_SOURCES)} error={e.source?.message} {...form.register('source')} />
          <FormSelect label="Assigned counselor" required placeholder="Select counselor…" options={employeeOptions('COUNSELOR')} error={e.assignedToId?.message} {...form.register('assignedToId')} />
          <FormSelect label="Priority" options={optionsFrom(PRIORITIES)} {...form.register('priority')} />
          {editing && <FormSelect label="Status" options={optionsFrom(LEAD_STATUSES)} disabled={lead!.status === 'CONVERTED'} {...form.register('status')} />}
        </FormGrid>
        {!editing && <FormTextarea label="Initial note" placeholder="Anything the counselor should know…" error={e.notes?.message} {...form.register('notes')} />}
      </form>
    </Dialog>
  )
}

/* ───────────── follow-up scheduling ───────────── */

const followUpSchema = z.object({
  date: z.string().min(1, 'Choose a date').refine((d) => d >= today(), 'Date cannot be in the past'),
  time: z.string().min(1, 'Choose a time'),
  type: z.enum(FOLLOW_UP_TYPES),
  employeeId: z.string().min(1, 'Choose who will follow up'),
  notes: z.string().max(500),
})
type FollowUpValues = z.infer<typeof followUpSchema>

export function FollowUpFormDialog({ open, onClose, entity }: { open: boolean; onClose: () => void; entity: { id: string; name: string; type?: 'LEAD' | 'STUDENT'; assignedToId?: string } | null }) {
  const { employeeOptions } = useLookups()
  const { user } = useAuth()
  const create = useCreateFollowUp()
  const [formError, setFormError] = useState('')
  const form = useForm<FollowUpValues>({ resolver: zodResolver(followUpSchema), defaultValues: { date: today(), time: '11:00', type: 'PHONE_CALL', employeeId: '', notes: '' } })

  useEffect(() => {
    if (open) {
      setFormError('')
      form.reset({ date: today(), time: '11:00', type: 'PHONE_CALL', employeeId: entity?.assignedToId ?? user?.id ?? '', notes: '' })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, entity?.id])

  const submit = form.handleSubmit(async (v) => {
    setFormError('')
    try {
      await create.mutateAsync({ ...v, entityId: entity!.id, entityType: entity!.type ?? 'LEAD' })
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
      title="Schedule follow-up"
      description={entity ? `With ${entity.name}` : undefined}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={create.isPending}>
            Cancel
          </Button>
          <Button onClick={submit} loading={create.isPending}>
            Schedule
          </Button>
        </>
      }
    >
      <form onSubmit={submit} noValidate className="space-y-4">
        <FormError message={formError} />
        <FormGrid>
          <FormInput label="Date" type="date" min={today()} required error={e.date?.message} {...form.register('date')} />
          <FormInput label="Time" type="time" required error={e.time?.message} {...form.register('time')} />
          <FormSelect label="Type" options={optionsFrom(FOLLOW_UP_TYPES)} {...form.register('type')} />
          <FormSelect label="Employee" required placeholder="Select…" options={employeeOptions()} error={e.employeeId?.message} {...form.register('employeeId')} />
        </FormGrid>
        <FormTextarea label="Notes" placeholder="What should be discussed?" error={e.notes?.message} {...form.register('notes')} />
      </form>
    </Dialog>
  )
}

export function CompleteFollowUpDialog({ followUp, onClose }: { followUp: FollowUp | null; onClose: () => void }) {
  const complete = useCompleteFollowUp()
  const [error, setError] = useState('')
  const form = useForm<{ outcome: string; leadStatus: string }>({ defaultValues: { outcome: '', leadStatus: '' } })
  useEffect(() => {
    if (followUp) {
      form.reset({ outcome: '', leadStatus: '' })
      setError('')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [followUp?.id])
  const submit = form.handleSubmit(async (v) => {
    if (!v.outcome.trim()) return form.setError('outcome', { message: 'Record the outcome of this follow-up' })
    try {
      await complete.mutateAsync({ id: followUp!.id, outcome: v.outcome.trim(), leadStatus: (v.leadStatus || undefined) as Lead['status'] | undefined })
      onClose()
    } catch (e) {
      setError(applyServerErrors(form, e))
    }
  })
  return (
    <Dialog
      open={!!followUp}
      onClose={onClose}
      locked={complete.isPending}
      title="Complete follow-up"
      description={followUp ? `${followUp.entityName} · ${followUp.id}` : undefined}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={complete.isPending}>
            Cancel
          </Button>
          <Button onClick={submit} loading={complete.isPending}>
            Mark completed
          </Button>
        </>
      }
    >
      <form onSubmit={submit} noValidate className="space-y-4">
        <FormError message={error} />
        <FormTextarea label="Outcome" required placeholder="e.g. Interested — wants to visit the campus on Saturday." error={form.formState.errors.outcome?.message} {...form.register('outcome')} />
        {followUp?.entityType === 'LEAD' && <FormSelect label="Update lead status (optional)" placeholder="Keep current status" options={optionsFrom(LEAD_STATUSES.filter((s) => s !== 'CONVERTED' && s !== 'NEW'))} {...form.register('leadStatus')} />}
      </form>
    </Dialog>
  )
}

export function RescheduleDialog({ followUp, onClose }: { followUp: FollowUp | null; onClose: () => void }) {
  const resched = useRescheduleFollowUp()
  const [error, setError] = useState('')
  const schema = z.object({ date: z.string().min(1, 'Choose a date').refine((d) => d >= today(), 'Date cannot be in the past'), time: z.string().min(1, 'Choose a time'), reason: z.string().max(300) })
  const form = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema), defaultValues: { date: today(), time: '11:00', reason: '' } })
  useEffect(() => {
    if (followUp) {
      setError('')
      form.reset({ date: followUp.date >= today() ? followUp.date : today(), time: followUp.time, reason: '' })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [followUp?.id])
  const submit = form.handleSubmit(async (v) => {
    try {
      await resched.mutateAsync({ id: followUp!.id, ...v })
      onClose()
    } catch (e) {
      setError(applyServerErrors(form, e))
    }
  })
  const e = form.formState.errors
  return (
    <Dialog
      open={!!followUp}
      onClose={onClose}
      locked={resched.isPending}
      size="sm"
      title="Reschedule follow-up"
      description={followUp?.entityName}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={resched.isPending}>
            Cancel
          </Button>
          <Button onClick={submit} loading={resched.isPending}>
            Reschedule
          </Button>
        </>
      }
    >
      <form onSubmit={submit} noValidate className="space-y-4">
        <FormError message={error} />
        <FormGrid>
          <FormInput label="New date" type="date" min={today()} required error={e.date?.message} {...form.register('date')} />
          <FormInput label="New time" type="time" required error={e.time?.message} {...form.register('time')} />
        </FormGrid>
        <FormTextarea label="Reason" error={e.reason?.message} {...form.register('reason')} />
      </form>
    </Dialog>
  )
}

/* ───────────── convert lead ───────────── */

const convertSchema = z.object({
  mode: z.enum(['application', 'student']),
  dateOfBirth: z.string(),
  gender: z.enum(GENDERS),
})

export function ConvertLeadDialog({ lead, onClose }: { lead: Lead | null; onClose: () => void }) {
  const { can } = useAuth()
  const navigate = useNavigate()
  const convert = useConvertLead()
  const [error, setError] = useState('')
  const canApprove = can('applications:approve')
  const form = useForm<z.infer<typeof convertSchema>>({ resolver: zodResolver(convertSchema), defaultValues: { mode: 'application', dateOfBirth: '', gender: 'MALE' } })
  const mode = form.watch('mode')
  useEffect(() => {
    if (lead) {
      setError('')
      form.reset({ mode: 'application', dateOfBirth: '', gender: 'MALE' })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lead?.id])

  const submit = form.handleSubmit(async (v) => {
    setError('')
    try {
      const res = await convert.mutateAsync({ id: lead!.id, body: { mode: v.mode, dateOfBirth: v.dateOfBirth || undefined, gender: v.gender, city: lead!.location, education: lead!.education } })
      toast.success(res.studentId ? `${lead!.name} is now student ${res.studentId}` : `Application ${res.applicationId} created`)
      onClose()
      navigate(res.studentId ? `/students/${res.studentId}` : `/applications/${res.applicationId}`)
    } catch (e) {
      setError(applyServerErrors(form, e))
    }
  })

  return (
    <Dialog
      open={!!lead}
      onClose={onClose}
      locked={convert.isPending}
      title="Convert lead"
      description={lead ? `${lead.name} · ${lead.interestedCourseName}` : undefined}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={convert.isPending}>
            Cancel
          </Button>
          <Button onClick={submit} loading={convert.isPending}>
            {mode === 'student' ? 'Approve & create student' : 'Create application'}
          </Button>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        <FormError message={error} />
        <fieldset className="space-y-2">
          <legend className="mb-1 text-sm font-medium text-slate-700">What would you like to do?</legend>
          <label className="flex cursor-pointer gap-3 rounded-lg border border-slate-200 p-3 has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50">
            <input type="radio" value="application" className="mt-1" {...form.register('mode')} />
            <span>
              <span className="block text-sm font-medium">Create application</span>
              <span className="block text-xs text-slate-500">Raises an application for admission approval. Lead stays active as “Interested”.</span>
            </span>
          </label>
          <label className={`flex gap-3 rounded-lg border border-slate-200 p-3 has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50 ${canApprove ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'}`}>
            <input type="radio" value="student" disabled={!canApprove} className="mt-1" {...form.register('mode')} />
            <span>
              <span className="block text-sm font-medium">Approve admission &amp; create student</span>
              <span className="block text-xs text-slate-500">{canApprove ? 'Creates the application, approves admission and the student record in one step. Lead history is retained.' : 'Requires admission-approval permission (Admin).'}</span>
            </span>
          </label>
        </fieldset>
        {mode === 'student' && (
          <FormGrid>
            <FormInput label="Date of birth" type="date" max={today()} {...form.register('dateOfBirth')} />
            <FormSelect label="Gender" options={optionsFrom(GENDERS)} {...form.register('gender')} />
          </FormGrid>
        )}
      </form>
    </Dialog>
  )
}
