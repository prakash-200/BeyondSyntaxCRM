import { Link } from 'react-router-dom'
import { PageHeader } from '@/components/common/PageHeader'
import { StatusBadge } from '@/components/common/StatusBadge'
import { DataTable, type Column } from '@/components/tables/DataTable'
import { ListFilters } from '@/components/tables/FilterBar'
import { Avatar } from '@/components/ui/misc'
import { useListState } from '@/hooks/useListState'
import type { Trainer } from '@/types'
import { formatDate, formatPhone } from '@/utils/format'
import { useTrainers } from './hooks'

export default function TrainersPage() {
  const state = useListState({ sort: 'name' })
  const { data, isLoading, isFetching, error, refetch } = useTrainers(state.params)
  const columns: Column<Trainer>[] = [
    { key: 'name', header: 'Trainer', sortKey: 'name', cell: (t) => <div className="flex items-center gap-3"><Avatar name={t.name} size="sm" /><div><p className="font-medium text-slate-900">{t.name}</p><p className="text-xs text-slate-500">{t.id} · {t.email}</p></div></div> },
    { key: 'phone', header: 'Phone', hideBelow: 'lg', cell: (t) => formatPhone(t.phone) },
    { key: 'spec', header: 'Specialization', hideBelow: 'md', className: 'max-w-xs', cell: (t) => <span className="text-slate-600">{t.specialization}</span> },
    { key: 'courses', header: 'Assigned courses', hideBelow: 'xl', cell: (t) => <span className="text-xs text-slate-600">{t.courseNames.join(', ') || '—'}</span> },
    { key: 'batches', header: 'Batches', sortKey: 'batches', align: 'right', cell: (t) => <Link to={`/batches?trainerId=${t.id}`} className="text-brand-700 hover:underline">{t.activeBatches} live / {t.totalBatches}</Link> },
    { key: 'students', header: 'Students', sortKey: 'students', align: 'right', cell: (t) => t.studentCount },
    { key: 'joined', header: 'Joined', hideBelow: 'xl', cell: (t) => formatDate(t.joiningDate) },
    { key: 'status', header: 'Status', cell: (t) => <StatusBadge status={t.status} /> },
  ]
  return (
    <>
      <PageHeader title="Trainers" description="Instructors, their specialisations and current workload. Manage trainer accounts under Employees." />
      <ListFilters state={state} searchPlaceholder="Search trainers…" />
      <DataTable
        caption="Trainers"
        columns={columns}
        rows={data?.items}
        rowKey={(t) => t.id}
        isLoading={isLoading}
        isFetching={isFetching}
        error={error}
        onRetry={refetch}
        sort={{ key: state.sort, order: state.order, onSort: state.toggleSort }}
        pagination={{ page: state.page, pageSize: state.pageSize, total: data?.total ?? 0, onPageChange: state.setPage, onPageSizeChange: state.setPageSize }}
      />
    </>
  )
}
