import { ArrowRight } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader } from '@/components/common/PageHeader'
import { DataTable, type Column } from '@/components/tables/DataTable'
import { ListFilters } from '@/components/tables/FilterBar'
import { Drawer } from '@/components/ui/dialog'
import { DescriptionList } from '@/components/ui/misc'
import { AUDIT_ACTIONS, ENTITY_TYPES } from '@/constants/enums'
import { humanize, optionsFrom } from '@/constants/labels'
import { useListState } from '@/hooks/useListState'
import { useLookups } from '@/hooks/useLookups'
import type { AuditLog } from '@/types'
import { formatDateTime } from '@/utils/format'
import { Badge } from '@/components/common/StatusBadge'
import { useAuditLogs } from './hooks'

const entityPath = (l: AuditLog): string | null => {
  const id = l.entityId
  switch (l.entityType) {
    case 'LEAD': return `/leads/${id}`
    case 'STUDENT': return `/students/${id}`
    case 'APPLICATION': return `/applications/${id}`
    case 'PAYMENT': return `/payments/${id}`
    case 'BATCH': return `/batches/${id}`
    case 'COURSE': return `/courses/${id}`
    case 'CERTIFICATE': return `/certificates/${id}`
    default: return null
  }
}

export default function AuditLogsPage() {
  const state = useListState({ sort: 'timestamp', order: 'desc', pageSize: 20 })
  const { data, isLoading, isFetching, error, refetch } = useAuditLogs(state.params)
  const { employeeOptions } = useLookups()
  const [selected, setSelected] = useState<AuditLog | null>(null)

  const columns: Column<AuditLog>[] = [
    { key: 'time', header: 'Time', sortKey: 'timestamp', cell: (l) => <span className="whitespace-nowrap tabular-nums text-slate-700">{formatDateTime(l.timestamp)}</span> },
    { key: 'user', header: 'User', sortKey: 'user', cell: (l) => l.userName },
    { key: 'action', header: 'Action', sortKey: 'action', cell: (l) => <Badge tone="neutral" icon={false}>{humanize(l.action)}</Badge> },
    { key: 'entity', header: 'Entity', hideBelow: 'md', cell: (l) => <div><p className="text-slate-900">{l.entityLabel ?? l.entityId}</p><p className="font-mono text-[11px] text-slate-500">{humanize(l.entityType)} · {l.entityId}</p></div> },
    {
      key: 'change',
      header: 'Previous → New',
      hideBelow: 'lg',
      className: 'max-w-xs',
      cell: (l) =>
        l.previousValue || l.newValue ? (
          <span className="flex flex-wrap items-center gap-1 text-xs">
            {l.previousValue && <span className="max-w-[140px] truncate rounded bg-slate-100 px-1.5 py-0.5" title={l.previousValue}>{l.previousValue}</span>}
            {l.previousValue && l.newValue && <ArrowRight className="h-3 w-3 text-slate-400" aria-label="changed to" />}
            {l.newValue && <span className="max-w-[140px] truncate rounded bg-brand-50 px-1.5 py-0.5 text-brand-700" title={l.newValue}>{l.newValue}</span>}
          </span>
        ) : (
          <span className="text-slate-400">—</span>
        ),
    },
    { key: 'ip', header: 'IP', hideBelow: 'xl', cell: (l) => <span className="font-mono text-xs text-slate-500">{l.ipAddress}</span> },
  ]

  return (
    <>
      <PageHeader title="Audit logs" description="A tamper-evident trail of every important change: who did what, to which record, and when." />
      <ListFilters
        state={state}
        searchPlaceholder="Search user, record, description…"
        selects={[
          { key: 'userId', label: 'User', options: employeeOptions() },
          { key: 'action', label: 'Action', options: optionsFrom(AUDIT_ACTIONS) },
          { key: 'entityType', label: 'Entity', options: optionsFrom(ENTITY_TYPES) },
        ]}
        dateRange={{ label: 'Logged' }}
      />
      <DataTable
        caption="Audit log"
        columns={columns}
        rows={data?.items}
        rowKey={(l) => l.id}
        isLoading={isLoading}
        isFetching={isFetching}
        error={error}
        onRetry={refetch}
        stickyHeader
        sort={{ key: state.sort, order: state.order, onSort: state.toggleSort }}
        pagination={{ page: state.page, pageSize: state.pageSize, total: data?.total ?? 0, onPageChange: state.setPage, onPageSizeChange: state.setPageSize }}
        onRowClick={setSelected}
      />
      <Drawer open={!!selected} onClose={() => setSelected(null)} title={selected ? humanize(selected.action) : ''} description={selected?.id} width="max-w-lg">
        {selected && (
          <div className="space-y-6">
            <p className="text-sm text-slate-800">{selected.description}</p>
            <DescriptionList
              columns={1}
              items={[
                { label: 'Timestamp', value: formatDateTime(selected.timestamp) },
                { label: 'User', value: `${selected.userName} (${selected.userId}${selected.userRole ? ` · ${humanize(selected.userRole)}` : ''})` },
                { label: 'Entity', value: <span>{humanize(selected.entityType)} · {entityPath(selected) ? <Link className="text-brand-700 hover:underline" to={entityPath(selected)!}>{selected.entityId}</Link> : selected.entityId}</span> },
                { label: 'Previous value', value: selected.previousValue ?? '—' },
                { label: 'New value', value: selected.newValue ?? '—' },
                { label: 'Reason', value: selected.reason ?? '—' },
                { label: 'IP address', value: <span className="font-mono text-xs">{selected.ipAddress}</span> },
                { label: 'Client', value: selected.userAgent },
                { label: 'Related records', value: <span className="font-mono text-xs">{selected.relatedIds.join(', ')}</span> },
              ]}
            />
          </div>
        )}
      </Drawer>
    </>
  )
}
