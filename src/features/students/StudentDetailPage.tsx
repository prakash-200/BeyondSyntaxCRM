import { zodResolver } from '@hookform/resolvers/zod'
import { Award, CalendarPlus, GraduationCap, Layers, Pencil, Plus, Repeat, ToggleLeft } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { z } from 'zod'
import { Can } from '@/components/common/Can'
import { useConfirm } from '@/components/common/ConfirmDialog'
import { EmptyState, ErrorState, LoadingState } from '@/components/common/States'
import { StatusBadge } from '@/components/common/StatusBadge'
import { FormError, FormSelect, FormTextarea } from '@/components/forms/fields'
import { applyServerErrors } from '@/components/forms/utils'
import { ActivityTimeline } from '@/components/timeline/ActivityTimeline'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Dialog } from '@/components/ui/dialog'
import { Avatar, DescriptionList, ProgressBar } from '@/components/ui/misc'
import { Tabs, TabPanel } from '@/components/ui/tabs'
import { STUDENT_STATUSES, type StudentStatus } from '@/constants/enums'
import { humanize } from '@/constants/labels'
import { Stepper } from '@/features/applications/ApplicationDetailPage'
import { useAuth } from '@/features/auth/AuthContext'
import { useBatch, useAssignStudent } from '@/features/batches/hooks'
import { TransferStudentDialog } from '@/features/batches/BatchDialogs'
import { useIssueCertificate } from '@/features/certificates/hooks'
import { FollowUpFormDialog } from '@/features/leads/LeadDialogs'
import { FeePlanPanel } from '@/features/payments/FeePlanPanel'
import { usePaymentLauncher } from '@/features/payments/PaymentLauncher'
import { useLookups } from '@/hooks/useLookups'
import type { Student } from '@/types'
import { cn } from '@/utils/cn'
import { formatCurrency, formatDate, formatPercent, formatPhone } from '@/utils/format'
import { DocumentsPanel } from './DocumentsPanel'
import { ProgressTab } from './ProgressTab'
import { StudentFormDialog } from './StudentDialogs'
import { useCompleteStudent, useSetStudentStatus, useStudent, useStudentActivity, useStudentApplication, useStudentAssignments, useStudentAttendance, useStudentBatchHistory, useStudentPayments } from './hooks'

/* ───────────── dialogs specific to this page ───────────── */

function ChangeStatusDialog({ student, open, onClose }: { student: Student; open: boolean; onClose: () => void }) {
  const setStatus = useSetStudentStatus()
  const [error, setError] = useState('')
  const schema = z.object({ status: z.enum(['ACTIVE', 'ON_HOLD', 'DROPPED', 'CANCELLED']), reason: z.string().trim() })
  const form = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema), defaultValues: { status: 'ON_HOLD', reason: '' } })
  const status = form.watch('status')
  useEffect(() => {
    if (open) {
      setError('')
      form.reset({ status: student.status === 'ACTIVE' ? 'ON_HOLD' : 'ACTIVE', reason: '' })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])
  const submit = form.handleSubmit(async (v) => {
    if (v.status !== 'ACTIVE' && v.reason.length < 5) return form.setError('reason', { message: 'A reason is required (min 5 characters)' })
    try {
      await setStatus.mutateAsync({ id: student.id, status: v.status as StudentStatus, reason: v.reason })
      onClose()
    } catch (e) {
      setError(applyServerErrors(form, e))
    }
  })
  const destructive = status === 'DROPPED' || status === 'CANCELLED'
  return (
    <Dialog
      open={open}
      onClose={onClose}
      locked={setStatus.isPending}
      size="sm"
      title="Change student status"
      description={`${student.fullName} is currently ${humanize(student.status)}.`}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={setStatus.isPending}>
            Cancel
          </Button>
          <Button variant={destructive ? 'danger' : 'primary'} onClick={submit} loading={setStatus.isPending}>
            Update status
          </Button>
        </>
      }
    >
      <form onSubmit={submit} noValidate className="space-y-4">
        <FormError message={error} />
        <FormSelect label="New status" options={STUDENT_STATUSES.filter((s) => s !== 'COMPLETED' && s !== student.status).map((s) => ({ value: s, label: humanize(s) }))} {...form.register('status')} />
        {destructive && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">The student will be removed from their batch and unpaid installments will be cancelled. Payments already received are kept.</p>}
        <FormTextarea label="Reason" required={status !== 'ACTIVE'} error={form.formState.errors.reason?.message} {...form.register('reason')} />
      </form>
    </Dialog>
  )
}

function AssignBatchDialog({ student, open, onClose }: { student: Student; open: boolean; onClose: () => void }) {
  const { lookups } = useLookups()
  const assign = useAssignStudent()
  const [batchId, setBatchId] = useState('')
  const [error, setError] = useState('')
  useEffect(() => {
    if (open) {
      setBatchId('')
      setError('')
    }
  }, [open])
  const options = (lookups?.batches ?? []).filter((b) => b.courseId === student.courseId && (b.status === 'UPCOMING' || b.status === 'ACTIVE')).map((b) => ({ value: b.id, label: `${b.name} (${humanize(b.status)})` }))
  return (
    <Dialog
      open={open}
      onClose={onClose}
      locked={assign.isPending}
      size="sm"
      title="Assign batch"
      description={`${student.fullName} · ${student.courseName}`}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={assign.isPending}>
            Cancel
          </Button>
          <Button
            disabled={!batchId}
            loading={assign.isPending}
            onClick={async () => {
              try {
                await assign.mutateAsync({ id: batchId, studentId: student.id })
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
        <FormError message={error} />
        <FormSelect label="Batch" placeholder={options.length ? 'Select a batch…' : 'No open batches for this course'} value={batchId} onChange={(e) => setBatchId(e.target.value)} options={options} hint="Completed and cancelled batches are not listed. Capacity is checked on assignment." />
      </div>
    </Dialog>
  )
}

/* ───────────── page ───────────── */

export default function StudentDetailPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { can } = useAuth()
  const confirm = useConfirm()
  const { data: s, isLoading, error, refetch } = useStudent(id)
  const showFees = can('fees:view')
  const payments = useStudentPayments(id, can('payments:view'))
  const attendance = useStudentAttendance(id, can('attendance:view'))
  const assignments = useStudentAssignments(id)
  const activity = useStudentActivity(id)
  const history = useStudentBatchHistory(id)
  const application = useStudentApplication(id, can(['students:view', 'applications:view']))
  const currentBatch = useBatch(s?.batchId ?? '')
  const complete = useCompleteStudent()
  const issue = useIssueCertificate()
  const launcher = usePaymentLauncher()
  const [tab, setTab] = useState('overview')
  const [dlg, setDlg] = useState<'edit' | 'status' | 'batch' | 'followup' | null>(null)
  const [transfer, setTransfer] = useState(false)

  if (isLoading) return <LoadingState label="Loading student…" />
  if (error || !s) return <ErrorState error={error} title="Unable to load student" onRetry={refetch} />
  const sum = s.summary
  const trainerView = !showFees
  const canTrain = can('progress:update')

  return (
    <>
      <div className="mb-6">
        <nav aria-label="Breadcrumb" className="mb-3 text-xs text-slate-500">
          <Link to="/students" className="hover:underline">Students</Link> / <span className="text-slate-700">{s.id}</span>
        </nav>
        <Card className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <Avatar name={s.fullName} size="lg" color="#4f46e5" />
              <div>
                <div className="flex flex-wrap items-center gap-2.5">
                  <h1 className="text-xl font-semibold tracking-tight text-slate-900">{s.fullName}</h1>
                  <StatusBadge status={s.status} />
                </div>
                <p className="mt-0.5 font-mono text-xs text-slate-500">{s.id}</p>
                <p className="mt-2 text-sm text-slate-600">
                  {formatPhone(s.phone)} · {s.email}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Can permission="students:update">
                <Button variant="outline" onClick={() => setDlg('edit')}>
                  <Pencil className="h-4 w-4" aria-hidden /> Edit
                </Button>
                <Button variant="outline" onClick={() => setDlg('status')} disabled={s.status === 'COMPLETED'}>
                  <ToggleLeft className="h-4 w-4" aria-hidden /> Status
                </Button>
              </Can>
              <Can permission="followups:create">
                <Button variant="outline" onClick={() => setDlg('followup')}>
                  <CalendarPlus className="h-4 w-4" aria-hidden /> Follow-up
                </Button>
              </Can>
              <Can permission="batches:update">
                {s.status === 'ACTIVE' && (s.batchId ? (
                  <Button variant="outline" onClick={() => setTransfer(true)}>
                    <Repeat className="h-4 w-4" aria-hidden /> Transfer batch
                  </Button>
                ) : (
                  <Button onClick={() => setDlg('batch')}>
                    <Layers className="h-4 w-4" aria-hidden /> Assign batch
                  </Button>
                ))}
              </Can>
              <Can permission="students:approve">
                {s.status === 'ACTIVE' && (
                  <Button
                    onClick={() =>
                      confirm({
                        title: `Mark ${s.fullName} as completed?`,
                        description: `Course progress is ${formatPercent(sum?.progressPercent ?? 0)}.`,
                        reason: (sum?.progressPercent ?? 0) < 90 ? { required: true, label: 'Reason for completing early' } : undefined,
                        confirmLabel: 'Mark completed',
                        run: (reason) => complete.mutateAsync({ id: s.id, reason: reason || undefined }),
                      })
                    }
                  >
                    <GraduationCap className="h-4 w-4" aria-hidden /> Mark completed
                  </Button>
                )}
              </Can>
              <Can permission="certificates:approve">
                {s.status === 'COMPLETED' && !s.certificateId && (
                  <Button
                    onClick={() =>
                      confirm({
                        title: `Issue certificate to ${s.fullName}?`,
                        description: s.courseName,
                        confirmLabel: 'Issue certificate',
                        run: async () => {
                          const c = await issue.mutateAsync({ studentId: s.id })
                          navigate(`/certificates/${c.id}`)
                        },
                      })
                    }
                  >
                    <Award className="h-4 w-4" aria-hidden /> Issue certificate
                  </Button>
                )}
              </Can>
              {s.certificateId && (
                <Button variant="outline">
                  <Award className="h-4 w-4" aria-hidden />
                  <Link to={`/certificates/${s.certificateId}`}>Certificate</Link>
                </Button>
              )}
            </div>
          </div>
          <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-slate-100 pt-4 text-sm sm:grid-cols-4">
            {[
              ['Counselor', s.counselorName],
              ['Course', s.courseName],
              ['Batch', s.batchId ? <Link className="text-brand-700 hover:underline" to={`/batches/${s.batchId}`}>{s.batchName}</Link> : 'Not assigned'],
              ['Trainer', s.trainerName ?? '—'],
            ].map(([l, v]) => (
              <div key={String(l)}>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{l}</dt>
                <dd className="mt-0.5 font-medium text-slate-900">{v}</dd>
              </div>
            ))}
          </dl>
        </Card>
      </div>

      <Tabs
        value={tab}
        onChange={setTab}
        label="Student sections"
        items={[
          { value: 'overview', label: 'Overview' },
          { value: 'application', label: 'Application', hidden: !can(['students:view', 'applications:view']) || trainerView },
          { value: 'courses', label: 'Courses' },
          { value: 'batch', label: 'Batch' },
          { value: 'fees', label: 'Fees', hidden: !showFees },
          { value: 'payments', label: 'Payments', hidden: !can('payments:view') },
          { value: 'attendance', label: 'Attendance', hidden: !can('attendance:view') },
          { value: 'assignments', label: 'Assignments', hidden: !can('assignments:view') },
          { value: 'progress', label: 'Progress' },
          { value: 'documents', label: 'Documents', hidden: trainerView },
          { value: 'activity', label: 'Activity' },
        ]}
      />

      <div className="mt-5">
        <TabPanel value="overview" active={tab}>
          <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              { l: 'Course progress', v: formatPercent(sum?.progressPercent ?? 0), bar: sum?.progressPercent ?? 0 },
              { l: 'Attendance', v: formatPercent(sum?.attendancePercent ?? 0), bar: sum?.attendancePercent ?? 0, hint: `${sum?.presentClasses ?? 0} of ${sum?.totalClasses ?? 0} classes` },
              ...(showFees
                ? [
                    { l: 'Total fee', v: formatCurrency(sum?.totalFee ?? 0) },
                    { l: 'Paid', v: formatCurrency(sum?.paidAmount ?? 0), tone: 'text-emerald-700' },
                    { l: 'Outstanding', v: formatCurrency(sum?.outstandingAmount ?? 0), tone: (sum?.outstandingAmount ?? 0) > 0 ? 'text-amber-700' : undefined },
                    { l: 'Next payment due', v: sum?.nextDueDate ? formatDate(sum.nextDueDate) : '—', hint: sum?.nextDueDate ? formatCurrency(sum.nextDueAmount ?? 0) : undefined },
                  ]
                : []),
              { l: 'Current batch', v: s.batchName ?? 'Not assigned' },
              { l: 'Admission date', v: formatDate(s.admissionDate) },
            ].map((t) => (
              <div key={t.l} className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                <p className="text-xs font-medium text-slate-500">{t.l}</p>
                <p className={cn('mt-1 truncate text-lg font-semibold tabular-nums', t.tone ?? 'text-slate-900')}>{t.v}</p>
                {'bar' in t && t.bar !== undefined && <ProgressBar value={t.bar} className="mt-2" label={t.l} />}
                {t.hint && <p className="mt-1 text-xs text-slate-500">{t.hint}</p>}
              </div>
            ))}
          </div>
          <Card>
            <CardHeader title="Profile" />
            <CardContent>
              <DescriptionList
                columns={3}
                items={[
                  { label: 'Date of birth', value: formatDate(s.dateOfBirth) },
                  { label: 'Gender', value: humanize(s.gender) },
                  { label: 'Source', value: humanize(s.source) },
                  { label: 'Address', value: [s.address, s.city, s.state, s.postalCode].filter(Boolean).join(', ') || '—' },
                  { label: 'Education', value: s.education || '—' },
                  { label: 'College', value: `${s.college || '—'}${s.graduationYear ? ` (${s.graduationYear})` : ''}` },
                  { label: 'Experience', value: s.experience || '—' },
                  { label: 'Current occupation', value: s.currentOccupation || '—' },
                  { label: 'Lead', value: s.leadId ? <Link className="text-brand-700 hover:underline" to={`/leads/${s.leadId}`}>{s.leadId}</Link> : '—' },
                ]}
              />
            </CardContent>
          </Card>
        </TabPanel>

        <TabPanel value="application" active={tab}>
          {application.isLoading ? (
            <LoadingState />
          ) : !application.data ? (
            <Card><EmptyState title="No application on record" /></Card>
          ) : (
            <div className="grid gap-4 lg:grid-cols-3">
              <Card className="lg:col-span-2">
                <CardHeader title={application.data.id} action={<Link to={`/applications/${application.data.id}`} className="text-sm font-medium text-brand-700 hover:underline">Open application</Link>} />
                <CardContent>
                  <DescriptionList items={[{ label: 'Status', value: <StatusBadge status={application.data.status} /> }, { label: 'Applied', value: formatDate(application.data.applicationDate) }, { label: 'Admission date', value: formatDate(application.data.admissionDate) }, { label: 'Counselor', value: application.data.counselorName }, { label: 'Notes', value: application.data.notes || '—' }]} />
                </CardContent>
              </Card>
              <Card>
                <CardHeader title="Progress timeline" />
                <CardContent><Stepper app={application.data} /></CardContent>
              </Card>
            </div>
          )}
        </TabPanel>

        <TabPanel value="courses" active={tab}>
          <Card>
            <CardHeader title={s.courseName} description="Enrolled course" action={<Link to={`/courses/${s.courseId}`} className="text-sm font-medium text-brand-700 hover:underline">View course</Link>} />
            <CardContent>
              <DescriptionList items={[{ label: 'Admission date', value: formatDate(s.admissionDate) }, { label: 'Completion date', value: formatDate(s.completedAt) }, { label: 'Overall progress', value: formatPercent(sum?.progressPercent ?? 0) }, { label: 'Certificate', value: s.certificateId ? <Link className="font-mono text-xs text-brand-700 hover:underline" to={`/certificates/${s.certificateId}`}>{s.certificateId}</Link> : 'Not issued' }]} />
            </CardContent>
          </Card>
        </TabPanel>

        <TabPanel value="batch" active={tab}>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader title="Current batch" />
              <CardContent>
                {currentBatch.data ? (
                  <div className="space-y-3">
                    <Link to={`/batches/${currentBatch.data.id}`} className="text-base font-semibold text-brand-700 hover:underline">{currentBatch.data.name}</Link>
                    <DescriptionList columns={1} items={[{ label: 'Trainer', value: currentBatch.data.trainerName }, { label: 'Schedule', value: `${currentBatch.data.days.map(humanize).join(', ')}` }, { label: 'Dates', value: `${formatDate(currentBatch.data.startDate)} → ${formatDate(currentBatch.data.endDate)}` }, { label: 'Status', value: <StatusBadge status={currentBatch.data.status} /> }]} />
                  </div>
                ) : (
                  <EmptyState title="Not assigned to a batch" className="py-6" action={can('batches:update') && s.status === 'ACTIVE' ? <Button onClick={() => setDlg('batch')}><Plus className="h-4 w-4" aria-hidden /> Assign batch</Button> : undefined} />
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader title="Batch history" description="Assignments, transfers and removals" />
              {!history.data?.length ? (
                <EmptyState title="No batch history" className="py-8" />
              ) : (
                <ul className="divide-y divide-slate-100">
                  {history.data.map((h) => (
                    <li key={h.id} className="px-5 py-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-slate-900">{h.batchName}</p>
                        <StatusBadge status={h.status} />
                      </div>
                      <p className="text-xs text-slate-500">
                        Joined {formatDate(h.joinedAt)}
                        {h.fromBatchName && ` · transferred from ${h.fromBatchName}`}
                      </p>
                      {h.reason && <p className="mt-0.5 text-xs italic text-slate-500">Reason: {h.reason}</p>}
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </TabPanel>

        <TabPanel value="fees" active={tab}>
          <FeePlanPanel student={{ id: s.id, fullName: s.fullName, courseId: s.courseId, courseName: s.courseName }} />
        </TabPanel>

        <TabPanel value="payments" active={tab}>
          <Card>
            <CardHeader title="Payment history" action={<Can permission="payments:create"><Button size="sm" onClick={() => launcher.launch(s.id)}><Plus className="h-3.5 w-3.5" aria-hidden /> Record payment</Button></Can>} />
            {payments.isLoading ? (
              <LoadingState className="py-8" />
            ) : !payments.data?.length ? (
              <EmptyState title="No payments yet" />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-left text-sm">
                  <caption className="sr-only">Payments by {s.fullName}</caption>
                  <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <tr><th className="px-5 py-3">Payment</th><th className="px-3 py-3">Date</th><th className="px-3 py-3">Method</th><th className="px-3 py-3 text-right">Amount</th><th className="px-3 py-3">Status</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {payments.data.map((p) => (
                      <tr key={p.id}>
                        <td className="px-5 py-3"><Link to={`/payments/${p.id}`} className="font-medium text-brand-700 hover:underline">{p.id}</Link></td>
                        <td className="px-3 py-3">{formatDate(p.paymentDate)}</td>
                        <td className="px-3 py-3">{humanize(p.method)}</td>
                        <td className="px-3 py-3 text-right font-medium tabular-nums">{formatCurrency(p.amount)}</td>
                        <td className="px-3 py-3"><StatusBadge status={p.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </TabPanel>

        <TabPanel value="attendance" active={tab}>
          {attendance.isLoading ? (
            <LoadingState />
          ) : attendance.error || !attendance.data ? (
            <ErrorState error={attendance.error} onRetry={attendance.refetch} />
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                {[['Total classes', attendance.data.summary.totalClasses], ['Present', attendance.data.summary.present], ['Late', attendance.data.summary.late], ['Absent', attendance.data.summary.absent], ['Attendance', formatPercent(attendance.data.summary.percent)]].map(([l, v]) => (
                  <div key={String(l)} className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                    <p className="text-xs text-slate-500">{l}</p>
                    <p className={cn('mt-1 text-xl font-semibold tabular-nums', l === 'Attendance' && attendance.data.summary.percent < 75 && 'text-red-600')}>{v}</p>
                  </div>
                ))}
              </div>
              <Card>
                <CardHeader title="Class register" description="Most recent first" />
                {!attendance.data.records.length ? (
                  <EmptyState title="No classes recorded yet" />
                ) : (
                  <ul className="max-h-96 divide-y divide-slate-100 overflow-y-auto">
                    {attendance.data.records.slice(0, 40).map((r) => (
                      <li key={r.sessionId} className="flex items-center justify-between gap-3 px-5 py-2.5">
                        <div><p className="text-sm text-slate-900">{formatDate(r.date)}</p><p className="text-xs text-slate-500">{r.topic}</p></div>
                        <StatusBadge status={r.status} />
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </div>
          )}
        </TabPanel>

        <TabPanel value="assignments" active={tab}>
          <Card>
            <CardHeader title="Assignments" />
            {assignments.isLoading ? (
              <LoadingState className="py-8" />
            ) : !assignments.data?.length ? (
              <EmptyState title="No assignments yet" />
            ) : (
              <ul className="divide-y divide-slate-100">
                {assignments.data.map((a) => (
                  <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                    <div>
                      <p className="text-sm font-medium text-slate-900">{a.assignmentTitle}</p>
                      <p className="text-xs text-slate-500">Due {formatDate(a.dueDate)}{a.feedback && ` · “${a.feedback}”`}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      {a.score !== null && a.score !== undefined && <span className="text-sm font-semibold tabular-nums">{a.score}/{a.maxMarks}</span>}
                      <StatusBadge status={a.status} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </TabPanel>

        <TabPanel value="progress" active={tab}>
          <ProgressTab studentId={s.id} editable={canTrain && s.status === 'ACTIVE'} />
        </TabPanel>

        <TabPanel value="documents" active={tab}>
          <DocumentsPanel ownerType="STUDENT" ownerId={s.id} />
        </TabPanel>

        <TabPanel value="activity" active={tab}>
          <Card>
            <CardContent>
              <ActivityTimeline items={activity.data} isLoading={activity.isLoading} error={activity.error} onRetry={activity.refetch} />
            </CardContent>
          </Card>
        </TabPanel>
      </div>

      <StudentFormDialog open={dlg === 'edit'} student={s} onClose={() => setDlg(null)} />
      <ChangeStatusDialog student={s} open={dlg === 'status'} onClose={() => setDlg(null)} />
      <AssignBatchDialog student={s} open={dlg === 'batch'} onClose={() => setDlg(null)} />
      <FollowUpFormDialog open={dlg === 'followup'} onClose={() => setDlg(null)} entity={{ id: s.id, name: s.fullName, type: 'STUDENT', assignedToId: s.counselorId }} />
      {currentBatch.data && <TransferStudentDialog batch={currentBatch.data} student={transfer ? { id: s.id, name: s.fullName } : null} onClose={() => setTransfer(false)} />}
      {launcher.node}
    </>
  )
}
