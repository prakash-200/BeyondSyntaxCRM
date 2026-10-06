import { AlertTriangle, Banknote, CalendarCheck, CalendarClock, ClipboardCheck, ClipboardList, Clock4, Layers, TrendingUp, UserCheck, UserPlus, Users, Wallet } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Can } from '@/components/common/Can'
import { KpiCard } from '@/components/common/KpiCard'
import { PageHeader } from '@/components/common/PageHeader'
import { EmptyState, ErrorState, LoadingState } from '@/components/common/States'
import { StatusBadge } from '@/components/common/StatusBadge'
import { DonutChart, FunnelChart, RevenueTrendChart, SimpleBarChart } from '@/components/charts/charts'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { ProgressBar } from '@/components/ui/misc'
import { ActivityTimeline } from '@/components/timeline/ActivityTimeline'
import { useAuth } from '@/features/auth/AuthContext'
import type { DashboardSummary, FollowUp } from '@/types'
import { formatCurrency, formatDate, formatNumber, formatPercent, formatTime } from '@/utils/format'
import { today } from '@/utils/clock'
import { humanize } from '@/constants/labels'
import { useDashboardSummary, useTrainerDashboard } from './hooks'

function FollowUpList({ items, empty, overdue }: { items: FollowUp[]; empty: string; overdue?: boolean }) {
  if (!items.length) return <EmptyState title={empty} className="py-8" />
  return (
    <ul className="divide-y divide-slate-100">
      {items.map((f) => (
        <li key={f.id}>
          <Link to={f.entityType === 'LEAD' ? `/leads/${f.entityId}` : `/students/${f.entityId}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-slate-50">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-slate-900">{f.entityName}</p>
              <p className="truncate text-xs text-slate-500">
                {f.courseName ?? '—'} · {humanize(f.type)} · {f.employeeName}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className={`text-xs font-medium ${overdue ? 'text-red-600' : 'text-slate-700'}`}>{f.date === today() ? 'Today' : formatDate(f.date)}</p>
              <p className="text-xs text-slate-500">{formatTime(f.time)}</p>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  )
}

function ChartCard({ title, description, children, height = 'h-64', action }: { title: string; description?: string; children: React.ReactNode; height?: string; action?: React.ReactNode }) {
  return (
    <Card>
      <CardHeader title={title} description={description} action={action} />
      <CardContent className={height}>{children}</CardContent>
    </Card>
  )
}

function PaymentStatusCard({ data }: { data: DashboardSummary['paymentStatus'] }) {
  const total = data.reduce((s, d) => s + d.count, 0) || 1
  return (
    <ul className="space-y-4">
      {data.map((d) => (
        <li key={d.status}>
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <StatusBadge status={d.status} />
            <span className="text-xs text-slate-600">
              <span className="font-semibold tabular-nums text-slate-900">{d.count}</span> students · {formatCurrency(d.amount)}
              {d.status === 'PAID' ? ' collected' : ' due'}
            </span>
          </div>
          <ProgressBar value={(d.count / total) * 100} tone={d.status === 'PAID' ? 'success' : d.status === 'OVERDUE' ? 'danger' : d.status === 'PENDING' ? 'warning' : 'brand'} />
        </li>
      ))}
    </ul>
  )
}

function SummaryDashboard() {
  const { can, user } = useAuth()
  const { data, isLoading, error, refetch } = useDashboardSummary()
  if (isLoading) return <LoadingState label="Loading dashboard…" />
  if (error || !data) return <ErrorState error={error} onRetry={refetch} />

  const k = data.kpis
  const finance = can('fees:view')
  const own = user?.role === 'COUNSELOR'
  const funnelTotal = data.funnel[0]?.count ?? 0

  return (
    <>
      {data.overdueFollowUps.length > 0 && can('followups:view') && (
        <div role="alert" className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 shrink-0 text-red-600" aria-hidden />
            <div>
              <p className="text-sm font-semibold text-red-800">
                {data.overdueFollowUps.length}+ overdue follow-up{data.overdueFollowUps.length > 1 ? 's' : ''}
              </p>
              <p className="text-xs text-red-700">
                Oldest: {data.overdueFollowUps[0].entityName} · due {formatDate(data.overdueFollowUps[0].date)}
              </p>
            </div>
          </div>
          <Link to="/follow-ups?tab=overdue" className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-red-700 ring-1 ring-red-200 hover:bg-red-100">
            Review overdue
          </Link>
        </div>
      )}
      {finance && data.overdueInstallments > 0 && (
        <div role="alert" className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <div className="flex items-center gap-3">
            <Clock4 className="h-5 w-5 shrink-0 text-amber-600" aria-hidden />
            <p className="text-sm font-semibold text-amber-900">{data.overdueInstallments} installments are overdue</p>
          </div>
          <Link to="/payments/pending?status=OVERDUE" className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-amber-800 ring-1 ring-amber-200 hover:bg-amber-100">
            View overdue payments
          </Link>
        </div>
      )}

      <section aria-label="Key metrics" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Can permission="leads:view">
          <KpiCard label={own ? 'My Leads' : 'Total Leads'} value={formatNumber(k.totalLeads.value)} change={k.totalLeads.change} hint="vs last month" icon={UserPlus} to="/leads" />
        </Can>
        <Can permission="students:view">
          <KpiCard label={own ? 'My Students' : 'Total Students'} value={formatNumber(k.totalStudents.value)} change={k.totalStudents.change} hint="vs last month" icon={Users} to="/students" accent="bg-sky-50 text-sky-600" />
          <KpiCard label="Active Students" value={formatNumber(k.activeStudents.value)} change={k.activeStudents.change} hint="vs prev. 30 days" icon={UserCheck} to="/students/active" accent="bg-emerald-50 text-emerald-600" />
        </Can>
        <Can permission="batches:view">
          <KpiCard label="Active Batches" value={formatNumber(k.activeBatches.value)} icon={Layers} to="/batches" accent="bg-purple-50 text-purple-600" />
        </Can>
        <Can permission="applications:view">
          <KpiCard label="New Applications" value={formatNumber(k.newApplications.value)} change={k.newApplications.change} hint="this month" icon={ClipboardList} to="/applications" accent="bg-amber-50 text-amber-600" />
        </Can>
        {finance && (
          <>
            <KpiCard label="Pending Payments" value={formatNumber(k.pendingPayments.value)} hint={`${data.overdueInstallments} overdue`} icon={Clock4} to="/payments/pending" accent="bg-orange-50 text-orange-600" />
            <KpiCard label="Monthly Revenue" value={formatCurrency(k.monthlyRevenue.value)} change={k.monthlyRevenue.change} hint="vs same days last month" icon={Banknote} to="/payments" accent="bg-emerald-50 text-emerald-600" />
            <KpiCard label="Outstanding Fees" value={formatCurrency(k.outstandingFees.value)} change={k.outstandingFees.change} invertTrend hint="vs 30 days ago" icon={Wallet} to="/fees" accent="bg-red-50 text-red-600" />
          </>
        )}
        <Can permission="leads:view">
          <KpiCard label="Lead Conversion" value={formatPercent(k.conversionRate)} hint="converted / total leads" icon={TrendingUp} accent="bg-indigo-50 text-indigo-600" />
        </Can>
      </section>

      {finance && (
        <section aria-label="Revenue" className="mt-6 grid gap-4 xl:grid-cols-3">
          <div className="xl:col-span-2">
            <ChartCard title="Revenue trend" description="Cumulative collections — this month vs previous month">
              <RevenueTrendChart data={data.revenueTrend} />
            </ChartCard>
          </div>
          <ChartCard title="Monthly revenue" description="Last 6 months">
            <SimpleBarChart data={data.monthlyRevenue} xKey="month" bars={[{ key: 'revenue', name: 'Revenue' }]} currency />
          </ChartCard>
        </section>
      )}

      <section aria-label="Pipeline" className="mt-6 grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <Can permission="leads:view">
          <ChartCard title="Lead conversion funnel" description={`${formatNumber(funnelTotal)} leads in pipeline`} height="min-h-64 h-auto">
            <FunnelChart stages={data.funnel} />
          </ChartCard>
        </Can>
        <Can permission="students:view">
          <ChartCard title="Course distribution" description="Enrolled students by programme">
            <DonutChart data={data.courseDistribution} centerLabel="students" />
          </ChartCard>
        </Can>
        {finance && (
          <ChartCard title="Payment status" description="Students by fee status" height="h-auto min-h-64">
            <PaymentStatusCard data={data.paymentStatus} />
          </ChartCard>
        )}
      </section>

      <section aria-label="Work queue" className="mt-6 grid gap-4 xl:grid-cols-5">
        <Can permission="followups:view">
          <Card className="xl:col-span-3">
            <CardHeader
              title="Upcoming follow-ups"
              description="Next scheduled calls, meetings and counselling sessions"
              action={
                <Link to="/follow-ups" className="text-xs font-medium text-brand-700 hover:underline">
                  View all
                </Link>
              }
            />
            <FollowUpList items={data.upcomingFollowUps} empty="No upcoming follow-ups" />
            {data.overdueFollowUps.length > 0 && (
              <>
                <div className="border-y border-red-100 bg-red-50/60 px-5 py-2 text-xs font-semibold uppercase tracking-wide text-red-700">Overdue</div>
                <FollowUpList items={data.overdueFollowUps} empty="" overdue />
              </>
            )}
          </Card>
        </Can>
        <Card className="xl:col-span-2">
          <CardHeader title="Recent activity" description="Latest actions across the system" />
          <CardContent>
            <ActivityTimeline items={data.recentActivity} compact />
          </CardContent>
        </Card>
      </section>
    </>
  )
}

function TrainerDashboardView() {
  const { data, isLoading, error, refetch } = useTrainerDashboard()
  if (isLoading) return <LoadingState label="Loading your classes…" />
  if (error || !data) return <ErrorState error={error} onRetry={refetch} />
  return (
    <>
      <section aria-label="Key metrics" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="My Batches" value={data.myBatches.length} icon={Layers} to="/batches" />
        <KpiCard label="My Students" value={data.myStudents} icon={Users} to="/students" accent="bg-sky-50 text-sky-600" />
        <KpiCard label="Attendance (avg)" value={formatPercent(data.attendanceAverage)} icon={CalendarCheck} to="/attendance" accent="bg-emerald-50 text-emerald-600" />
        <KpiCard label="Assignments to review" value={data.pendingReviews} icon={ClipboardCheck} to="/assignments" accent="bg-amber-50 text-amber-600" />
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Today’s classes" description={formatDate(today())} />
          {data.todaysClasses.length === 0 ? (
            <EmptyState title="No classes scheduled today" className="py-8" />
          ) : (
            <ul className="divide-y divide-slate-100">
              {data.todaysClasses.map((c) => (
                <li key={c.batchId} className="flex items-center justify-between gap-3 px-5 py-3.5">
                  <div className="min-w-0">
                    <Link to={`/batches/${c.batchId}`} className="truncate text-sm font-medium text-slate-900 hover:text-brand-700">
                      {c.batchName}
                    </Link>
                    <p className="text-xs text-slate-500">
                      {c.courseName} · {formatTime(c.startTime)} – {formatTime(c.endTime)}
                    </p>
                  </div>
                  {c.marked ? (
                    <StatusBadge status="COMPLETED" label="Attendance marked" />
                  ) : (
                    <Link to={`/attendance?batchId=${c.batchId}`} className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700">
                      Mark attendance
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <CardHeader title="My batches" description="Active and upcoming" />
          <ul className="divide-y divide-slate-100">
            {data.myBatches.map((b) => (
              <li key={b.id}>
                <Link to={`/batches/${b.id}`} className="block px-5 py-3 hover:bg-slate-50">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-slate-900">{b.name}</p>
                    <StatusBadge status={b.status} />
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {b.currentStudentCount}/{b.capacity} students · {b.days.map((d) => humanize(d)).join(', ')} · {formatTime(b.startTime)}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <CardHeader title="Attention needed" description="Students below the attendance threshold" />
          {data.lowAttendance.length === 0 ? (
            <EmptyState title="Everyone is on track" className="py-8" />
          ) : (
            <ul className="divide-y divide-slate-100">
              {data.lowAttendance.map((s) => (
                <li key={s.studentId}>
                  <Link to={`/students/${s.studentId}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-slate-50">
                    <div>
                      <p className="text-sm font-medium text-slate-900">{s.studentName}</p>
                      <p className="text-xs text-slate-500">{s.batchName}</p>
                    </div>
                    <span className="text-sm font-semibold tabular-nums text-red-600">{formatPercent(s.percent)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <CardHeader title="Average student progress" description="Across all your students" />
          <CardContent>
            <p className="text-3xl font-semibold tabular-nums">{formatPercent(data.progressAverage)}</p>
            <ProgressBar value={data.progressAverage} className="mt-3" />
            <Link to="/progress" className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:underline">
              <CalendarClock className="h-4 w-4" aria-hidden /> Update module progress
            </Link>
          </CardContent>
        </Card>
      </section>
    </>
  )
}

export default function DashboardPage() {
  const { user } = useAuth()
  const trainer = user?.role === 'TRAINER'
  return (
    <>
      <PageHeader title={`Welcome back, ${user?.name.split(' ')[0] ?? ''}`} description={trainer ? 'Your classes, students and assignments at a glance.' : 'Here’s what is happening across the institute today.'} />
      {trainer ? <TrainerDashboardView /> : <SummaryDashboard />}
    </>
  )
}

