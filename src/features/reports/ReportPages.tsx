import { Banknote, CircleDollarSign, Download, RotateCcw, TrendingDown, Wallet } from 'lucide-react'
import { Link } from 'react-router-dom'
import { reportApi } from '@/api/reportApi'
import { toast } from 'sonner'
import { useState } from 'react'
import { DonutChart, SimpleBarChart } from '@/components/charts/charts'
import { KpiCard } from '@/components/common/KpiCard'
import { PageHeader } from '@/components/common/PageHeader'
import { ErrorState, LoadingState } from '@/components/common/States'
import { StatusBadge } from '@/components/common/StatusBadge'
import { DataTable, type Column } from '@/components/tables/DataTable'
import { DateRangeFilter, ListFilters } from '@/components/tables/FilterBar'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { ProgressBar } from '@/components/ui/misc'
import { STUDENT_STATUSES } from '@/constants/enums'
import { humanize, optionsFrom } from '@/constants/labels'
import { useListState } from '@/hooks/useListState'
import { useLookups } from '@/hooks/useLookups'
import type { StudentReportRow } from '@/types'
import { downloadFile, toCsv } from '@/utils/csv'
import { formatCurrency, formatDate, formatNumber, formatPercent } from '@/utils/format'
import { useBusinessReport, useEmployeeReport, useFinancialReport, useLeadReport, useStudentReport } from './hooks'

function Section({ title, description, children, className }: { title: string; description?: string; children: React.ReactNode; className?: string }) {
  return (
    <Card className={className}>
      <CardHeader title={title} description={description} />
      <CardContent>{children}</CardContent>
    </Card>
  )
}

/* ───────────── student report ───────────── */

export function StudentReportPage() {
  const state = useListState({ sort: 'admissionDate', order: 'desc' })
  const { data, isLoading, isFetching, error, refetch } = useStudentReport(state.params)
  const { courseOptions, batchOptions, employeeOptions } = useLookups()
  const [exporting, setExporting] = useState(false)

  const exportCsv = async () => {
    setExporting(true)
    try {
      const all = await reportApi.students({ ...state.params, page: 1, pageSize: 500 })
      downloadFile('student-report.csv', toCsv(all.items, [
        { header: 'Student ID', value: (r) => r.id }, { header: 'Name', value: (r) => r.fullName }, { header: 'Course', value: (r) => r.courseName }, { header: 'Batch', value: (r) => r.batchName },
        { header: 'Status', value: (r) => humanize(r.status) }, { header: 'Counselor', value: (r) => r.counselorName }, { header: 'Admission date', value: (r) => r.admissionDate },
        { header: 'Progress %', value: (r) => r.progressPercent }, { header: 'Attendance %', value: (r) => r.attendancePercent },
      ]))
      toast.success(`Exported ${all.items.length} rows`)
    } catch {
      toast.error('Export failed')
    } finally {
      setExporting(false)
    }
  }

  const columns: Column<StudentReportRow>[] = [
    { key: 'name', header: 'Student', sortKey: 'name', cell: (r) => <div><Link to={`/students/${r.id}`} className="font-medium text-slate-900 hover:text-brand-700">{r.fullName}</Link><p className="text-xs text-slate-500">{r.id}</p></div> },
    { key: 'course', header: 'Course', sortKey: 'course', hideBelow: 'md', cell: (r) => r.courseName },
    { key: 'batch', header: 'Batch', hideBelow: 'lg', cell: (r) => r.batchName },
    { key: 'counselor', header: 'Counselor', hideBelow: 'xl', cell: (r) => r.counselorName },
    { key: 'adm', header: 'Admitted', sortKey: 'admissionDate', hideBelow: 'lg', cell: (r) => formatDate(r.admissionDate) },
    { key: 'prog', header: 'Progress', sortKey: 'progress', className: 'w-36', cell: (r) => <ProgressBar value={r.progressPercent} showLabel label="Progress" /> },
    { key: 'att', header: 'Attendance', sortKey: 'attendance', align: 'right', hideBelow: 'md', cell: (r) => <span className={r.attendancePercent < 75 && r.attendancePercent > 0 ? 'font-medium text-red-600' : ''}>{formatPercent(r.attendancePercent)}</span> },
    { key: 'status', header: 'Status', cell: (r) => <StatusBadge status={r.status} /> },
  ]
  return (
    <>
      <PageHeader title="Student report" description="Enrolment, progress and attendance by course, batch and counselor." actions={<Button variant="outline" onClick={exportCsv} loading={exporting}><Download className="h-4 w-4" aria-hidden /> Export CSV</Button>} />
      <ListFilters
        state={state}
        searchPlaceholder="Search student, course, batch…"
        selects={[
          { key: 'status', label: 'Status', options: optionsFrom(STUDENT_STATUSES) },
          { key: 'courseId', label: 'Course', options: courseOptions },
          { key: 'batchId', label: 'Batch', options: batchOptions },
          { key: 'counselorId', label: 'Counselor', options: employeeOptions('COUNSELOR') },
        ]}
        dateRange={{ label: 'Admission' }}
      />
      <DataTable
        caption="Student report"
        columns={columns}
        rows={data?.items}
        rowKey={(r) => r.id}
        isLoading={isLoading}
        isFetching={isFetching}
        error={error}
        onRetry={refetch}
        sort={{ key: state.sort, order: state.order, onSort: state.toggleSort }}
        pagination={{ page: state.page, pageSize: state.pageSize, total: data?.total ?? 0, onPageChange: state.setPage, onPageSizeChange: state.setPageSize }}
      />
    </>
  )
}

/* ───────────── financial report ───────────── */

export function FinancialReportPage() {
  const [range, setRange] = useState({ from: '', to: '' })
  const { data, isLoading, error, refetch } = useFinancialReport({ from: range.from || undefined, to: range.to || undefined })
  return (
    <>
      <PageHeader title="Financial report" description="Billing, collections, outstanding balances and refunds." actions={<DateRangeFilter label="Period" from={range.from} to={range.to} onChange={(from, to) => setRange({ from, to })} />} />
      {isLoading ? (
        <LoadingState />
      ) : error || !data ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <KpiCard label="Total revenue (billed)" value={formatCurrency(data.totalRevenue)} icon={CircleDollarSign} hint={range.from || range.to ? 'in period' : 'all time'} />
            <KpiCard label="Collected" value={formatCurrency(data.collected)} icon={Banknote} accent="bg-emerald-50 text-emerald-600" />
            <KpiCard label="Outstanding" value={formatCurrency(data.outstanding)} icon={Wallet} accent="bg-amber-50 text-amber-600" />
            <KpiCard label="Overdue" value={formatCurrency(data.overdue)} icon={TrendingDown} accent="bg-red-50 text-red-600" to="/payments/pending?status=OVERDUE" />
            <KpiCard label="Refunds" value={formatCurrency(data.refunds)} icon={RotateCcw} accent="bg-purple-50 text-purple-600" to="/refunds" />
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            <Section title="Collections by month" description="Last 9 months" className="lg:col-span-2">
              <div className="h-64"><SimpleBarChart data={data.byMonth} xKey="month" currency bars={[{ key: 'collected', name: 'Collected' }, { key: 'refunds', name: 'Refunds', color: '#a855f7' }]} /></div>
            </Section>
            <Section title="By payment method">
              <div className="h-64"><DonutChart data={data.byMethod.map((m) => ({ name: humanize(m.method), value: m.amount }))} centerLabel="₹ collected" /></div>
            </Section>
          </div>
          <Card>
            <CardHeader title="By course" />
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-sm">
                <caption className="sr-only">Billing by course</caption>
                <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3">Course</th><th className="px-3 py-3 text-right">Billed</th><th className="px-3 py-3 text-right">Collected</th><th className="px-3 py-3 text-right">Outstanding</th><th className="w-44 px-3 py-3">Collection</th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {data.byCourse.map((c) => (
                    <tr key={c.course}>
                      <td className="px-5 py-3 font-medium text-slate-900">{c.course}</td>
                      <td className="px-3 py-3 text-right tabular-nums">{formatCurrency(c.billed)}</td>
                      <td className="px-3 py-3 text-right tabular-nums text-emerald-700">{formatCurrency(c.collected)}</td>
                      <td className="px-3 py-3 text-right tabular-nums text-amber-700">{formatCurrency(c.outstanding)}</td>
                      <td className="px-3 py-3"><ProgressBar value={c.billed ? (c.collected / c.billed) * 100 : 0} showLabel label={`${c.course} collection`} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
    </>
  )
}

/* ───────────── business report (admissions + lead performance) ───────────── */

export function BusinessReportPage() {
  const biz = useBusinessReport()
  const leads = useLeadReport({})
  if (biz.isLoading || leads.isLoading) return <LoadingState />
  if (biz.error || !biz.data) return <ErrorState error={biz.error} onRetry={biz.refetch} />
  const b = biz.data
  const l = leads.data
  return (
    <>
      <PageHeader title="Business report" description="Admissions, lead conversion, revenue by course and batch utilisation." />
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          <KpiCard label="Lead conversion" value={formatPercent(l?.conversionRate ?? 0)} hint={`${l?.converted ?? 0} of ${l?.total ?? 0} leads`} />
          <KpiCard label="Leads lost" value={formatNumber(l?.lost ?? 0)} accent="bg-red-50 text-red-600" />
          <KpiCard label="Course completion rate" value={formatPercent(b.completionRate)} accent="bg-emerald-50 text-emerald-600" />
          <KpiCard label="Drop-out rate" value={formatPercent(b.dropRate)} accent="bg-amber-50 text-amber-600" />
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <Section title="Admissions by month"><div className="h-64"><SimpleBarChart data={b.admissionsByMonth} xKey="month" bars={[{ key: 'admissions', name: 'Admissions' }]} /></div></Section>
          <Section title="Leads vs conversions" description="By month created">{l && <div className="h-64"><SimpleBarChart data={l.byMonth} xKey="month" bars={[{ key: 'leads', name: 'Leads' }, { key: 'converted', name: 'Converted', color: '#10b981' }]} /></div>}</Section>
          <Section title="Revenue by course" description="Net collections"><div className="h-64"><SimpleBarChart data={b.revenueByCourse.map((r) => ({ ...r, course: r.course.length > 12 ? `${r.course.slice(0, 11)}…` : r.course }))} xKey="course" currency bars={[{ key: 'revenue', name: 'Revenue' }]} /></div></Section>
          <Section title="Batch utilisation" description="Enrolled vs capacity">
            <ul className="space-y-3">
              {b.batchUtilization.map((u) => (
                <li key={u.batch}>
                  <div className="mb-1 flex justify-between text-xs"><span className="font-medium text-slate-700">{u.batch}</span><span className="tabular-nums text-slate-500">{u.enrolled}/{u.capacity}</span></div>
                  <ProgressBar value={(u.enrolled / u.capacity) * 100} tone={u.enrolled >= u.capacity ? 'danger' : 'brand'} label={`${u.batch} utilisation`} />
                </li>
              ))}
            </ul>
          </Section>
        </div>
        {l && (
          <Card>
            <CardHeader title="Lead source performance" />
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] text-left text-sm">
                <caption className="sr-only">Lead source performance</caption>
                <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3">Source</th><th className="px-3 py-3 text-right">Leads</th><th className="px-3 py-3 text-right">Converted</th><th className="w-48 px-3 py-3">Conversion rate</th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {l.bySource.map((s) => (
                    <tr key={s.source}><td className="px-5 py-3 font-medium">{humanize(s.source)}</td><td className="px-3 py-3 text-right tabular-nums">{s.leads}</td><td className="px-3 py-3 text-right tabular-nums">{s.converted}</td><td className="px-3 py-3"><ProgressBar value={s.rate} showLabel label={`${s.source} conversion`} /></td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>
    </>
  )
}

/* ───────────── employee performance ───────────── */

export function EmployeeReportPage() {
  const { data, isLoading, error, refetch } = useEmployeeReport()
  if (isLoading) return <LoadingState />
  if (error || !data) return <ErrorState error={error} onRetry={refetch} />
  return (
    <>
      <PageHeader title="Employee performance" description="Counselor conversion and trainer outcomes." />
      <div className="space-y-4">
        {data.counselors.length > 0 && (
          <Card>
            <CardHeader title="Counselors" description="Lead handling and admissions" />
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-sm">
                <caption className="sr-only">Counselor performance</caption>
                <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3">Counselor</th><th className="px-3 py-3 text-right">Leads assigned</th><th className="px-3 py-3 text-right">Contacted</th><th className="px-3 py-3 text-right">Admissions</th><th className="w-48 px-3 py-3">Conversion rate</th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {data.counselors.map((c) => (
                    <tr key={c.id}><td className="px-5 py-3 font-medium text-slate-900">{c.name}</td><td className="px-3 py-3 text-right tabular-nums">{c.leadsAssigned}</td><td className="px-3 py-3 text-right tabular-nums">{c.leadsContacted}</td><td className="px-3 py-3 text-right tabular-nums">{c.admissions}</td><td className="px-3 py-3"><ProgressBar value={c.conversionRate} showLabel label={`${c.name} conversion`} /></td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
        {data.trainers.length > 0 && (
          <Card>
            <CardHeader title="Trainers" description="Students, attendance and course completion" />
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-sm">
                <caption className="sr-only">Trainer performance</caption>
                <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3">Trainer</th><th className="px-3 py-3 text-right">Students</th><th className="w-48 px-3 py-3">Avg. attendance</th><th className="w-48 px-3 py-3">Completion rate</th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {data.trainers.map((t) => (
                    <tr key={t.id}><td className="px-5 py-3 font-medium text-slate-900">{t.name}</td><td className="px-3 py-3 text-right tabular-nums">{t.students}</td><td className="px-3 py-3"><ProgressBar value={t.attendancePercent} showLabel label={`${t.name} attendance`} /></td><td className="px-3 py-3"><ProgressBar value={t.completionRate} showLabel label={`${t.name} completion`} /></td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>
    </>
  )
}
