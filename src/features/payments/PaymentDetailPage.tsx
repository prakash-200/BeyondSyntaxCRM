import { Pencil, Receipt, Undo2 } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Can } from '@/components/common/Can'
import { PageHeader } from '@/components/common/PageHeader'
import { ErrorState, LoadingState } from '@/components/common/States'
import { StatusBadge, Badge } from '@/components/common/StatusBadge'
import { ActivityTimeline } from '@/components/timeline/ActivityTimeline'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { DescriptionList } from '@/components/ui/misc'
import { humanize } from '@/constants/labels'
import { formatCurrency, formatDate, formatDateTime } from '@/utils/format'
import { EditPaymentDialog, RefundDialog } from './FinanceDialogs'
import { usePayment, usePaymentActivity } from './hooks'

export default function PaymentDetailPage() {
  const { id = '' } = useParams()
  const { data: p, isLoading, error, refetch } = usePayment(id)
  const activity = usePaymentActivity(id)
  const [editing, setEditing] = useState(false)
  const [refunding, setRefunding] = useState(false)

  if (isLoading) return <LoadingState label="Loading payment…" />
  if (error || !p) return <ErrorState error={error} title="Unable to load payment" onRetry={refetch} />

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: 'Payments', to: '/payments' }, { label: p.id }]}
        title={
          <span className="flex flex-wrap items-center gap-3">
            {formatCurrency(p.amount)}
            <StatusBadge status={p.status} />
            {p.isOverpayment && <Badge tone="warning">Overpayment</Badge>}
          </span>
        }
        description={`${p.id} · ${p.studentName} · ${formatDate(p.paymentDate)}`}
        actions={
          <>
            {p.invoice && (
              <Button variant="outline">
                <Receipt className="h-4 w-4" aria-hidden />
                <Link to={`/invoices/${p.invoice.id}`}>View invoice</Link>
              </Button>
            )}
            <Can permission="payments:update">
              {p.status !== 'REFUNDED' && (
                <Button variant="outline" onClick={() => setEditing(true)}>
                  <Pencil className="h-4 w-4" aria-hidden /> Modify
                </Button>
              )}
            </Can>
            <Can permission="refunds:create">
              {p.status === 'SUCCESS' && (
                <Button variant="danger-outline" onClick={() => setRefunding(true)}>
                  <Undo2 className="h-4 w-4" aria-hidden /> Refund
                </Button>
              )}
            </Can>
          </>
        }
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Payment details" />
          <CardContent>
            <DescriptionList
              items={[
                { label: 'Student', value: p.student ? <Link className="text-brand-700 hover:underline" to={`/students/${p.student.id}`}>{p.student.fullName}</Link> : '—' },
                { label: 'Course', value: p.student?.courseName },
                { label: 'Invoice', value: p.invoice ? <Link className="text-brand-700 hover:underline" to={`/invoices/${p.invoice.id}`}>{p.invoice.number}</Link> : '—' },
                { label: 'Payment method', value: humanize(p.method) },
                { label: 'Transaction ID', value: <span className="font-mono text-xs">{p.transactionId || '—'}</span> },
                { label: 'Payment date', value: formatDate(p.paymentDate) },
                { label: 'Recorded by', value: p.recordedByName },
                { label: 'Recorded at', value: formatDateTime(p.createdAt) },
                { label: 'Notes', value: p.notes || '—' },
              ]}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader title="Audit trail" description="Every change to this payment" />
          <CardContent>
            <ActivityTimeline items={activity.data} isLoading={activity.isLoading} error={activity.error} onRetry={activity.refetch} compact />
          </CardContent>
        </Card>
      </div>
      <EditPaymentDialog payment={editing ? p : null} onClose={() => setEditing(false)} />
      <RefundDialog payment={refunding ? p : null} onClose={() => setRefunding(false)} />
    </>
  )
}
