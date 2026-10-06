import { Eye, Pencil, Plus, Undo2 } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Can } from '@/components/common/Can'
import { PageHeader } from '@/components/common/PageHeader'
import { StatusBadge } from '@/components/common/StatusBadge'
import { DataTable, type Column } from '@/components/tables/DataTable'
import { ListFilters } from '@/components/tables/FilterBar'
import { Button } from '@/components/ui/button'
import { PAYMENT_METHODS, PAYMENT_STATUSES } from '@/constants/enums'
import { humanize, optionsFrom } from '@/constants/labels'
import { useAuth } from '@/features/auth/AuthContext'
import { useListState } from '@/hooks/useListState'
import { useLookups } from '@/hooks/useLookups'
import type { Payment } from '@/types'
import { formatCurrency, formatDate } from '@/utils/format'
import { EditPaymentDialog, RefundDialog } from './FinanceDialogs'
import { usePayments } from './hooks'
import { usePaymentLauncher } from './PaymentLauncher'

export default function PaymentsPage() {
  const state = useListState({ sort: 'paymentDate', order: 'desc' })
  const { data, isLoading, isFetching, error, refetch } = usePayments(state.params)
  const { courseOptions, batchOptions, employeeOptions } = useLookups()
  const { can } = useAuth()
  const navigate = useNavigate()
  const launcher = usePaymentLauncher()
  const [editing, setEditing] = useState<Payment | null>(null)
  const [refunding, setRefunding] = useState<Payment | null>(null)

  const columns: Column<Payment>[] = [
    {
      key: 'id',
      header: 'Payment',
      sortKey: 'id',
      cell: (p) => (
        <div>
          <Link to={`/payments/${p.id}`} className="font-medium text-brand-700 hover:underline" onClick={(e) => e.stopPropagation()}>
            {p.id}
          </Link>
          <p className="text-xs text-slate-500">{p.invoiceNumber}</p>
        </div>
      ),
    },
    {
      key: 'student',
      header: 'Student',
      sortKey: 'student',
      cell: (p) => (
        <Link to={`/students/${p.studentId}`} className="text-slate-900 hover:text-brand-700" onClick={(e) => e.stopPropagation()}>
          {p.studentName}
        </Link>
      ),
    },
    { key: 'amount', header: 'Amount', sortKey: 'amount', align: 'right', cell: (p) => <span className="font-medium">{formatCurrency(p.amount)}</span> },
    { key: 'method', header: 'Method', sortKey: 'method', hideBelow: 'md', cell: (p) => humanize(p.method) },
    { key: 'txn', header: 'Transaction ID', hideBelow: 'xl', cell: (p) => <span className="font-mono text-xs text-slate-600">{p.transactionId || '—'}</span> },
    { key: 'date', header: 'Date', sortKey: 'paymentDate', hideBelow: 'sm', cell: (p) => formatDate(p.paymentDate) },
    { key: 'by', header: 'Recorded by', hideBelow: 'xl', cell: (p) => p.recordedByName },
    { key: 'status', header: 'Status', sortKey: 'status', cell: (p) => <StatusBadge status={p.status} /> },
  ]

  return (
    <>
      <PageHeader
        title="Payments"
        description="Every payment received, pending or failed. Payments are never deleted — only corrected or refunded."
        actions={
          <Can permission="payments:create">
            <Button onClick={() => launcher.launch()}>
              <Plus className="h-4 w-4" aria-hidden /> Record payment
            </Button>
          </Can>
        }
      />
      <ListFilters
        state={state}
        searchPlaceholder="Search payment ID, student, txn ID…"
        selects={[
          { key: 'status', label: 'Status', options: optionsFrom(PAYMENT_STATUSES) },
          { key: 'method', label: 'Method', options: optionsFrom(PAYMENT_METHODS) },
          { key: 'courseId', label: 'Course', options: courseOptions },
          { key: 'batchId', label: 'Batch', options: batchOptions },
          { key: 'recordedById', label: 'Recorded by', options: employeeOptions() },
        ]}
        dateRange={{ label: 'Payment date' }}
      />
      <DataTable
        caption="Payments"
        columns={columns}
        rows={data?.items}
        rowKey={(p) => p.id}
        isLoading={isLoading}
        isFetching={isFetching}
        error={error}
        onRetry={refetch}
        sort={{ key: state.sort, order: state.order, onSort: state.toggleSort }}
        pagination={{ page: state.page, pageSize: state.pageSize, total: data?.total ?? 0, onPageChange: state.setPage, onPageSizeChange: state.setPageSize }}
        onRowClick={(p) => navigate(`/payments/${p.id}`)}
        rowActions={(p) => [
          { label: 'View payment', icon: <Eye />, onSelect: () => navigate(`/payments/${p.id}`) },
          { label: 'Modify payment', icon: <Pencil />, hidden: !can('payments:update') || p.status === 'REFUNDED', onSelect: () => setEditing(p) },
          { label: 'Issue refund', icon: <Undo2 />, danger: true, separatorBefore: true, hidden: !can('refunds:create') || p.status !== 'SUCCESS', onSelect: () => setRefunding(p) },
        ]}
      />
      <EditPaymentDialog payment={editing} onClose={() => setEditing(null)} />
      <RefundDialog payment={refunding} onClose={() => setRefunding(null)} />
      {launcher.node}
    </>
  )
}
