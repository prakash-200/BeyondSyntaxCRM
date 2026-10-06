import { useQuery } from '@tanstack/react-query'
import { GraduationCap, Printer } from 'lucide-react'
import { useParams } from 'react-router-dom'
import { commonApi } from '@/api/reportApi'
import { PageHeader } from '@/components/common/PageHeader'
import { ErrorState, LoadingState } from '@/components/common/States'
import { StatusBadge } from '@/components/common/StatusBadge'
import { Button } from '@/components/ui/button'
import { humanize } from '@/constants/labels'
import { formatCurrency, formatDate, formatPhone } from '@/utils/format'
import { useInvoice } from './hooks'

/** Printable invoice. Later this view can be replaced by a backend-generated PDF. */
export default function InvoiceViewPage() {
  const { id = '' } = useParams()
  const { data: inv, isLoading, error, refetch } = useInvoice(id)
  const settings = useQuery({ queryKey: ['settings'], queryFn: commonApi.settings, staleTime: 5 * 60_000 })

  if (isLoading || settings.isLoading) return <LoadingState label="Loading invoice…" />
  if (error || !inv || !settings.data) return <ErrorState error={error ?? settings.error} title="Unable to load invoice" onRetry={refetch} />
  const co = settings.data
  const payments = inv.payments.filter((p) => p.status === 'SUCCESS' || p.status === 'REFUNDED')

  return (
    <>
      <div className="no-print">
        <PageHeader
          breadcrumbs={[{ label: 'Invoices', to: '/invoices' }, { label: inv.number }]}
          title={`Invoice ${inv.number}`}
          actions={
            <Button onClick={() => window.print()}>
              <Printer className="h-4 w-4" aria-hidden /> Print / save as PDF
            </Button>
          }
        />
      </div>
      <article className="print-area mx-auto max-w-3xl rounded-xl border border-slate-200 bg-white p-8 shadow-sm sm:p-10" aria-label={`Invoice ${inv.number}`}>
        <header className="flex flex-wrap items-start justify-between gap-6 border-b border-slate-200 pb-6">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-600 text-white" aria-hidden>
              <GraduationCap className="h-6 w-6" />
            </span>
            <div className="text-sm">
              <p className="text-base font-semibold text-slate-900">{co.companyName}</p>
              <p className="text-slate-500">{co.legalName}</p>
              <p className="mt-1 max-w-xs text-slate-500">{co.address}</p>
              <p className="text-slate-500">
                {co.phone} · {co.email}
              </p>
              {co.gstin && <p className="text-slate-500">GSTIN: {co.gstin}</p>}
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl font-semibold tracking-tight text-slate-900">INVOICE</p>
            <p className="mt-1 text-sm text-slate-600">{inv.number}</p>
            <p className="text-sm text-slate-500">Date: {formatDate(inv.date)}</p>
            <div className="mt-2">
              <StatusBadge status={inv.status} />
            </div>
          </div>
        </header>

        <section className="grid gap-6 border-b border-slate-200 py-6 text-sm sm:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Billed to</p>
            <p className="mt-1 font-medium text-slate-900">{inv.student.fullName}</p>
            <p className="text-slate-600">{inv.student.id}</p>
            <p className="text-slate-600">{[inv.student.address, inv.student.city, inv.student.state, inv.student.postalCode].filter(Boolean).join(', ')}</p>
            <p className="text-slate-600">
              {inv.student.email} · {formatPhone(inv.student.phone)}
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Course</p>
            <p className="mt-1 font-medium text-slate-900">{inv.courseName}</p>
          </div>
        </section>

        <table className="mt-6 w-full text-sm">
          <caption className="sr-only">Invoice line items</caption>
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="py-2 font-semibold">Description</th>
              <th className="py-2 text-right font-semibold">Amount</th>
            </tr>
          </thead>
          <tbody>
            {inv.items.map((i) => (
              <tr key={i.description} className="border-b border-slate-100">
                <td className="py-3">{i.description}</td>
                <td className="py-3 text-right tabular-nums">{formatCurrency(i.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <dl className="ml-auto mt-4 w-full max-w-xs space-y-1.5 text-sm">
          <div className="flex justify-between"><dt className="text-slate-600">Subtotal</dt><dd className="tabular-nums">{formatCurrency(inv.subtotal)}</dd></div>
          {inv.discount > 0 && <div className="flex justify-between"><dt className="text-slate-600">Discount</dt><dd className="tabular-nums text-emerald-700">− {formatCurrency(inv.discount)}</dd></div>}
          {inv.scholarship > 0 && <div className="flex justify-between"><dt className="text-slate-600">Scholarship</dt><dd className="tabular-nums text-emerald-700">− {formatCurrency(inv.scholarship)}</dd></div>}
          <div className="flex justify-between border-t border-slate-200 pt-2 font-semibold"><dt>Total payable</dt><dd className="tabular-nums">{formatCurrency(inv.total)}</dd></div>
          {inv.taxRate > 0 && <div className="flex justify-between text-xs text-slate-500"><dt>Includes GST @ {inv.taxRate}%</dt><dd className="tabular-nums">{formatCurrency(inv.taxAmount)}</dd></div>}
          <div className="flex justify-between"><dt className="text-slate-600">Paid</dt><dd className="tabular-nums text-emerald-700">{formatCurrency(inv.paid)}</dd></div>
          <div className="flex justify-between rounded-lg bg-slate-50 px-3 py-2 text-base font-semibold"><dt>Balance due</dt><dd className="tabular-nums">{formatCurrency(inv.balance)}</dd></div>
        </dl>

        <section className="mt-8" aria-labelledby="pay-history">
          <h2 id="pay-history" className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Payment history
          </h2>
          {payments.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">No payments received yet.</p>
          ) : (
            <table className="mt-2 w-full text-sm">
              <caption className="sr-only">Payments received</caption>
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                  <th className="py-1.5 font-medium">Date</th>
                  <th className="py-1.5 font-medium">Receipt</th>
                  <th className="py-1.5 font-medium">Method</th>
                  <th className="py-1.5 text-right font-medium">Amount</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id} className="border-b border-slate-100">
                    <td className="py-2">{formatDate(p.paymentDate)}</td>
                    <td className="py-2 font-mono text-xs">{p.id}</td>
                    <td className="py-2">{humanize(p.method)}</td>
                    <td className="py-2 text-right tabular-nums">
                      {formatCurrency(p.amount)}
                      {p.status === 'REFUNDED' && <span className="ml-1 text-xs text-purple-600">(refunded)</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
        <footer className="mt-10 border-t border-slate-200 pt-4 text-center text-xs text-slate-400">This is a computer-generated invoice. Thank you for choosing {co.companyName}.</footer>
      </article>
    </>
  )
}
