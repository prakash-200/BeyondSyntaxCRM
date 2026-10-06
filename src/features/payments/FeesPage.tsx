import { Eye, Pencil, Plus, SlidersHorizontal } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader } from '@/components/common/PageHeader'
import { StatusBadge } from '@/components/common/StatusBadge'
import { DataTable, type Column } from '@/components/tables/DataTable'
import { ListFilters } from '@/components/tables/FilterBar'
import { Drawer } from '@/components/ui/dialog'
import { ProgressBar } from '@/components/ui/misc'
import { FEE_STATUSES } from '@/constants/enums'
import { optionsFrom } from '@/constants/labels'
import { useAuth } from '@/features/auth/AuthContext'
import { useListState } from '@/hooks/useListState'
import { useLookups } from '@/hooks/useLookups'
import type { FeePlan } from '@/types'
import { formatCurrency } from '@/utils/format'
import { ChangeFeeDialog, RescheduleInstallmentsDialog } from './FinanceDialogs'
import { FeePlanPanel } from './FeePlanPanel'
import { useFeePlans } from './hooks'
import { usePaymentLauncher } from './PaymentLauncher'

export default function FeesPage() {
  const state = useListState({ sort: 'createdAt', order: 'desc' })
  const { data, isLoading, isFetching, error, refetch } = useFeePlans(state.params)
  const { courseOptions, batchOptions } = useLookups()
  const { can } = useAuth()
  const launcher = usePaymentLauncher()
  const [view, setView] = useState<FeePlan | null>(null)
  const [changing, setChanging] = useState<FeePlan | null>(null)
  const [resched, setResched] = useState<FeePlan | null>(null)

  const columns: Column<FeePlan>[] = [
    {
      key: 'student',
      header: 'Student',
      sortKey: 'student',
      cell: (p) => (
        <div>
          <Link to={`/students/${p.studentId}`} className="font-medium text-slate-900 hover:text-brand-700" onClick={(e) => e.stopPropagation()}>
            {p.studentName}
          </Link>
          <p className="text-xs text-slate-500">{p.courseName}</p>
        </div>
      ),
    },
    { key: 'final', header: 'Final fee', sortKey: 'finalFee', align: 'right', cell: (p) => formatCurrency(p.finalFee) },
    { key: 'paid', header: 'Paid', sortKey: 'paid', align: 'right', hideBelow: 'md', cell: (p) => <span className="text-emerald-700">{formatCurrency(p.paid)}</span> },
    { key: 'out', header: 'Outstanding', sortKey: 'outstanding', align: 'right', cell: (p) => <span className={p.outstanding ? 'font-medium text-amber-700' : 'text-slate-400'}>{formatCurrency(p.outstanding)}</span> },
    { key: 'bar', header: 'Collected', hideBelow: 'lg', className: 'w-36', cell: (p) => <ProgressBar value={p.finalFee ? (p.paid / p.finalFee) * 100 : 0} showLabel label="Collected" /> },
    { key: 'inst', header: 'Installments', hideBelow: 'xl', cell: (p) => `${p.installments.filter((i) => i.status === 'PAID').length}/${p.installments.filter((i) => i.status !== 'CANCELLED').length} paid` },
    { key: 'status', header: 'Status', sortKey: 'status', cell: (p) => <StatusBadge status={p.status} /> },
  ]

  return (
    <>
      <PageHeader title="Fee management" description="Fee plans, installments and outstanding balances for every student." />
      <ListFilters
        state={state}
        searchPlaceholder="Search student…"
        selects={[
          { key: 'status', label: 'Fee status', options: optionsFrom(FEE_STATUSES) },
          { key: 'courseId', label: 'Course', options: courseOptions },
          { key: 'batchId', label: 'Batch', options: batchOptions },
        ]}
      />
      <DataTable
        caption="Fee plans"
        columns={columns}
        rows={data?.items}
        rowKey={(p) => p.id}
        isLoading={isLoading}
        isFetching={isFetching}
        error={error}
        onRetry={refetch}
        sort={{ key: state.sort, order: state.order, onSort: state.toggleSort }}
        pagination={{ page: state.page, pageSize: state.pageSize, total: data?.total ?? 0, onPageChange: state.setPage, onPageSizeChange: state.setPageSize }}
        onRowClick={setView}
        rowActions={(p) => [
          { label: 'View fee details', icon: <Eye />, onSelect: () => setView(p) },
          { label: 'Record payment', icon: <Plus />, hidden: !can('payments:create') || p.outstanding === 0, onSelect: () => launcher.launch(p.studentId) },
          { label: 'Change fee', icon: <Pencil />, hidden: !can('fees:update'), onSelect: () => setChanging(p) },
          { label: 'Edit installments', icon: <SlidersHorizontal />, hidden: !can('fees:update') || p.outstanding === 0, onSelect: () => setResched(p) },
        ]}
      />
      <Drawer open={!!view} onClose={() => setView(null)} title={view?.studentName ?? ''} description={view?.courseName} width="max-w-2xl">
        {view && <FeePlanPanel student={{ id: view.studentId, fullName: view.studentName ?? '', courseId: view.courseId, courseName: view.courseName }} />}
      </Drawer>
      <ChangeFeeDialog plan={changing} onClose={() => setChanging(null)} />
      <RescheduleInstallmentsDialog plan={resched} onClose={() => setResched(null)} />
      {launcher.node}
    </>
  )
}
