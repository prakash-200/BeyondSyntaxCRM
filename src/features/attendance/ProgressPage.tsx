import { useEffect, useState } from 'react'
import { PageHeader } from '@/components/common/PageHeader'
import { EmptyState, ErrorState, LoadingState } from '@/components/common/States'
import { FormSelect } from '@/components/forms/fields'
import { Button } from '@/components/ui/button'
import { Drawer } from '@/components/ui/dialog'
import { ProgressBar } from '@/components/ui/misc'
import { useAuth } from '@/features/auth/AuthContext'
import { useBatchProgress, useBatches } from '@/features/batches/hooks'
import { ProgressTab } from '@/features/students/ProgressTab'
import { cn } from '@/utils/cn'
import { formatPercent } from '@/utils/format'

export default function ProgressPage() {
  const { can } = useAuth()
  const batches = useBatches({ pageSize: 100, sort: 'startDate', order: 'desc' })
  const options = (batches.data?.items ?? []).filter((b) => b.status === 'ACTIVE' || b.status === 'COMPLETED')
  const [batchId, setBatchId] = useState('')
  const [student, setStudent] = useState<{ id: string; name: string } | null>(null)
  useEffect(() => {
    if (!batchId && options.length) setBatchId(options.find((b) => b.status === 'ACTIVE')?.id ?? options[0].id)
  }, [options, batchId])
  const progress = useBatchProgress(batchId, !!batchId)

  return (
    <>
      <PageHeader title="Student progress" description="Module-by-module completion for every student in a batch. Overall progress is the average across modules." />
      <FormSelect label="Batch" wrapperClassName="mb-4 max-w-xs" value={batchId} onChange={(e) => setBatchId(e.target.value)} options={options.map((b) => ({ value: b.id, label: b.name }))} />
      {!batchId ? (
        <EmptyState title="Select a batch" />
      ) : progress.isLoading ? (
        <LoadingState />
      ) : progress.error || !progress.data ? (
        <ErrorState error={progress.error} onRetry={progress.refetch} />
      ) : !progress.data.rows.length ? (
        <EmptyState title="No students in this batch" />
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <caption className="sr-only">Module progress</caption>
              <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="sticky left-0 bg-slate-50 px-5 py-3">Student</th>
                  {progress.data.modules.map((m) => (
                    <th key={m.id} className="max-w-[88px] px-2 py-3 text-center" title={m.name}>
                      <span className="block truncate">{m.name}</span>
                    </th>
                  ))}
                  <th className="w-40 px-3 py-3">Overall</th>
                  <th className="px-3 py-3"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {progress.data.rows.map((r) => (
                  <tr key={r.studentId}>
                    <td className="sticky left-0 bg-white px-5 py-2.5 font-medium text-slate-900">{r.studentName}</td>
                    {progress.data!.modules.map((m) => {
                      const v = r.modules[m.id] ?? 0
                      return (
                        <td key={m.id} className="px-2 py-2.5 text-center">
                          <span className={cn('inline-block min-w-10 rounded-md px-1.5 py-0.5 text-xs font-medium tabular-nums', v === 100 ? 'bg-emerald-50 text-emerald-700' : v > 0 ? 'bg-brand-50 text-brand-700' : 'bg-slate-50 text-slate-400')}>{v}%</span>
                        </td>
                      )
                    })}
                    <td className="px-3 py-2.5"><div className="flex items-center gap-2"><ProgressBar value={r.overallPercent} className="flex-1" label="Overall" /><span className="w-12 text-right text-xs font-semibold tabular-nums">{formatPercent(r.overallPercent)}</span></div></td>
                    <td className="px-3 py-2.5 text-right"><Button size="sm" variant="outline" onClick={() => setStudent({ id: r.studentId, name: r.studentName })}>{can('progress:update') ? 'Update' : 'View'}</Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <Drawer open={!!student} onClose={() => setStudent(null)} title={student?.name ?? ''} description="Module progress" width="max-w-xl">
        {student && <ProgressTab studentId={student.id} editable={can('progress:update')} />}
      </Drawer>
    </>
  )
}
