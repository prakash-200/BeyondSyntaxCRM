import { Banknote, Pencil, Plus, SlidersHorizontal } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Can } from '@/components/common/Can'
import { EmptyState, ErrorState, LoadingState } from '@/components/common/States'
import { StatusBadge } from '@/components/common/StatusBadge'
import { Button } from '@/components/ui/button'
import { Card, CardHeader } from '@/components/ui/card'
import { ProgressBar } from '@/components/ui/misc'
import { today } from '@/utils/clock'
import { formatCurrency, formatDate, formatDateTime } from '@/utils/format'
import type { FeePlan } from '@/types'
import { useStudentFeePlan } from '@/features/students/hooks'
import { ChangeFeeDialog, FeePlanDialog, RescheduleInstallmentsDialog } from './FinanceDialogs'
import { usePaymentLauncher } from './PaymentLauncher'

export function FeeSummaryTiles({ plan }: { plan: FeePlan }) {
  const tiles = [
    { label: 'Course fee', value: formatCurrency(plan.courseFee) },
    { label: 'Discount', value: formatCurrency(plan.discount + plan.scholarship), hint: plan.scholarship ? `incl. ${formatCurrency(plan.scholarship)} scholarship` : undefined },
    { label: 'Final fee', value: formatCurrency(plan.finalFee), strong: true },
    { label: 'Paid', value: formatCurrency(plan.paid), tone: 'text-emerald-700' },
    { label: 'Outstanding', value: formatCurrency(plan.outstanding), tone: plan.outstanding ? 'text-amber-700' : 'text-slate-900' },
  ]
  return (
    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-5">
      {tiles.map((t) => (
        <div key={t.label} className="rounded-lg bg-slate-50 px-4 py-3">
          <dt className="text-xs font-medium text-slate-500">{t.label}</dt>
          <dd className={`mt-1 text-lg font-semibold tabular-nums ${t.tone ?? 'text-slate-900'}`}>{t.value}</dd>
          {t.hint && <dd className="text-[11px] text-slate-400">{t.hint}</dd>}
        </div>
      ))}
    </dl>
  )
}

export function InstallmentsList({ plan, onPay }: { plan: FeePlan; onPay?: (installmentId: string) => void }) {
  return (
    <ul className="divide-y divide-slate-100">
      {plan.installments.map((i) => (
        <li key={i.id} className={`flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 ${i.status === 'OVERDUE' ? 'bg-red-50/50' : ''}`}>
          <div>
            <p className="text-sm font-medium text-slate-900">
              Installment {i.number} · {formatCurrency(i.amount)}
            </p>
            <p className={`text-xs ${i.status === 'OVERDUE' ? 'font-medium text-red-600' : 'text-slate-500'}`}>
              Due {formatDate(i.dueDate)}
              {i.status === 'OVERDUE' && ` · overdue by ${Math.max(1, Math.round((new Date(today()).getTime() - new Date(i.dueDate).getTime()) / 86400000))} days`}
              {i.status === 'PAID' && i.paidAt && ` · paid ${formatDateTime(i.paidAt).slice(0, 11)}`}
              {i.status === 'PENDING' && i.paidAmount > 0 && ` · ${formatCurrency(i.paidAmount)} received`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={i.status} />
            {onPay && (i.status === 'PENDING' || i.status === 'OVERDUE') && (
              <Can permission="payments:create">
                <Button size="sm" variant="outline" onClick={() => onPay(i.id)}>
                  Record payment
                </Button>
              </Can>
            )}
          </div>
        </li>
      ))}
    </ul>
  )
}

/** Fee plan view + actions for one student (student "Fees" tab and fee drawer). */
export function FeePlanPanel({ student }: { student: { id: string; fullName: string; courseId: string; courseName?: string } }) {
  const { data: plan, isLoading, error, refetch } = useStudentFeePlan(student.id)
  const launcher = usePaymentLauncher()
  const [creating, setCreating] = useState(false)
  const [changing, setChanging] = useState<FeePlan | null>(null)
  const [rescheduling, setRescheduling] = useState<FeePlan | null>(null)

  if (isLoading) return <LoadingState label="Loading fee plan…" />
  if (error) return <ErrorState error={error} onRetry={refetch} />
  if (!plan)
    return (
      <Card>
        <EmptyState
          title="No fee plan yet"
          description="Create a fee plan with installments before recording payments."
          icon={<Banknote className="h-5 w-5" />}
          action={
            <Can permission="fees:create">
              <Button onClick={() => setCreating(true)}>
                <Plus className="h-4 w-4" aria-hidden /> Create fee plan
              </Button>
              <FeePlanDialog open={creating} onClose={() => setCreating(false)} student={student} />
            </Can>
          }
        />
      </Card>
    )

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          title="Fee summary"
          description={plan.invoiceId ? <>Invoice <Link className="text-brand-700 hover:underline" to={`/invoices/${plan.invoiceId}`}>{plan.invoiceId}</Link></> : undefined}
          action={
            <>
              <StatusBadge status={plan.status} />
              <Can permission="fees:update">
                <Button variant="outline" size="sm" onClick={() => setChanging(plan)}>
                  <Pencil className="h-3.5 w-3.5" aria-hidden /> Change fee
                </Button>
              </Can>
            </>
          }
        />
        <div className="space-y-4 p-5">
          <FeeSummaryTiles plan={plan} />
          <ProgressBar value={plan.finalFee ? (plan.paid / plan.finalFee) * 100 : 0} showLabel label="Fee paid" />
        </div>
      </Card>
      <Card>
        <CardHeader
          title="Installments"
          action={
            <>
              <Can permission="fees:update">
                {plan.outstanding > 0 && (
                  <Button variant="outline" size="sm" onClick={() => setRescheduling(plan)}>
                    <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden /> Edit plan
                  </Button>
                )}
              </Can>
              <Can permission="payments:create">
                <Button size="sm" onClick={() => launcher.launch(student.id)}>
                  <Plus className="h-3.5 w-3.5" aria-hidden /> Record payment
                </Button>
              </Can>
            </>
          }
        />
        <InstallmentsList plan={plan} onPay={(id) => launcher.launch(student.id, id)} />
      </Card>
      <ChangeFeeDialog plan={changing} onClose={() => setChanging(null)} />
      <RescheduleInstallmentsDialog plan={rescheduling} onClose={() => setRescheduling(null)} />
      {launcher.node}
    </div>
  )
}
