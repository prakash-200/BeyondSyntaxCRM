import { zodResolver } from '@hookform/resolvers/zod'
import { Eye, Plus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { Can } from '@/components/common/Can'
import { PageHeader } from '@/components/common/PageHeader'
import { StatusBadge } from '@/components/common/StatusBadge'
import { FormError, FormGrid, FormInput, FormSelect, FormTextarea } from '@/components/forms/fields'
import { applyServerErrors, PHONE_MESSAGE, PHONE_REGEX } from '@/components/forms/utils'
import { DataTable, type Column } from '@/components/tables/DataTable'
import { ListFilters } from '@/components/tables/FilterBar'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { APPLICATION_STATUSES } from '@/constants/enums'
import { optionsFrom } from '@/constants/labels'
import { useListState } from '@/hooks/useListState'
import { useLookups } from '@/hooks/useLookups'
import type { Application } from '@/types'
import { formatDate, formatPhone } from '@/utils/format'
import { useApplications, useCreateApplication } from './hooks'

const schema = z.object({
  applicantName: z.string().trim().min(2, 'Enter the applicant’s name'),
  phone: z.string().trim().regex(PHONE_REGEX, PHONE_MESSAGE),
  email: z.string().trim().refine((v) => v === '' || /^\S+@\S+\.\S+$/.test(v), 'Enter a valid email address'),
  courseId: z.string().min(1, 'Select a course'),
  preferredBatchId: z.string(),
  counselorId: z.string().min(1, 'Select a counselor'),
  notes: z.string().max(500),
})
type Values = z.infer<typeof schema>

function ApplicationFormDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { courseOptions, lookups, employeeOptions } = useLookups()
  const create = useCreateApplication()
  const navigate = useNavigate()
  const [formError, setFormError] = useState('')
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { applicantName: '', phone: '', email: '', courseId: '', preferredBatchId: '', counselorId: '', notes: '' } })
  const courseId = form.watch('courseId')
  useEffect(() => {
    if (open) {
      form.reset()
      setFormError('')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])
  const batches = (lookups?.batches ?? []).filter((b) => b.courseId === courseId && (b.status === 'UPCOMING' || b.status === 'ACTIVE')).map((b) => ({ value: b.id, label: b.name }))
  const e = form.formState.errors
  const submit = form.handleSubmit(async (v) => {
    setFormError('')
    try {
      const app = await create.mutateAsync({ ...v, preferredBatchId: v.preferredBatchId || null })
      onClose()
      navigate(`/applications/${app.id}`)
    } catch (err) {
      setFormError(applyServerErrors(form, err))
    }
  })
  return (
    <Dialog
      open={open}
      onClose={onClose}
      locked={create.isPending}
      size="lg"
      title="New application"
      description="For walk-in applicants without a lead record. Leads can be converted from the Leads page."
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={create.isPending}>
            Cancel
          </Button>
          <Button onClick={submit} loading={create.isPending}>
            Create application
          </Button>
        </>
      }
    >
      <form onSubmit={submit} noValidate className="space-y-4">
        <FormError message={formError} />
        <FormGrid>
          <FormInput label="Applicant name" required error={e.applicantName?.message} {...form.register('applicantName')} />
          <FormInput label="Phone" required inputMode="tel" error={e.phone?.message} {...form.register('phone')} />
          <FormInput label="Email" type="email" error={e.email?.message} {...form.register('email')} />
          <FormSelect label="Course" required placeholder="Select…" options={courseOptions} error={e.courseId?.message} {...form.register('courseId')} />
          <FormSelect label="Preferred batch" placeholder={courseId ? 'No preference' : 'Select a course first'} disabled={!courseId} options={batches} {...form.register('preferredBatchId')} />
          <FormSelect label="Counselor" required placeholder="Select…" options={employeeOptions('COUNSELOR')} error={e.counselorId?.message} {...form.register('counselorId')} />
        </FormGrid>
        <FormTextarea label="Notes" error={e.notes?.message} {...form.register('notes')} />
      </form>
    </Dialog>
  )
}

export default function ApplicationsPage() {
  const state = useListState({ sort: 'applicationDate', order: 'desc' })
  const { data, isLoading, isFetching, error, refetch } = useApplications(state.params)
  const { courseOptions, employeeOptions } = useLookups()
  const navigate = useNavigate()
  const [creating, setCreating] = useState(false)

  const columns: Column<Application>[] = [
    {
      key: 'applicant',
      header: 'Applicant',
      sortKey: 'name',
      cell: (a) => (
        <div>
          <Link to={`/applications/${a.id}`} className="font-medium text-slate-900 hover:text-brand-700" onClick={(e) => e.stopPropagation()}>
            {a.applicantName}
          </Link>
          <p className="text-xs text-slate-500">
            {a.id} · {formatPhone(a.phone)}
          </p>
        </div>
      ),
    },
    { key: 'course', header: 'Course', sortKey: 'course', hideBelow: 'md', cell: (a) => a.courseName },
    { key: 'batch', header: 'Preferred batch', hideBelow: 'xl', cell: (a) => a.preferredBatchName ?? <span className="text-slate-400">—</span> },
    { key: 'counselor', header: 'Counselor', hideBelow: 'lg', cell: (a) => a.counselorName },
    { key: 'date', header: 'Applied', sortKey: 'applicationDate', hideBelow: 'md', cell: (a) => formatDate(a.applicationDate) },
    { key: 'status', header: 'Status', sortKey: 'status', cell: (a) => <StatusBadge status={a.status} /> },
  ]

  return (
    <>
      <PageHeader
        title="Applications"
        description="Admission applications moving through counselling, approval, payment and batch assignment."
        actions={
          <Can permission="applications:create">
            <Button onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4" aria-hidden /> New application
            </Button>
          </Can>
        }
      />
      <ListFilters
        state={state}
        searchPlaceholder="Search applicant, ID, phone…"
        selects={[
          { key: 'status', label: 'Status', options: optionsFrom(APPLICATION_STATUSES) },
          { key: 'courseId', label: 'Course', options: courseOptions },
          { key: 'counselorId', label: 'Counselor', options: employeeOptions('COUNSELOR') },
        ]}
        dateRange={{ label: 'Applied' }}
      />
      <DataTable
        caption="Applications"
        columns={columns}
        rows={data?.items}
        rowKey={(a) => a.id}
        isLoading={isLoading}
        isFetching={isFetching}
        error={error}
        onRetry={refetch}
        sort={{ key: state.sort, order: state.order, onSort: state.toggleSort }}
        pagination={{ page: state.page, pageSize: state.pageSize, total: data?.total ?? 0, onPageChange: state.setPage, onPageSizeChange: state.setPageSize }}
        onRowClick={(a) => navigate(`/applications/${a.id}`)}
        rowActions={(a) => [{ label: 'View application', icon: <Eye />, onSelect: () => navigate(`/applications/${a.id}`) }]}
      />
      <ApplicationFormDialog open={creating} onClose={() => setCreating(false)} />
    </>
  )
}
