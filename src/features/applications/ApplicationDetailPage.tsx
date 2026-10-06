import { zodResolver } from '@hookform/resolvers/zod'
import { Check, CheckCircle2, Circle, ExternalLink, UserCheck, XCircle } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { z } from 'zod'
import { Can } from '@/components/common/Can'
import { useConfirm } from '@/components/common/ConfirmDialog'
import { PageHeader } from '@/components/common/PageHeader'
import { ErrorState, LoadingState } from '@/components/common/States'
import { StatusBadge } from '@/components/common/StatusBadge'
import { FormError, FormGrid, FormInput, FormSelect } from '@/components/forms/fields'
import { applyServerErrors } from '@/components/forms/utils'
import { ActivityTimeline } from '@/components/timeline/ActivityTimeline'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Dialog } from '@/components/ui/dialog'
import { DescriptionList } from '@/components/ui/misc'
import { Tabs, TabPanel } from '@/components/ui/tabs'
import { GENDERS, type ApplicationStatus } from '@/constants/enums'
import { humanize, optionsFrom } from '@/constants/labels'
import { DocumentsPanel } from '@/features/students/DocumentsPanel'
import { cn } from '@/utils/cn'
import { today } from '@/utils/clock'
import { formatDate, formatDateTime, formatPhone } from '@/utils/format'
import { useApplication, useApplicationActivity, useApproveApplication, useSetApplicationStatus } from './hooks'
import type { Application } from '@/types'

const STEPS: { status?: ApplicationStatus; label: string }[] = [
  { status: 'APPLICATION_SUBMITTED', label: 'Application Submitted' },
  { status: 'COUNSELLING', label: 'Counselling Completed' },
  { status: 'ADMISSION_APPROVED', label: 'Admission Approved' },
  { status: 'PAYMENT_COMPLETED', label: 'Payment Completed' },
  { status: 'BATCH_ASSIGNED', label: 'Batch Assigned' },
  { status: 'TRAINING_STARTED', label: 'Training Started' },
  { status: 'TRAINING_COMPLETED', label: 'Training Completed' },
  { label: 'Certificate Issued' },
]
const PRE_FLOW: ApplicationStatus[] = ['NEW', 'CONTACTED', 'COUNSELLING', 'APPLICATION_SUBMITTED']

export function Stepper({ app }: { app: Application }) {
  const at = (s?: ApplicationStatus) => (s ? app.history.find((h) => h.status === s) : undefined)
  const done = (s?: ApplicationStatus) => (s ? !!at(s) : !!app.certificateId)
  const firstPending = STEPS.findIndex((s) => !done(s.status))
  return (
    <ol className="space-y-0" aria-label="Application progress">
      {STEPS.map((s, i) => {
        const isDone = done(s.status)
        const entry = at(s.status)
        const current = !isDone && i === firstPending && app.status !== 'CANCELLED'
        return (
          <li key={s.label} className="relative flex gap-3 pb-6 last:pb-0">
            {i < STEPS.length - 1 && <span className={cn('absolute left-[11px] top-6 h-[calc(100%-1.5rem)] w-0.5', isDone ? 'bg-emerald-300' : 'bg-slate-200')} aria-hidden />}
            <span className="relative z-10 mt-0.5">
              {isDone ? <CheckCircle2 className="h-6 w-6 fill-white text-emerald-600" aria-hidden /> : <Circle className={cn('h-6 w-6 fill-white', current ? 'text-brand-600' : 'text-slate-300')} aria-hidden />}
            </span>
            <div>
              <p className={cn('text-sm font-medium', isDone ? 'text-slate-900' : current ? 'text-brand-700' : 'text-slate-400')}>
                {s.label}
                <span className="sr-only">{isDone ? ' — completed' : current ? ' — next step' : ' — pending'}</span>
              </p>
              {entry && (
                <p className="text-xs text-slate-500">
                  {formatDateTime(entry.at)} · {entry.byName}
                </p>
              )}
              {!entry && s.label === 'Certificate Issued' && app.certificateId && (
                <Link to={`/certificates/${app.certificateId}`} className="text-xs font-medium text-brand-700 hover:underline">
                  {app.certificateId}
                </Link>
              )}
              {current && <p className="text-xs text-brand-600">Up next</p>}
            </div>
          </li>
        )
      })}
    </ol>
  )
}

const approveSchema = z.object({ admissionDate: z.string().min(1, 'Choose the admission date'), dateOfBirth: z.string(), gender: z.enum(GENDERS), city: z.string().max(80), education: z.string().max(80) })

function ApproveDialog({ app, open, onClose }: { app: Application; open: boolean; onClose: () => void }) {
  const approve = useApproveApplication()
  const navigate = useNavigate()
  const [err, setErr] = useState('')
  const form = useForm<z.infer<typeof approveSchema>>({ resolver: zodResolver(approveSchema), defaultValues: { admissionDate: today(), dateOfBirth: '', gender: 'MALE', city: '', education: '' } })
  useEffect(() => {
    if (open) {
      setErr('')
      form.reset({ admissionDate: today(), dateOfBirth: '', gender: 'MALE', city: '', education: '' })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])
  const submit = form.handleSubmit(async (v) => {
    try {
      const res = await approve.mutateAsync({ id: app.id, body: { ...v, dateOfBirth: v.dateOfBirth || undefined } })
      onClose()
      navigate(`/students/${res.studentId}`)
    } catch (e) {
      setErr(applyServerErrors(form, e))
    }
  })
  const e = form.formState.errors
  return (
    <Dialog
      open={open}
      onClose={onClose}
      locked={approve.isPending}
      title="Approve admission"
      description={`${app.applicantName} · ${app.courseName}. This creates the student record.`}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={approve.isPending}>
            Cancel
          </Button>
          <Button onClick={submit} loading={approve.isPending}>
            Approve & create student
          </Button>
        </>
      }
    >
      <form onSubmit={submit} noValidate className="space-y-4">
        <FormError message={err} />
        <FormGrid>
          <FormInput label="Admission date" type="date" required max={today()} error={e.admissionDate?.message} {...form.register('admissionDate')} />
          <FormInput label="Date of birth" type="date" max={today()} {...form.register('dateOfBirth')} />
          <FormSelect label="Gender" options={optionsFrom(GENDERS)} {...form.register('gender')} />
          <FormInput label="City" {...form.register('city')} />
          <FormInput label="Education" wrapperClassName="sm:col-span-2" {...form.register('education')} />
        </FormGrid>
        <p className="text-xs text-slate-500">More profile details can be completed later from the student page.</p>
      </form>
    </Dialog>
  )
}

export default function ApplicationDetailPage() {
  const { id = '' } = useParams()
  const { data: app, isLoading, error, refetch } = useApplication(id)
  const activity = useApplicationActivity(id)
  const setStatus = useSetApplicationStatus()
  const confirm = useConfirm()
  const [tab, setTab] = useState('overview')
  const [approving, setApproving] = useState(false)

  if (isLoading) return <LoadingState label="Loading application…" />
  if (error || !app) return <ErrorState error={error} title="Unable to load application" onRetry={refetch} />

  const preAdmission = !app.studentId && app.status !== 'CANCELLED'
  const nextStatus = PRE_FLOW[PRE_FLOW.indexOf(app.status as ApplicationStatus) + 1]
  const submitted = app.history.some((h) => h.status === 'APPLICATION_SUBMITTED')

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: 'Applications', to: '/applications' }, { label: app.id }]}
        title={
          <span className="flex flex-wrap items-center gap-3">
            {app.applicantName}
            <StatusBadge status={app.status} />
          </span>
        }
        description={`${app.id} · ${app.courseName} · applied ${formatDate(app.applicationDate)}`}
        actions={
          preAdmission && (
            <>
              <Can permission="applications:update">
                {nextStatus && (
                  <Button variant="outline" loading={setStatus.isPending} onClick={() => setStatus.mutate({ id: app.id, status: nextStatus })}>
                    <Check className="h-4 w-4" aria-hidden /> Mark {humanize(nextStatus)}
                  </Button>
                )}
                <Button
                  variant="danger-outline"
                  onClick={() => confirm({ title: 'Cancel this application?', description: 'The application will be closed. The lead record is kept.', reason: { required: true, label: 'Reason for cancelling' }, confirmLabel: 'Cancel application', cancelLabel: 'Keep', tone: 'danger', run: (reason) => setStatus.mutateAsync({ id: app.id, status: 'CANCELLED', note: reason }) })}
                >
                  <XCircle className="h-4 w-4" aria-hidden /> Cancel
                </Button>
              </Can>
              <Can permission="applications:approve">
                <Button onClick={() => setApproving(true)} disabled={!submitted} title={submitted ? undefined : 'Submit the application first'}>
                  <UserCheck className="h-4 w-4" aria-hidden /> Approve admission
                </Button>
              </Can>
            </>
          )
        }
      />
      <Tabs
        value={tab}
        onChange={setTab}
        label="Application sections"
        items={[
          { value: 'overview', label: 'Overview' },
          { value: 'documents', label: 'Documents', count: app.documentCount },
          { value: 'activity', label: 'Activity' },
        ]}
      />
      <div className="mt-5">
        <TabPanel value="overview" active={tab}>
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="space-y-4 lg:col-span-2">
              <Card>
                <CardHeader title="Application details" />
                <CardContent>
                  <DescriptionList
                    items={[
                      { label: 'Applicant', value: app.applicantName },
                      { label: 'Phone', value: formatPhone(app.phone) },
                      { label: 'Email', value: app.email || '—' },
                      { label: 'Course', value: app.courseName },
                      { label: 'Preferred batch', value: app.preferredBatchName ?? '—' },
                      { label: 'Counselor', value: app.counselorName },
                      { label: 'Application date', value: formatDate(app.applicationDate) },
                      { label: 'Admission date', value: formatDate(app.admissionDate) },
                      { label: 'Linked lead', value: app.leadId ? <Link className="inline-flex items-center gap-1 text-brand-700 hover:underline" to={`/leads/${app.leadId}`}>{app.leadId} <ExternalLink className="h-3 w-3" aria-hidden /></Link> : '—' },
                      { label: 'Student record', value: app.studentId ? <Link className="inline-flex items-center gap-1 text-brand-700 hover:underline" to={`/students/${app.studentId}`}>{app.studentId} <ExternalLink className="h-3 w-3" aria-hidden /></Link> : 'Not created yet' },
                    ]}
                  />
                  {app.notes && (
                    <div className="mt-5 border-t border-slate-100 pt-4">
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Notes</p>
                      <p className="mt-1 whitespace-pre-line text-sm text-slate-700">{app.notes}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardHeader title="Status history" />
                <CardContent>
                  <ul className="space-y-2.5">
                    {app.history.map((h) => (
                      <li key={h.status + h.at} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                        <StatusBadge status={h.status} />
                        <span className="text-slate-500">
                          {formatDateTime(h.at)} · {h.byName}
                        </span>
                        {h.note && <span className="text-slate-600">— {h.note}</span>}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </div>
            <Card className="h-fit">
              <CardHeader title="Progress timeline" description={app.status === 'CANCELLED' ? 'This application was cancelled.' : undefined} />
              <CardContent>
                <Stepper app={app} />
              </CardContent>
            </Card>
          </div>
        </TabPanel>
        <TabPanel value="documents" active={tab}>
          <DocumentsPanel ownerType={app.studentId ? 'STUDENT' : 'APPLICATION'} ownerId={app.studentId ?? app.id} />
        </TabPanel>
        <TabPanel value="activity" active={tab}>
          <Card>
            <CardContent>
              <ActivityTimeline items={activity.data} isLoading={activity.isLoading} error={activity.error} onRetry={activity.refetch} />
            </CardContent>
          </Card>
        </TabPanel>
      </div>
      <ApproveDialog app={app} open={approving} onClose={() => setApproving(false)} />
    </>
  )
}
