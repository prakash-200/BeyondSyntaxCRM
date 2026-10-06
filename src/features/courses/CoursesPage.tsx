import { zodResolver } from '@hookform/resolvers/zod'
import { Archive, Eye, Pencil, Plus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { Can } from '@/components/common/Can'
import { useConfirm } from '@/components/common/ConfirmDialog'
import { PageHeader } from '@/components/common/PageHeader'
import { StatusBadge } from '@/components/common/StatusBadge'
import { FormError, FormGrid, FormInput, FormSelect, FormTextarea } from '@/components/forms/fields'
import { applyServerErrors } from '@/components/forms/utils'
import { DataTable, type Column } from '@/components/tables/DataTable'
import { ListFilters } from '@/components/tables/FilterBar'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { ACTIVE_STATES, COURSE_CATEGORIES, COURSE_MODES } from '@/constants/enums'
import { humanize, optionsFrom } from '@/constants/labels'
import { useAuth } from '@/features/auth/AuthContext'
import { useListState } from '@/hooks/useListState'
import type { Course } from '@/types'
import { formatCurrency } from '@/utils/format'
import { useCreateCourse, useCourses, useDeleteCourse, useUpdateCourse } from './hooks'

const schema = z.object({
  name: z.string().trim().min(3, 'Course name must be at least 3 characters').max(80),
  code: z.string().trim().max(8),
  category: z.enum(COURSE_CATEGORIES),
  mode: z.enum(COURSE_MODES),
  durationMonths: z.number({ message: 'Enter the duration' }).int('Whole months only').min(1, 'At least 1 month').max(36),
  totalFee: z.number({ message: 'Enter the course fee' }).positive('Fee must be greater than 0'),
  status: z.enum(ACTIVE_STATES),
  description: z.string().trim().max(500),
  reason: z.string().trim(),
})
type Values = z.infer<typeof schema>

export function CourseFormDialog({ open, onClose, course }: { open: boolean; onClose: () => void; course?: Course | null }) {
  const create = useCreateCourse()
  const update = useUpdateCourse()
  const [formError, setFormError] = useState('')
  const editing = !!course
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { name: '', code: '', category: 'PROGRAMMING', mode: 'ONLINE', durationMonths: 3, totalFee: 0, status: 'ACTIVE', description: '', reason: '' } })
  const fee = form.watch('totalFee')
  const feeChanged = editing && Number(fee) !== course!.totalFee

  useEffect(() => {
    if (!open) return
    setFormError('')
    form.reset(course ? { name: course.name, code: course.code, category: course.category, mode: course.mode, durationMonths: course.durationMonths, totalFee: course.totalFee, status: course.status, description: course.description, reason: '' } : { name: '', code: '', category: 'PROGRAMMING', mode: 'ONLINE', durationMonths: 3, totalFee: 0, status: 'ACTIVE', description: '', reason: '' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, course])

  const busy = create.isPending || update.isPending
  const submit = form.handleSubmit(async (v) => {
    setFormError('')
    if (feeChanged && v.reason.length < 5) return form.setError('reason', { message: 'A reason is required when changing the fee' })
    try {
      if (editing) await update.mutateAsync({ id: course!.id, body: v })
      else await create.mutateAsync(v)
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
      title={editing ? `Edit course — ${course!.name}` : 'Add course'}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={submit} loading={busy}>
            {editing ? 'Save changes' : 'Create course'}
          </Button>
        </>
      }
    >
      <form onSubmit={submit} noValidate className="space-y-4">
        <FormError message={formError} />
        <FormGrid>
          <FormInput label="Course name" required wrapperClassName="sm:col-span-2" error={e.name?.message} {...form.register('name')} />
          <FormSelect label="Category" options={optionsFrom(COURSE_CATEGORIES)} {...form.register('category')} />
          <FormSelect label="Mode" options={optionsFrom(COURSE_MODES)} {...form.register('mode')} />
          <FormInput label="Duration (months)" type="number" required error={e.durationMonths?.message} {...form.register('durationMonths', { valueAsNumber: true })} />
          <FormInput label="Total fee (₹)" type="number" required error={e.totalFee?.message} {...form.register('totalFee', { valueAsNumber: true })} />
          <FormInput label="Short code" hint="Used in certificate IDs, e.g. DOTNET" disabled={editing} error={e.code?.message} {...form.register('code')} />
          {editing && <FormSelect label="Status" options={optionsFrom(ACTIVE_STATES)} {...form.register('status')} />}
        </FormGrid>
        <FormTextarea label="Description" error={e.description?.message} {...form.register('description')} />
        {feeChanged && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
            <p className="mb-2 text-sm text-amber-900">
              Changing the fee from <strong>{formatCurrency(course!.totalFee)}</strong> to <strong>{formatCurrency(Number(fee) || 0)}</strong>. Existing students’ fee plans are not changed.
            </p>
            <FormTextarea label="Reason for fee change" required error={e.reason?.message} {...form.register('reason')} />
          </div>
        )}
      </form>
    </Dialog>
  )
}

export default function CoursesPage() {
  const state = useListState({ sort: 'name' })
  const { data, isLoading, isFetching, error, refetch } = useCourses(state.params)
  const { can } = useAuth()
  const navigate = useNavigate()
  const confirm = useConfirm()
  const del = useDeleteCourse()
  const [form, setForm] = useState<{ open: boolean; course: Course | null }>({ open: false, course: null })

  const columns: Column<Course>[] = [
    {
      key: 'name',
      header: 'Course',
      sortKey: 'name',
      cell: (c) => (
        <div>
          <Link to={`/courses/${c.id}`} className="font-medium text-slate-900 hover:text-brand-700" onClick={(e) => e.stopPropagation()}>
            {c.name}
          </Link>
          <p className="text-xs text-slate-500">{c.id} · {c.code}</p>
        </div>
      ),
    },
    { key: 'cat', header: 'Category', sortKey: 'category', hideBelow: 'lg', cell: (c) => humanize(c.category) },
    { key: 'dur', header: 'Duration', sortKey: 'duration', hideBelow: 'md', cell: (c) => `${c.durationMonths} months` },
    { key: 'mode', header: 'Mode', hideBelow: 'lg', cell: (c) => humanize(c.mode) },
    { key: 'mods', header: 'Modules', align: 'right', hideBelow: 'md', cell: (c) => c.moduleCount },
    { key: 'fee', header: 'Fee', sortKey: 'fee', align: 'right', cell: (c) => <span className="font-medium">{formatCurrency(c.totalFee)}</span> },
    { key: 'stu', header: 'Students', sortKey: 'students', align: 'right', hideBelow: 'xl', cell: (c) => c.studentCount },
    { key: 'status', header: 'Status', cell: (c) => <StatusBadge status={c.status} /> },
  ]

  return (
    <>
      <PageHeader
        title="Courses"
        description="Programmes offered by the institute, their fees and curriculum."
        actions={
          <Can permission="courses:create">
            <Button onClick={() => setForm({ open: true, course: null })}>
              <Plus className="h-4 w-4" aria-hidden /> Add course
            </Button>
          </Can>
        }
      />
      <ListFilters
        state={state}
        searchPlaceholder="Search courses…"
        selects={[
          { key: 'category', label: 'Category', options: optionsFrom(COURSE_CATEGORIES) },
          { key: 'mode', label: 'Mode', options: optionsFrom(COURSE_MODES) },
          { key: 'status', label: 'Status', options: optionsFrom(ACTIVE_STATES) },
        ]}
      />
      <DataTable
        caption="Courses"
        columns={columns}
        rows={data?.items}
        rowKey={(c) => c.id}
        isLoading={isLoading}
        isFetching={isFetching}
        error={error}
        onRetry={refetch}
        sort={{ key: state.sort, order: state.order, onSort: state.toggleSort }}
        pagination={{ page: state.page, pageSize: state.pageSize, total: data?.total ?? 0, onPageChange: state.setPage, onPageSizeChange: state.setPageSize }}
        onRowClick={(c) => navigate(`/courses/${c.id}`)}
        rowActions={(c) => [
          { label: 'View course', icon: <Eye />, onSelect: () => navigate(`/courses/${c.id}`) },
          { label: 'Edit course', icon: <Pencil />, hidden: !can('courses:update'), onSelect: () => setForm({ open: true, course: c }) },
          { label: 'Archive course', icon: <Archive />, danger: true, separatorBefore: true, hidden: !can('courses:delete'), onSelect: () => confirm({ title: `Archive ${c.name}?`, description: 'Courses with active students or batches cannot be archived. Existing records are kept.', confirmLabel: 'Archive', tone: 'danger', run: () => del.mutateAsync(c.id) }) },
        ]}
      />
      <CourseFormDialog open={form.open} course={form.course} onClose={() => setForm({ open: false, course: null })} />
    </>
  )
}
