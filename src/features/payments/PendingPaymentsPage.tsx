import { Banknote, Phone } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { PageHeader } from '@/components/common/PageHeader'
import { StatusBadge } from '@/components/common/StatusBadge'
import { DataTable, type Column } from '@/components/tables/DataTable'
import { ListFilters } from '@/components/tables/FilterBar'
import { useAuth } from '@/features/auth/AuthContext'
import { useListState } from '@/hooks/useListState'
import { useLookups } from '@/hooks/useLookups'
import type { PendingInstallment } from '@/types'
import { formatCurrency, formatDate, formatPhone } from '@/utils/format'
import { usePendingInstallments } from './hooks'
import { usePaymentLauncher } from './PaymentLauncher'

export default function PendingPaymentsPage() {
  const [search] = useSearchParams()
  const state = useListState({ sort: 'dueDate', filters: { status: search.get('status') ?? '' } })
  const { data, isLoading, isFetching, error, refetch } = usePendingInstallments(state.params)
  const { courseOptions, batchOptions } = useLookups()
  const { can } = useAuth()
  const launcher = usePaymentLauncher()

  const columns: Column<PendingInstallment>[] = [
    {
      key: 'student',
      header: 'Student',
      sortKey: 'student',
      cell: (r) => (
        <div>
          <Link to={`/students/${r.studentId}`} className="font-medium text-slate-900 hover:text-brand-700">
            {r.studentName}
          </Link>
          <p className="text-xs text-slate-500">{r.courseName}</p>
        </div>
      ),
    },
    { key: 'phone', header: 'Phone', hideBelow: 'lg', cell: (r) => <span className="inline-flex items-center gap-1 text-slate-600"><Phone className="h-3 w-3" aria-hidden />{formatPhone(r.phone)}</span> },
    { key: 'inst', header: 'Installment', hideBelow: 'md', cell: (r) => `#${r.number}` },
    { key: 'amount', header: 'Amount due', sortKey: 'amount', align: 'right', cell: (r) => <span className="font-medium">{formatCurrency(r.amount - r.paidAmount)}</span> },
    { key: 'due', header: 'Due date', sortKey: 'dueDate', cell: (r) => <span className={r.status === 'OVERDUE' ? 'font-medium text-red-600' : ''}>{formatDate(r.dueDate)}</span> },
    { key: 'days', header: 'Overdue by', sortKey: 'days', align: 'right', hideBelow: 'md', cell: (r) => (r.daysOverdue ? <span className="font-medium text-red-600">{r.daysOverdue} days</span> : <span className="text-slate-400">—</span>) },
    { key: 'status', header: 'Status', cell: (r) => <StatusBadge status={r.status} /> },
  ]

  return (
    <>
      <PageHeader title="Pending payments" description="Unpaid installments, oldest first. Overdue items are highlighted." />
      <ListFilters
        state={state}
        searchPlaceholder="Search student, phone…"
        selects={[
          { key: 'status', label: 'Status', options: [{ value: 'OVERDUE', label: 'Overdue' }, { value: 'PENDING', label: 'Upcoming (not yet due)' }], allLabel: 'Overdue + upcoming' },
          { key: 'courseId', label: 'Course', options: courseOptions },
          { key: 'batchId', label: 'Batch', options: batchOptions },
        ]}
        dateRange={{ label: 'Due date' }}
      />
      <DataTable
        caption="Pending installments"
        columns={columns}
        rows={data?.items}
        rowKey={(r) => r.id}
        isLoading={isLoading}
        isFetching={isFetching}
        error={error}
        onRetry={refetch}
        sort={{ key: state.sort, order: state.order, onSort: state.toggleSort }}
        pagination={{ page: state.page, pageSize: state.pageSize, total: data?.total ?? 0, onPageChange: state.setPage, onPageSizeChange: state.setPageSize }}
        rowClassName={(r) => (r.status === 'OVERDUE' ? 'bg-red-50/40' : undefined)}
        rowActions={(r) => [{ label: 'Record payment', icon: <Banknote />, hidden: !can('payments:create'), onSelect: () => launcher.launch(r.studentId, r.id) }]}
        empty={{ title: 'No pending payments', description: 'All installments are settled.' }}
      />
      {launcher.node}
    </>
  )
}
