import { CheckCircle2 } from 'lucide-react'
import { useState } from 'react'
import { ErrorState, LoadingState } from '@/components/common/States'
import { Button } from '@/components/ui/button'
import { Card, CardHeader } from '@/components/ui/card'
import { ProgressBar } from '@/components/ui/misc'
import { formatPercent } from '@/utils/format'
import { useStudentProgress, useUpdateProgress } from './hooks'


export function ProgressTab({ studentId, editable }: { studentId: string; editable: boolean }) {
  const { data, isLoading, error, refetch } = useStudentProgress(studentId)
  const update = useUpdateProgress()
  const [draft, setDraft] = useState<Record<string, number>>({})
  if (isLoading) return <LoadingState />
  if (error || !data) return <ErrorState error={error} onRetry={refetch} />
  return (
    <Card>
      <CardHeader title="Module progress" description={`Overall ${formatPercent(data.overallPercent)}`} />
      <div className="space-y-1 p-5">
        <ProgressBar value={data.overallPercent} showLabel label="Overall progress" className="mb-5" />
        <ul className="space-y-4">
          {data.modules.map((m) => {
            const value = draft[m.moduleId] ?? m.percent
            const dirty = draft[m.moduleId] !== undefined && draft[m.moduleId] !== m.percent
            return (
              <li key={m.moduleId}>
                <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
                  <span className="font-medium text-slate-800">
                    {String(m.sequence).padStart(2, '0')} · {m.name} {m.percent === 100 && <CheckCircle2 className="ml-1 inline h-4 w-4 text-emerald-600" aria-label="Completed" />}
                  </span>
                  <span className="tabular-nums text-slate-600">{value}%</span>
                </div>
                {editable ? (
                  <div className="flex items-center gap-3">
                    <input type="range" min={0} max={100} step={5} value={value} aria-label={`${m.name} progress`} onChange={(e) => setDraft((d) => ({ ...d, [m.moduleId]: Number(e.target.value) }))} className="h-2 flex-1 accent-brand-600" />
                    <Button
                      size="sm"
                      variant={dirty ? 'primary' : 'outline'}
                      disabled={!dirty}
                      loading={update.isPending && update.variables?.moduleId === m.moduleId}
                      onClick={() => update.mutate({ id: studentId, moduleId: m.moduleId, percent: value }, { onSuccess: () => setDraft((d) => { const n = { ...d }; delete n[m.moduleId]; return n }) })}
                    >
                      Save
                    </Button>
                  </div>
                ) : (
                  <ProgressBar value={value} label={`${m.name} progress`} />
                )}
              </li>
            )
          })}
        </ul>
      </div>
    </Card>
  )
}

