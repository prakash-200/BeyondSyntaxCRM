import { Eye } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '@/components/common/PageHeader'
import { StatusBadge } from '@/components/common/StatusBadge'
import { DataTable, type Column } from '@/components/tables/DataTable'
import { ListFilters } from '@/components/tables/FilterBar'
import { FEE_STATUSES } from '@/constants/enums'
import { optionsFrom } from '@/constants/labels'
import { useListState } from '@/hooks/useListState'
import { useLookups } from '@/hooks/useLookups'
import type { Invoice } from '@/types'
import { formatCurrency, formatDate } from '@/utils/format'
import { useInvoices } from './hooks'

export default function InvoicesPage() {
  const state = useListState({ sort: 'date', order: 'desc' })
  const { data, isLoading, isFetching, error, refetch } = useInvoices(state.params)
  const { courseOptions } = useLookups()
  const navigate = useNavigate()
  const columns: Column<Invoice>[] = [
    { key: 'no', header: 'Invoice', sortKey: 'number', cell: (i) => <span className="font-medium text-brand-700">{i.number}</span> },
    { key: 'student', header: 'Student', sortKey: 'student', cell: (i) => <div><p className="text-slate-900">{i.studentName}</p><p className="text-xs text-slate-500">{i.courseName}</p></div> },
    { key: 'date', header: 'Date', sortKey: 'date', hideBelow: 'md', cell: (i) => formatDate(i.date) },
    { key: 'total', header: 'Total', sortKey: 'total', align: 'right', cell: (i) => formatCurrency(i.total) },
    { key: 'paid', header: 'Paid', align: 'right', hideBelow: 'lg', cell: (i) => <span className="text-emerald-700">{formatCurrency(i.paid)}</span> },
    { key: 'balance', header: 'Balance', sortKey: 'balance', align: 'right', cell: (i) => <span className={i.balance ? 'font-medium text-amber-700' : 'text-slate-400'}>{formatCurrency(i.balance)}</span> },
    { key: 'status', header: 'Status', sortKey: 'status', cell: (i) => <StatusBadge status={i.status} /> },
  ]
  return (
    <>
      <PageHeader title="Invoices" description="One invoice per fee plan, with payment history. Printable for the student." />
      <ListFilters state={state} searchPlaceholder="Search invoice no., student…" selects={[{ key: 'status', label: 'Status', options: optionsFrom(FEE_STATUSES) }, { key: 'courseId', label: 'Course', options: courseOptions }]} dateRange={{ label: 'Invoice date' }} />
      <DataTable
        caption="Invoices"
        columns={columns}
        rows={data?.items}
        rowKey={(i) => i.id}
        isLoading={isLoading}
        isFetching={isFetching}
        error={error}
        onRetry={refetch}
        sort={{ key: state.sort, order: state.order, onSort: state.toggleSort }}
        pagination={{ page: state.page, pageSize: state.pageSize, total: data?.total ?? 0, onPageChange: state.setPage, onPageSizeChange: state.setPageSize }}
        onRowClick={(i) => navigate(`/invoices/${i.id}`)}
        rowActions={(i) => [{ label: 'View / print', icon: <Eye />, onSelect: () => navigate(`/invoices/${i.id}`) }]}
      />
    </>
  )
}
