import { Link } from 'react-router-dom'
import { PageHeader } from '@/components/common/PageHeader'
import { DataTable, type Column } from '@/components/tables/DataTable'
import { ListFilters } from '@/components/tables/FilterBar'
import { useListState } from '@/hooks/useListState'
import type { Refund } from '@/types'
import { formatCurrency, formatDate } from '@/utils/format'
import { useRefunds } from './hooks'

export default function RefundsPage() {
  const state = useListState({ sort: 'date', order: 'desc' })
  const { data, isLoading, isFetching, error, refetch } = useRefunds(state.params)
  const columns: Column<Refund>[] = [
    { key: 'id', header: 'Refund', cell: (r) => <span className="font-medium">{r.id}</span> },
    { key: 'student', header: 'Student', sortKey: 'student', cell: (r) => <Link to={`/students/${r.studentId}`} className="text-slate-900 hover:text-brand-700">{r.studentName}</Link> },
    { key: 'payment', header: 'Payment', hideBelow: 'md', cell: (r) => <Link to={`/payments/${r.paymentId}`} className="text-brand-700 hover:underline">{r.paymentId}</Link> },
    { key: 'amount', header: 'Amount', sortKey: 'amount', align: 'right', cell: (r) => <span className="font-medium text-purple-700">{formatCurrency(r.amount)}</span> },
    { key: 'date', header: 'Date', sortKey: 'date', cell: (r) => formatDate(r.date) },
    { key: 'reason', header: 'Reason', hideBelow: 'lg', className: 'max-w-sm', cell: (r) => <span className="line-clamp-2 text-slate-600">{r.reason}</span> },
    { key: 'by', header: 'Processed by', hideBelow: 'xl', cell: (r) => r.processedByName },
  ]
  return (
    <>
      <PageHeader title="Refunds" description="Refunds are issued from a payment (Payments → row actions → Issue refund)." />
      <ListFilters state={state} searchPlaceholder="Search student, reason…" dateRange={{ label: 'Refund date' }} />
      <DataTable
        caption="Refunds"
        columns={columns}
        rows={data?.items}
        rowKey={(r) => r.id}
        isLoading={isLoading}
        isFetching={isFetching}
        error={error}
        onRetry={refetch}
        sort={{ key: state.sort, order: state.order, onSort: state.toggleSort }}
        pagination={{ page: state.page, pageSize: state.pageSize, total: data?.total ?? 0, onPageChange: state.setPage, onPageSizeChange: state.setPageSize }}
        empty={{ title: 'No refunds issued' }}
      />
    </>
  )
}
