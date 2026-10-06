import { ArrowRightLeft, Pencil, UserMinus, UserPlus } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Can } from '@/components/common/Can'
import { useConfirm } from '@/components/common/ConfirmDialog'
import { PageHeader } from '@/components/common/PageHeader'
import { EmptyState, ErrorState, LoadingState } from '@/components/common/States'
import { StatusBadge } from '@/components/common/StatusBadge'
import { ActivityTimeline } from '@/components/timeline/ActivityTimeline'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { DescriptionList, ProgressBar } from '@/components/ui/misc'
import { Tabs, TabPanel } from '@/components/ui/tabs'
import { humanize } from '@/constants/labels'
import { useAuth } from '@/features/auth/AuthContext'
import { cn } from '@/utils/cn'
import { formatDate, formatPercent } from '@/utils/format'
import { AssignStudentDialog, BatchFormDialog, TransferStudentDialog } from './BatchDialogs'
import { scheduleText } from './BatchesPage'
import { useBatch, useBatchActivity, useBatchProgress, useBatchSessions, useBatchStudents, useRemoveStudent } from './hooks'

export default function BatchDetailPage() {
  const { id = '' } = useParams()
  const { can } = useAuth()
  const { data: batch, isLoading, error, refetch } = useBatch(id)
  const students = useBatchStudents(id)
  const sessions = useBatchSessions(id)
  const progress = useBatchProgress(id, can(['progress:view', 'batches:view']))
  const activity = useBatchActivity(id)
  const remove = useRemoveStudent()
  const confirm = useConfirm()
  const [tab, setTab] = useState('overview')
  const [edit, setEdit] = useState(false)
  const [assign, setAssign] = useState(false)
  const [transfer, setTransfer] = useState<{ id: string; name: string } | null>(null)

  if (isLoading) return <LoadingState label="Loading batch…" />
  if (error || !batch) return <ErrorState error={error} title="Unable to load batch" onRetry={refetch} />
  const closed = batch.status === 'COMPLETED' || batch.status === 'CANCELLED'
  const full = batch.currentStudentCount >= batch.capacity

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: 'Batches', to: '/batches' }, { label: batch.name }]}
        title={
          <span className="flex flex-wrap items-center gap-3">
            {batch.name}
            <StatusBadge status={batch.status} />
          </span>
        }
        description={`${batch.courseName} · Trainer: ${batch.trainerName}`}
        actions={
          <Can permission="batches:update">
            <Button variant="outline" onClick={() => setEdit(true)}>
              <Pencil className="h-4 w-4" aria-hidden /> Edit
            </Button>
            <Button onClick={() => setAssign(true)} disabled={closed || full} title={closed ? `Batch is ${batch.status.toLowerCase()}` : full ? 'Batch is full' : undefined}>
              <UserPlus className="h-4 w-4" aria-hidden /> Assign student
            </Button>
          </Can>
        }
      />
      <Tabs
        value={tab}
        onChange={setTab}
        label="Batch sections"
        items={[
          { value: 'overview', label: 'Overview' },
          { value: 'students', label: 'Students', count: batch.currentStudentCount },
          { value: 'schedule', label: 'Schedule' },
          { value: 'attendance', label: 'Attendance', hidden: !can('attendance:view') },
          { value: 'progress', label: 'Progress', hidden: !can(['progress:view', 'batches:view']) },
          { value: 'activity', label: 'Activity' },
        ]}
      />
      <div className="mt-5">
        <TabPanel value="overview" active={tab}>
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader title="Batch details" />
              <CardContent>
                <DescriptionList
                  items={[
                    { label: 'Batch ID', value: batch.id },
                    { label: 'Course', value: batch.courseName },
                    { label: 'Trainer', value: batch.trainerName },
                    { label: 'Mode', value: humanize(batch.mode) },
                    { label: 'Start date', value: formatDate(batch.startDate) },
                    { label: 'End date', value: formatDate(batch.endDate) },
                    { label: 'Schedule', value: scheduleText(batch) },
                    { label: 'Location', value: batch.location || '—' },
                  ]}
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader title="Capacity" />
              <CardContent>
                <p className="text-3xl font-semibold tabular-nums">
                  {batch.currentStudentCount}
                  <span className="text-lg font-normal text-slate-400"> / {batch.capacity}</span>
                </p>
                <ProgressBar value={(batch.currentStudentCount / batch.capacity) * 100} tone={full ? 'danger' : 'brand'} className="mt-3" label="Seats filled" />
                <p className="mt-2 text-xs text-slate-500">{full ? 'Batch is full.' : `${batch.capacity - batch.currentStudentCount} seats available.`}</p>
              </CardContent>
            </Card>
          </div>
        </TabPanel>

        <TabPanel value="students" active={tab}>
          <Card>
            {students.isLoading ? (
              <LoadingState className="py-8" />
            ) : students.error ? (
              <ErrorState error={students.error} onRetry={students.refetch} />
            ) : !students.data?.length ? (
              <EmptyState title="No students in this batch" description={closed ? undefined : 'Assign active students of this course.'} />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-left text-sm">
                  <caption className="sr-only">Students in {batch.name}</caption>
                  <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-5 py-3">Student</th>
                      <th className="px-3 py-3">Status</th>
                      <th className="px-3 py-3">Attendance</th>
                      <th className="px-3 py-3">Progress</th>
                      <th className="px-3 py-3">Joined</th>
                      <th className="px-3 py-3"><span className="sr-only">Actions</span></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {students.data.map((s) => (
                      <tr key={s.id}>
                        <td className="px-5 py-3">
                          <Link to={`/students/${s.studentId}`} className="font-medium text-slate-900 hover:text-brand-700">
                            {s.studentName}
                          </Link>
                          <p className="text-xs text-slate-500">{s.studentId}</p>
                        </td>
                        <td className="px-3 py-3"><StatusBadge status={s.studentStatus} /></td>
                        <td className={cn('px-3 py-3 tabular-nums', (s.attendancePercent ?? 100) < 75 && 'font-medium text-red-600')}>{formatPercent(s.attendancePercent ?? 0)}</td>
                        <td className="w-40 px-3 py-3"><ProgressBar value={s.progressPercent ?? 0} showLabel label="Progress" /></td>
                        <td className="px-3 py-3 text-slate-600">{formatDate(s.joinedAt)}</td>
                        <td className="px-3 py-3 text-right">
                          <Can permission="batches:update">
                            {!closed && (
                              <div className="flex justify-end gap-1">
                                <Button size="sm" variant="ghost" onClick={() => setTransfer({ id: s.studentId, name: s.studentName ?? '' })}>
                                  <ArrowRightLeft className="h-3.5 w-3.5" aria-hidden /> Transfer
                                </Button>
                                <Button size="sm" variant="ghost" className="text-red-600" onClick={() => confirm({ title: `Remove ${s.studentName}?`, description: `${s.studentName} will be removed from ${batch.name}.`, reason: { required: true, label: 'Reason for removal' }, tone: 'danger', confirmLabel: 'Remove student', run: (reason) => remove.mutateAsync({ id, studentId: s.studentId, reason }) })}>
                                  <UserMinus className="h-3.5 w-3.5" aria-hidden /> Remove
                                </Button>
                              </div>
                            )}
                          </Can>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </TabPanel>

        <TabPanel value="schedule" active={tab}>
          <Card>
            <CardHeader title="Weekly schedule" description={scheduleText(batch)} />
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {(['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'] as const).map((d) => (
                  <span key={d} className={cn('rounded-lg px-4 py-2 text-sm font-medium', batch.days.includes(d) ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-400')}>
                    {humanize(d)}
                  </span>
                ))}
              </div>
              <p className="mt-4 text-sm text-slate-600">
                Runs {formatDate(batch.startDate)} to {formatDate(batch.endDate)} at {batch.location || 'location to be announced'}.
              </p>
            </CardContent>
          </Card>
        </TabPanel>

        <TabPanel value="attendance" active={tab}>
          <Card>
            <CardHeader title="Recent classes" action={<Can permission="attendance:update"><Link to={`/attendance?batchId=${id}`} className="text-sm font-medium text-brand-700 hover:underline">Open attendance register</Link></Can>} />
            {sessions.isLoading ? (
              <LoadingState className="py-8" />
            ) : !sessions.data?.length ? (
              <EmptyState title="No classes recorded yet" />
            ) : (
              <ul className="divide-y divide-slate-100">
                {sessions.data.slice(0, 15).map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-3 px-5 py-3">
                    <div>
                      <p className="text-sm font-medium text-slate-900">{formatDate(s.date)} · {s.topic}</p>
                      <p className="text-xs text-slate-500">{s.marked ? `${s.presentCount}/${s.totalCount} present` : 'Attendance not marked'}</p>
                    </div>
                    {s.marked ? <StatusBadge status="COMPLETED" label="Marked" /> : <StatusBadge status="PENDING" label="Not marked" />}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </TabPanel>

        <TabPanel value="progress" active={tab}>
          <Card>
            {progress.isLoading ? (
              <LoadingState className="py-8" />
            ) : !progress.data?.rows.length ? (
              <EmptyState title="No students to show" />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <caption className="sr-only">Module progress by student</caption>
                  <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="sticky left-0 bg-slate-50 px-5 py-3">Student</th>
                      {progress.data.modules.map((m) => (
                        <th key={m.id} className="px-3 py-3 text-center" title={m.name}>{m.sequence}</th>
                      ))}
                      <th className="px-3 py-3 text-right">Overall</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {progress.data.rows.map((r) => (
                      <tr key={r.studentId}>
                        <td className="sticky left-0 bg-white px-5 py-2.5 font-medium text-slate-900">{r.studentName}</td>
                        {progress.data!.modules.map((m) => {
                          const v = r.modules[m.id] ?? 0
                          return (
                            <td key={m.id} className={cn('px-3 py-2.5 text-center text-xs tabular-nums', v === 100 ? 'text-emerald-700' : v > 0 ? 'text-slate-700' : 'text-slate-300')}>
                              {v === 100 ? '✓' : `${v}%`}
                            </td>
                          )
                        })}
                        <td className="px-3 py-2.5 text-right font-semibold tabular-nums">{formatPercent(r.overallPercent)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {progress.data && <p className="border-t border-slate-100 px-5 py-3 text-xs text-slate-500">Columns: {progress.data.modules.map((m) => `${m.sequence}. ${m.name}`).join(' · ')}</p>}
          </Card>
        </TabPanel>

        <TabPanel value="activity" active={tab}>
          <Card>
            <CardContent>
              <ActivityTimeline items={activity.data} isLoading={activity.isLoading} error={activity.error} onRetry={activity.refetch} />
            </CardContent>
          </Card>
        </TabPanel>
      </div>

      <BatchFormDialog open={edit} batch={batch} onClose={() => setEdit(false)} />
      <AssignStudentDialog batch={batch} open={assign} onClose={() => setAssign(false)} />
      <TransferStudentDialog batch={batch} student={transfer} onClose={() => setTransfer(null)} />
    </>
  )
}
