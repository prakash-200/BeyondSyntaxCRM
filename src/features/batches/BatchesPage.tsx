import { Eye, Pencil, Plus } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Can } from '@/components/common/Can'
import { PageHeader } from '@/components/common/PageHeader'
import { StatusBadge } from '@/components/common/StatusBadge'
import { DataTable, type Column } from '@/components/tables/DataTable'
import { ListFilters } from '@/components/tables/FilterBar'
import { Button } from '@/components/ui/button'
import { ProgressBar } from '@/components/ui/misc'
import { BATCH_STATUSES, COURSE_MODES } from '@/constants/enums'
import { humanize, optionsFrom } from '@/constants/labels'
import { useAuth } from '@/features/auth/AuthContext'
import { useListState } from '@/hooks/useListState'
import { useLookups } from '@/hooks/useLookups'
import type { Batch } from '@/types'
import { formatDate, formatTime } from '@/utils/format'
import { BatchFormDialog } from './BatchDialogs'
import { useBatches } from './hooks'

export const scheduleText = (b: Batch) => `${b.days.map(humanize).join(', ')} · ${formatTime(b.startTime)} – ${formatTime(b.endTime)}`

export default function BatchesPage() {
  const [params] = useSearchParams()
  const state = useListState({ sort: 'startDate', order: 'desc', filters: { trainerId: params.get('trainerId') ?? '' } })
  const { data, isLoading, isFetching, error, refetch } = useBatches(state.params)
  const { courseOptions, employeeOptions } = useLookups()
  const { can } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState<{ open: boolean; batch: Batch | null }>({ open: false, batch: null })

  const columns: Column<Batch>[] = [
    {
      key: 'name',
      header: 'Batch',
      sortKey: 'name',
      cell: (b) => (
        <div>
          <Link to={`/batches/${b.id}`} className="font-medium text-slate-900 hover:text-brand-700" onClick={(e) => e.stopPropagation()}>
            {b.name}
          </Link>
          <p className="text-xs text-slate-500">{b.courseName}</p>
        </div>
      ),
    },
    { key: 'trainer', header: 'Trainer', sortKey: 'trainer', hideBelow: 'md', cell: (b) => b.trainerName },
    { key: 'dates', header: 'Dates', sortKey: 'startDate', hideBelow: 'lg', cell: (b) => <span className="whitespace-nowrap">{formatDate(b.startDate)} → {formatDate(b.endDate)}</span> },
    { key: 'schedule', header: 'Schedule', hideBelow: 'xl', cell: (b) => <span className="text-xs text-slate-600">{scheduleText(b)}</span> },
    { key: 'students', header: 'Students', sortKey: 'students', className: 'w-40', cell: (b) => <div><p className="mb-1 text-xs tabular-nums text-slate-600">{b.currentStudentCount} / {b.capacity}</p><ProgressBar value={(b.currentStudentCount / b.capacity) * 100} tone={b.currentStudentCount >= b.capacity ? 'danger' : 'brand'} label="Seats filled" /></div> },
    { key: 'status', header: 'Status', sortKey: 'status', cell: (b) => <StatusBadge status={b.status} /> },
  ]

  return (
    <>
      <PageHeader
        title="Batches"
        description="Scheduled training batches, trainers and enrolment."
        actions={
          <Can permission="batches:create">
            <Button onClick={() => setForm({ open: true, batch: null })}>
              <Plus className="h-4 w-4" aria-hidden /> Create batch
            </Button>
          </Can>
        }
      />
      <ListFilters
        state={state}
        searchPlaceholder="Search batch, trainer…"
        selects={[
          { key: 'status', label: 'Status', options: optionsFrom(BATCH_STATUSES) },
          { key: 'courseId', label: 'Course', options: courseOptions },
          { key: 'trainerId', label: 'Trainer', options: employeeOptions('TRAINER') },
          { key: 'mode', label: 'Mode', options: optionsFrom(COURSE_MODES) },
        ]}
        dateRange={{ label: 'Start date' }}
      />
      <DataTable
        caption="Batches"
        columns={columns}
        rows={data?.items}
        rowKey={(b) => b.id}
        isLoading={isLoading}
        isFetching={isFetching}
        error={error}
        onRetry={refetch}
        sort={{ key: state.sort, order: state.order, onSort: state.toggleSort }}
        pagination={{ page: state.page, pageSize: state.pageSize, total: data?.total ?? 0, onPageChange: state.setPage, onPageSizeChange: state.setPageSize }}
        onRowClick={(b) => navigate(`/batches/${b.id}`)}
        rowActions={(b) => [
          { label: 'View batch', icon: <Eye />, onSelect: () => navigate(`/batches/${b.id}`) },
          { label: 'Edit batch', icon: <Pencil />, hidden: !can('batches:update'), onSelect: () => setForm({ open: true, batch: b }) },
        ]}
      />
      <BatchFormDialog open={form.open} batch={form.batch} onClose={() => setForm({ open: false, batch: null })} />
    </>
  )
}
