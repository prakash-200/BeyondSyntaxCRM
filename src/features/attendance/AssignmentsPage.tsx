import { zodResolver } from '@hookform/resolvers/zod'
import { ClipboardCheck, Plus, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Can } from '@/components/common/Can'
import { useConfirm } from '@/components/common/ConfirmDialog'
import { PageHeader } from '@/components/common/PageHeader'
import { EmptyState, ErrorState, LoadingState } from '@/components/common/States'
import { StatusBadge } from '@/components/common/StatusBadge'
import { FormError, FormGrid, FormInput, FormSelect, FormTextarea } from '@/components/forms/fields'
import { applyServerErrors } from '@/components/forms/utils'
import { DataTable, type Column } from '@/components/tables/DataTable'
import { ListFilters } from '@/components/tables/FilterBar'
import { Button } from '@/components/ui/button'
import { Dialog, Drawer } from '@/components/ui/dialog'
import { ProgressBar } from '@/components/ui/misc'
import { useAuth } from '@/features/auth/AuthContext'
import { useBatches } from '@/features/batches/hooks'
import { useListState } from '@/hooks/useListState'
import { useLookups } from '@/hooks/useLookups'
import type { Assignment, AssignmentSubmission } from '@/types'
import { today } from '@/utils/clock'
import { formatDate, formatDateTime } from '@/utils/format'
import { useAssignments, useCourseModulesFor, useCreateAssignment, useDeleteAssignment, useGradeSubmission, useSubmissions } from './hooks'

const schema = z.object({
  batchId: z.string().min(1, 'Select a batch'),
  moduleId: z.string().min(1, 'Select a module'),
  title: z.string().trim().min(3, 'Enter a title (min 3 characters)').max(120),
  description: z.string().max(1000),
  dueDate: z.string().min(1, 'Choose a due date'),
  maxMarks: z.number({ message: 'Enter the maximum marks' }).positive('Must be greater than 0').max(1000),
})

function AssignmentFormDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const create = useCreateAssignment()
  const batches = useBatches({ pageSize: 100, sort: 'startDate', order: 'desc' })
  const [error, setError] = useState('')
  const form = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema), defaultValues: { batchId: '', moduleId: '', title: '', description: '', dueDate: '', maxMarks: 20 } })
  const batchId = form.watch('batchId')
  const courseId = batches.data?.items.find((b) => b.id === batchId)?.courseId ?? ''
  const modules = useCourseModulesFor(courseId)
  useEffect(() => {
    if (open) {
      form.reset()
      setError('')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])
  const submit = form.handleSubmit(async (v) => {
    setError('')
    try {
      await create.mutateAsync(v)
      onClose()
    } catch (e) {
      setError(applyServerErrors(form, e))
    }
  })
  const e = form.formState.errors
  return (
    <Dialog
      open={open}
      onClose={onClose}
      locked={create.isPending}
      size="lg"
      title="New assignment"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={create.isPending}>Cancel</Button>
          <Button onClick={submit} loading={create.isPending}>Create assignment</Button>
        </>
      }
    >
      <form onSubmit={submit} noValidate className="space-y-4">
        <FormError message={error} />
        <FormGrid>
          <FormSelect label="Batch" required placeholder="Select…" options={(batches.data?.items ?? []).filter((b) => b.status === 'ACTIVE' || b.status === 'UPCOMING').map((b) => ({ value: b.id, label: b.name }))} error={e.batchId?.message} {...form.register('batchId')} />
          <FormSelect label="Module" required placeholder={batchId ? 'Select…' : 'Select a batch first'} disabled={!batchId} options={(modules.data ?? []).map((m) => ({ value: m.id, label: `${m.sequence}. ${m.name}` }))} error={e.moduleId?.message} {...form.register('moduleId')} />
          <FormInput label="Title" required wrapperClassName="sm:col-span-2" error={e.title?.message} {...form.register('title')} />
          <FormInput label="Due date" type="date" required min={today()} error={e.dueDate?.message} {...form.register('dueDate')} />
          <FormInput label="Max marks" type="number" required error={e.maxMarks?.message} {...form.register('maxMarks', { valueAsNumber: true })} />
        </FormGrid>
        <FormTextarea label="Description / instructions" error={e.description?.message} {...form.register('description')} />
      </form>
    </Dialog>
  )
}

function GradeDialog({ submission, onClose }: { submission: AssignmentSubmission | null; onClose: () => void }) {
  const grade = useGradeSubmission()
  const [error, setError] = useState('')
  const form = useForm<{ score: string; feedback: string; status: string }>({ defaultValues: { score: '', feedback: '', status: '' } })
  useEffect(() => {
    if (submission) {
      setError('')
      form.reset({ score: submission.score?.toString() ?? '', feedback: submission.feedback, status: '' })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submission?.id])
  const submit = form.handleSubmit(async (v) => {
    setError('')
    const score = v.score === '' ? undefined : Number(v.score)
    if (score !== undefined && (Number.isNaN(score) || score < 0 || score > (submission?.maxMarks ?? 0))) return form.setError('score', { message: `Score must be between 0 and ${submission?.maxMarks}` })
    try {
      await grade.mutateAsync({ id: submission!.id, body: { score, feedback: v.feedback, ...(v.status ? { status: v.status as AssignmentSubmission['status'] } : {}) } })
      onClose()
    } catch (e) {
      setError(applyServerErrors(form, e))
    }
  })
  return (
    <Dialog
      open={!!submission}
      onClose={onClose}
      locked={grade.isPending}
      size="sm"
      title={`Grade — ${submission?.studentName ?? ''}`}
      description={submission?.assignmentTitle}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={grade.isPending}>Cancel</Button>
          <Button onClick={submit} loading={grade.isPending}>Save</Button>
        </>
      }
    >
      <form onSubmit={submit} noValidate className="space-y-4">
        <FormError message={error} />
        {submission?.status === 'NOT_STARTED' && <FormSelect label="Mark as" placeholder="Not started" options={[{ value: 'SUBMITTED', label: 'Submitted' }, { value: 'LATE', label: 'Submitted late' }]} {...form.register('status')} />}
        <FormInput label={`Score (out of ${submission?.maxMarks ?? ''})`} type="number" step="0.5" error={form.formState.errors.score?.message} {...form.register('score')} />
        <FormTextarea label="Trainer feedback" {...form.register('feedback')} />
      </form>
    </Dialog>
  )
}

function SubmissionsDrawer({ assignment, onClose }: { assignment: Assignment | null; onClose: () => void }) {
  const { data, isLoading, error, refetch } = useSubmissions(assignment?.id ?? null)
  const { can } = useAuth()
  const [grading, setGrading] = useState<AssignmentSubmission | null>(null)
  return (
    <>
      <Drawer open={!!assignment} onClose={onClose} width="max-w-3xl" title={assignment?.title ?? ''} description={assignment ? `${assignment.batchName} · ${assignment.moduleName} · due ${formatDate(assignment.dueDate)} · ${assignment.maxMarks} marks` : undefined}>
        {assignment?.description && <p className="mb-4 rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-700">{assignment.description}</p>}
        {isLoading ? (
          <LoadingState />
        ) : error ? (
          <ErrorState error={error} onRetry={refetch} />
        ) : !data?.length ? (
          <EmptyState title="No students assigned" />
        ) : (
          <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
            {data.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900">{s.studentName}</p>
                  <p className="text-xs text-slate-500">{s.submittedAt ? `Submitted ${formatDateTime(s.submittedAt)}` : 'Not submitted'}</p>
                  {s.feedback && <p className="mt-0.5 text-xs italic text-slate-600">“{s.feedback}”</p>}
                </div>
                <div className="flex items-center gap-3">
                  {s.score !== null && s.score !== undefined && <span className="text-sm font-semibold tabular-nums">{s.score}/{s.maxMarks}</span>}
                  <StatusBadge status={s.status} />
                  {can('assignments:update') && (
                    <Button size="sm" variant="outline" onClick={() => setGrading(s)}>{s.reviewedAt ? 'Edit' : 'Grade'}</Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Drawer>
      <GradeDialog submission={grading} onClose={() => setGrading(null)} />
    </>
  )
}

export default function AssignmentsPage() {
  const state = useListState({ sort: 'dueDate', order: 'desc' })
  const { data, isLoading, isFetching, error, refetch } = useAssignments(state.params)
  const { courseOptions } = useLookups()
  const batches = useBatches({ pageSize: 100 })
  const { can } = useAuth()
  const confirm = useConfirm()
  const del = useDeleteAssignment()
  const [creating, setCreating] = useState(false)
  const [view, setView] = useState<Assignment | null>(null)

  const columns: Column<Assignment>[] = [
    { key: 'title', header: 'Assignment', sortKey: 'title', cell: (a) => <div><p className="font-medium text-slate-900">{a.title}</p><p className="text-xs text-slate-500">{a.id} · {a.moduleName}</p></div> },
    { key: 'batch', header: 'Batch', sortKey: 'batch', hideBelow: 'md', cell: (a) => a.batchName },
    { key: 'due', header: 'Due', sortKey: 'dueDate', cell: (a) => <span className={a.dueDate < today() ? 'text-slate-600' : 'font-medium text-slate-900'}>{formatDate(a.dueDate)}</span> },
    { key: 'marks', header: 'Max marks', sortKey: 'marks', align: 'right', hideBelow: 'lg', cell: (a) => a.maxMarks },
    { key: 'sub', header: 'Submitted', hideBelow: 'md', className: 'w-40', cell: (a) => <div><p className="mb-1 text-xs tabular-nums text-slate-600">{a.submittedCount}/{a.totalCount}</p><ProgressBar value={a.totalCount ? ((a.submittedCount ?? 0) / a.totalCount) * 100 : 0} label="Submitted" /></div> },
    { key: 'rev', header: 'To review', align: 'right', cell: (a) => { const n = (a.submittedCount ?? 0) - (a.reviewedCount ?? 0); return n > 0 ? <span className="font-semibold text-amber-700">{n}</span> : <span className="text-slate-400">—</span> } },
  ]

  return (
    <>
      <PageHeader
        title="Assignments"
        description="Create assignments per batch and module, then review and grade submissions."
        actions={<Can permission="assignments:create"><Button onClick={() => setCreating(true)}><Plus className="h-4 w-4" aria-hidden /> New assignment</Button></Can>}
      />
      <ListFilters
        state={state}
        searchPlaceholder="Search assignments…"
        selects={[
          { key: 'status', label: 'Status', options: [{ value: 'open', label: 'Open (due soon)' }, { value: 'closed', label: 'Past due' }, { value: 'needsReview', label: 'Needs review' }], allLabel: 'All assignments' },
          { key: 'batchId', label: 'Batch', options: (batches.data?.items ?? []).map((b) => ({ value: b.id, label: b.name })) },
          { key: 'courseId', label: 'Course', options: courseOptions },
        ]}
        dateRange={{ label: 'Due' }}
      />
      <DataTable
        caption="Assignments"
        columns={columns}
        rows={data?.items}
        rowKey={(a) => a.id}
        isLoading={isLoading}
        isFetching={isFetching}
        error={error}
        onRetry={refetch}
        sort={{ key: state.sort, order: state.order, onSort: state.toggleSort }}
        pagination={{ page: state.page, pageSize: state.pageSize, total: data?.total ?? 0, onPageChange: state.setPage, onPageSizeChange: state.setPageSize }}
        onRowClick={setView}
        rowActions={(a) => [
          { label: 'Review submissions', icon: <ClipboardCheck />, onSelect: () => setView(a) },
          { label: 'Delete assignment', icon: <Trash2 />, danger: true, separatorBefore: true, hidden: !can('assignments:delete'), onSelect: () => confirm({ title: `Delete “${a.title}”?`, description: 'Assignments with reviewed marks cannot be deleted.', tone: 'danger', confirmLabel: 'Delete', run: () => del.mutateAsync(a.id) }) },
        ]}
      />
      <AssignmentFormDialog open={creating} onClose={() => setCreating(false)} />
      <SubmissionsDrawer assignment={view} onClose={() => setView(null)} />
    </>
  )
}
