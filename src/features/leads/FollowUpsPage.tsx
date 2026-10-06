import { Ban, CalendarClock, Check } from 'lucide-react'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useConfirm } from '@/components/common/ConfirmDialog'
import { PageHeader } from '@/components/common/PageHeader'
import { StatusBadge } from '@/components/common/StatusBadge'
import { DataTable, type Column } from '@/components/tables/DataTable'
import { ListFilters } from '@/components/tables/FilterBar'
import type { MenuItem } from '@/components/ui/dropdown-menu'
import { Tabs } from '@/components/ui/tabs'
import { FOLLOW_UP_TYPES } from '@/constants/enums'
import { humanize, optionsFrom } from '@/constants/labels'
import { useAuth } from '@/features/auth/AuthContext'
import { useListState } from '@/hooks/useListState'
import { useLookups } from '@/hooks/useLookups'
import type { FollowUp, FollowUpBucket } from '@/types'
import { today } from '@/utils/clock'
import { formatDate, formatTime } from '@/utils/format'
import { CompleteFollowUpDialog, RescheduleDialog } from './LeadDialogs'
import { useCancelFollowUp, useFollowUpCounts, useFollowUps } from './hooks'

const TABS: { value: FollowUpBucket; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'completed', label: 'Completed' },
  { value: 'all', label: 'All' },
]

export default function FollowUpsPage() {
  const [search, setSearch] = useSearchParams()
  const bucket = (TABS.find((t) => t.value === search.get('tab'))?.value ?? 'today') as FollowUpBucket
  const state = useListState({ sort: 'date', order: bucket === 'completed' ? 'desc' : 'asc' })
  const { data, isLoading, isFetching, error, refetch } = useFollowUps({ ...state.params, bucket })
  const counts = useFollowUpCounts()
  const { employeeOptions } = useLookups()
  const { can } = useAuth()
  const confirm = useConfirm()
  const cancel = useCancelFollowUp()
  const [complete, setComplete] = useState<FollowUp | null>(null)
  const [resched, setResched] = useState<FollowUp | null>(null)

  const columns: Column<FollowUp>[] = [
    {
      key: 'who',
      header: 'Lead / Student',
      sortKey: 'name',
      cell: (f) => (
        <div>
          <Link to={f.entityType === 'LEAD' ? `/leads/${f.entityId}` : `/students/${f.entityId}`} className="font-medium text-slate-900 hover:text-brand-700">
            {f.entityName}
          </Link>
          <p className="text-xs text-slate-500">
            {f.id} · {f.courseName ?? '—'}
          </p>
        </div>
      ),
    },
    {
      key: 'date',
      header: 'When',
      sortKey: 'date',
      cell: (f) => {
        const overdue = f.status === 'PENDING' && f.date < today()
        return (
          <span className={overdue ? 'font-medium text-red-600' : ''}>
            {f.date === today() ? 'Today' : formatDate(f.date)} · {formatTime(f.time)}
          </span>
        )
      },
    },
    { key: 'type', header: 'Type', sortKey: 'type', hideBelow: 'md', cell: (f) => humanize(f.type) },
    { key: 'employee', header: 'Employee', sortKey: 'employee', hideBelow: 'lg', cell: (f) => f.employeeName },
    { key: 'notes', header: 'Notes / outcome', hideBelow: 'xl', className: 'max-w-xs', cell: (f) => <span className="line-clamp-2 text-slate-600">{f.outcome ?? f.notes}</span> },
    { key: 'status', header: 'Status', sortKey: 'status', cell: (f) => <StatusBadge status={f.status === 'PENDING' && f.date < today() ? 'OVERDUE' : f.status} /> },
  ]

  const actions = (f: FollowUp): MenuItem[] =>
    f.status !== 'PENDING' || !can('followups:update')
      ? []
      : [
          { label: 'Mark completed', icon: <Check />, onSelect: () => setComplete(f) },
          { label: 'Reschedule', icon: <CalendarClock />, onSelect: () => setResched(f) },
          { label: 'Cancel follow-up', icon: <Ban />, danger: true, separatorBefore: true, onSelect: () => confirm({ title: 'Cancel this follow-up?', description: `${humanize(f.type)} with ${f.entityName} on ${formatDate(f.date)}.`, confirmLabel: 'Cancel follow-up', cancelLabel: 'Keep', tone: 'danger', run: () => cancel.mutateAsync(f.id) }) },
        ]

  return (
    <>
      <PageHeader title="Follow-ups" description="Calls, messages and meetings scheduled with leads and students." />
      <Tabs
        className="mb-4"
        label="Follow-up views"
        value={bucket}
        onChange={(v) => {
          setSearch(v === 'today' ? {} : { tab: v })
          state.setPage(1)
        }}
        items={TABS.map((t) => ({ ...t, count: counts.data?.[t.value] }))}
      />
      <ListFilters
        state={state}
        searchPlaceholder="Search lead, notes…"
        selects={[
          { key: 'type', label: 'Type', options: optionsFrom(FOLLOW_UP_TYPES) },
          { key: 'employeeId', label: 'Employee', options: employeeOptions() },
        ]}
        dateRange={{ label: 'Date' }}
      />
      <DataTable
        caption={`${bucket} follow-ups`}
        columns={columns}
        rows={data?.items}
        rowKey={(f) => f.id}
        isLoading={isLoading}
        isFetching={isFetching}
        error={error}
        onRetry={refetch}
        sort={{ key: state.sort, order: state.order, onSort: state.toggleSort }}
        pagination={{ page: state.page, pageSize: state.pageSize, total: data?.total ?? 0, onPageChange: state.setPage, onPageSizeChange: state.setPageSize }}
        rowActions={actions}
        rowClassName={(f) => (f.status === 'PENDING' && f.date < today() ? 'bg-red-50/40' : undefined)}
        empty={{ title: bucket === 'overdue' ? 'No overdue follow-ups 🎉' : 'No follow-ups here', description: bucket === 'today' ? 'Nothing is scheduled for today.' : undefined }}
      />
      <CompleteFollowUpDialog followUp={complete} onClose={() => setComplete(null)} />
      <RescheduleDialog followUp={resched} onClose={() => setResched(null)} />
    </>
  )
}
