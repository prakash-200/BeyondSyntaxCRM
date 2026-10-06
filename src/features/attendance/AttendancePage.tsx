import { CalendarPlus, CheckCheck, ClipboardEdit } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Can } from '@/components/common/Can'
import { PageHeader } from '@/components/common/PageHeader'
import { EmptyState, ErrorState, LoadingState } from '@/components/common/States'
import { StatusBadge } from '@/components/common/StatusBadge'
import { FormError, FormInput, FormSelect } from '@/components/forms/fields'
import { DataTable, type Column } from '@/components/tables/DataTable'
import { ListFilters } from '@/components/tables/FilterBar'
import { Button } from '@/components/ui/button'
import { Dialog, Drawer } from '@/components/ui/dialog'
import { ProgressBar } from '@/components/ui/misc'
import { Tabs } from '@/components/ui/tabs'
import { ATTENDANCE_STATUSES, type AttendanceStatus } from '@/constants/enums'
import { humanize } from '@/constants/labels'
import { useAuth } from '@/features/auth/AuthContext'
import { useBatches } from '@/features/batches/hooks'
import { useListState } from '@/hooks/useListState'
import type { AttendanceRosterRow, ClassSession } from '@/types'
import { cn } from '@/utils/cn'
import { today } from '@/utils/clock'
import { formatDate, formatPercent } from '@/utils/format'
import { useAttendanceSummary, useCreateSession, useSaveAttendance, useSession, useSessions } from './hooks'

const STATUS_STYLE: Record<AttendanceStatus, string> = {
  PRESENT: 'data-[on=true]:bg-emerald-600 data-[on=true]:text-white data-[on=true]:border-emerald-600',
  ABSENT: 'data-[on=true]:bg-red-600 data-[on=true]:text-white data-[on=true]:border-red-600',
  LATE: 'data-[on=true]:bg-amber-500 data-[on=true]:text-white data-[on=true]:border-amber-500',
  EXCUSED: 'data-[on=true]:bg-sky-600 data-[on=true]:text-white data-[on=true]:border-sky-600',
}

function AttendanceSheet({ sessionId, onClose }: { sessionId: string | null; onClose: () => void }) {
  const { data, isLoading, error, refetch } = useSession(sessionId)
  const save = useSaveAttendance()
  const { can } = useAuth()
  const [rows, setRows] = useState<AttendanceRosterRow[]>([])
  const editable = can('attendance:update')
  useEffect(() => {
    if (data) setRows(data.roster)
  }, [data])

  const counts = useMemo(() => Object.fromEntries(ATTENDANCE_STATUSES.map((s) => [s, rows.filter((r) => r.status === s).length])) as Record<AttendanceStatus, number>, [rows])
  const set = (studentId: string, status: AttendanceStatus) => setRows((r) => r.map((x) => (x.studentId === studentId ? { ...x, status } : x)))

  return (
    <Drawer
      open={!!sessionId}
      onClose={onClose}
      locked={save.isPending}
      width="max-w-2xl"
      title={data ? `${data.batchName} · ${formatDate(data.date)}` : 'Attendance'}
      description={data ? `${data.topic} · ${data.marked ? 'Attendance recorded' : 'Not yet marked'}` : undefined}
      footer={
        editable ? (
          <>
            <Button variant="outline" onClick={onClose} disabled={save.isPending}>
              Cancel
            </Button>
            <Button loading={save.isPending} disabled={!rows.length} onClick={() => save.mutate({ id: sessionId!, records: rows.map((r) => ({ studentId: r.studentId, status: r.status })) }, { onSuccess: onClose })}>
              Save attendance
            </Button>
          </>
        ) : undefined
      }
    >
      {isLoading ? (
        <LoadingState />
      ) : error || !data ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : (
        <div>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600" aria-live="polite">
              {ATTENDANCE_STATUSES.map((s) => (
                <span key={s}>
                  <span className="font-semibold tabular-nums text-slate-900">{counts[s]}</span> {humanize(s).toLowerCase()}
                </span>
              ))}
            </p>
            {editable && (
              <Button variant="outline" size="sm" onClick={() => setRows((r) => r.map((x) => ({ ...x, status: 'PRESENT' })))}>
                <CheckCheck className="h-4 w-4" aria-hidden /> Mark all present
              </Button>
            )}
          </div>
          {!data.marked && editable && <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">Everyone is pre-set to Present. Adjust exceptions, then save.</p>}
          {rows.length === 0 ? (
            <EmptyState title="No students in this batch" />
          ) : (
            <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
              {rows.map((r) => (
                <li key={r.studentId} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
                  <span className="text-sm font-medium text-slate-900">{r.studentName}</span>
                  {editable ? (
                    <div role="radiogroup" aria-label={`Attendance for ${r.studentName}`} className="flex gap-1">
                      {ATTENDANCE_STATUSES.map((s) => (
                        <button key={s} type="button" role="radio" aria-checked={r.status === s} data-on={r.status === s} onClick={() => set(r.studentId, s)} className={cn('rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 data-[on=true]:hover:opacity-90', STATUS_STYLE[s])}>
                          {humanize(s)}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <StatusBadge status={r.status} />
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Drawer>
  )
}

function NewSessionDialog({ open, onClose, batchId, onCreated }: { open: boolean; onClose: () => void; batchId: string; onCreated: (id: string) => void }) {
  const create = useCreateSession()
  const [date, setDate] = useState(today())
  const [topic, setTopic] = useState('')
  const [error, setError] = useState('')
  useEffect(() => {
    if (open) {
      setDate(today())
      setTopic('')
      setError('')
    }
  }, [open])
  return (
    <Dialog
      open={open}
      onClose={onClose}
      locked={create.isPending}
      size="sm"
      title="New class session"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            loading={create.isPending}
            onClick={async () => {
              if (!topic.trim()) return setError('Enter the topic covered')
              try {
                const s = await create.mutateAsync({ batchId, date, topic: topic.trim() })
                onClose()
                onCreated(s.id)
              } catch (e) {
                setError(e instanceof Error ? e.message : 'Failed')
              }
            }}
          >
            Create & mark
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <FormError message={error} />
        <FormInput label="Date" type="date" max={today()} value={date} onChange={(e) => setDate(e.target.value)} />
        <FormInput label="Topic" required placeholder="e.g. ASP.NET Core middleware" value={topic} onChange={(e) => setTopic(e.target.value)} />
      </div>
    </Dialog>
  )
}

export default function AttendancePage() {
  const [search, setSearch] = useSearchParams()
  const { can } = useAuth()
  const batchId = search.get('batchId') ?? ''
  const state = useListState({ sort: 'date', order: 'desc', pageSize: 10 })
  const [tab, setTab] = useState('register')
  const [open, setOpen] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const batches = useBatches({ pageSize: 100, sort: 'startDate', order: 'desc' })
  const batchOptions = (batches.data?.items ?? []).filter((b) => b.status === 'ACTIVE' || b.status === 'COMPLETED')
  const sessions = useSessions({ ...state.params, ...(batchId ? { batchId } : {}) })
  const summary = useAttendanceSummary(tab === 'summary' ? batchId : '')

  const columns: Column<ClassSession>[] = [
    { key: 'date', header: 'Date', sortKey: 'date', cell: (s) => <span className="whitespace-nowrap font-medium">{s.date === today() ? 'Today' : formatDate(s.date)}</span> },
    { key: 'batch', header: 'Batch', sortKey: 'batch', cell: (s) => <div>{s.batchName}<p className="text-xs text-slate-500">{s.trainerName}</p></div> },
    { key: 'topic', header: 'Topic', sortKey: 'topic', hideBelow: 'md', cell: (s) => s.topic },
    { key: 'att', header: 'Present', align: 'right', hideBelow: 'sm', cell: (s) => (s.marked ? `${s.presentCount} / ${s.totalCount}` : '—') },
    { key: 'status', header: 'Attendance', cell: (s) => (s.marked ? <StatusBadge status="COMPLETED" label="Marked" /> : <StatusBadge status="PENDING" label="Not marked" />) },
    { key: 'act', header: '', align: 'right', cell: (s) => <Button size="sm" variant={s.marked ? 'outline' : 'primary'} onClick={() => setOpen(s.id)}><ClipboardEdit className="h-3.5 w-3.5" aria-hidden />{s.marked ? (can('attendance:update') ? 'Edit' : 'View') : 'Mark'}</Button> },
  ]

  return (
    <>
      <PageHeader
        title="Attendance"
        description="Mark and review class attendance by batch."
        actions={
          <Can permission="attendance:create">
            <Button onClick={() => setCreating(true)} disabled={!batchId}>
              <CalendarPlus className="h-4 w-4" aria-hidden /> New session
            </Button>
          </Can>
        }
      />
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <FormSelect
          label="Batch"
          wrapperClassName="min-w-[260px]"
          value={batchId}
          placeholder="All batches"
          onChange={(e) => {
            setSearch(e.target.value ? { batchId: e.target.value } : {})
            state.setPage(1)
          }}
          options={batchOptions.map((b) => ({ value: b.id, label: b.name }))}
        />
        {!batchId && <p className="pb-2 text-xs text-slate-500">Select a batch to create sessions or view the summary.</p>}
      </div>
      <Tabs className="mb-4" label="Attendance views" value={tab} onChange={setTab} items={[{ value: 'register', label: 'Class register' }, { value: 'summary', label: 'Student summary', hidden: !batchId }]} />
      {tab === 'register' ? (
        <>
          <ListFilters state={state} searchPlaceholder="Search topic…" dateRange={{ label: 'Class date' }} selects={[{ key: 'marked', label: 'Marking', options: [{ value: 'false', label: 'Not marked' }, { value: 'true', label: 'Marked' }] }]} />
          <DataTable
            caption="Class sessions"
            columns={columns}
            rows={sessions.data?.items}
            rowKey={(s) => s.id}
            isLoading={sessions.isLoading}
            isFetching={sessions.isFetching}
            error={sessions.error}
            onRetry={sessions.refetch}
            sort={{ key: state.sort, order: state.order, onSort: state.toggleSort }}
            pagination={{ page: state.page, pageSize: state.pageSize, total: sessions.data?.total ?? 0, onPageChange: state.setPage, onPageSizeChange: state.setPageSize }}
            rowClassName={(s) => (!s.marked ? 'bg-amber-50/40' : undefined)}
            empty={{ title: 'No class sessions found' }}
          />
        </>
      ) : summary.isLoading ? (
        <LoadingState />
      ) : summary.error ? (
        <ErrorState error={summary.error} onRetry={summary.refetch} />
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full min-w-[560px] text-left text-sm">
            <caption className="sr-only">Attendance summary by student</caption>
            <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr><th className="px-5 py-3">Student</th><th className="px-3 py-3 text-right">Classes</th><th className="px-3 py-3 text-right">Present</th><th className="px-3 py-3 text-right">Late</th><th className="px-3 py-3 text-right">Absent</th><th className="w-48 px-3 py-3">Attendance</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {summary.data?.map((r) => (
                <tr key={r.studentId} className={r.percent < 75 ? 'bg-red-50/40' : undefined}>
                  <td className="px-5 py-3 font-medium text-slate-900">{r.studentName}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{r.totalClasses}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{r.present}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{r.late}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{r.absent}</td>
                  <td className="px-3 py-3"><div className="flex items-center gap-2"><ProgressBar value={r.percent} tone={r.percent < 75 ? 'danger' : 'success'} className="flex-1" label="Attendance" /><span className={cn('w-14 text-right text-xs font-semibold tabular-nums', r.percent < 75 && 'text-red-600')}>{formatPercent(r.percent)}</span></div></td>
                </tr>
              ))}
            </tbody>
          </table>
          {!summary.data?.length && <EmptyState title="No students in this batch" />}
        </div>
      )}
      <AttendanceSheet sessionId={open} onClose={() => setOpen(null)} />
      <NewSessionDialog open={creating} onClose={() => setCreating(false)} batchId={batchId} onCreated={setOpen} />
    </>
  )
}
