import { useState } from 'react'
import { LoadingState, EmptyState } from '@/components/common/States'
import { StatusBadge } from '@/components/common/StatusBadge'
import { SearchInput } from '@/components/tables/FilterBar'
import { Dialog } from '@/components/ui/dialog'
import { useStudentFeePlan, useStudents } from '@/features/students/hooks'
import { formatCurrency } from '@/utils/format'
import { RecordPaymentDialog } from './FinanceDialogs'

/**
 * Opens the "Record payment" dialog for any student. If no student is given
 * a picker is shown first. Returns the dialogs to render plus a `launch` fn.
 */
export function usePaymentLauncher() {
  const [state, setState] = useState<{ studentId?: string; installmentId?: string; picking?: boolean } | null>(null)
  const plan = useStudentFeePlan(state?.studentId ?? '', !!state?.studentId)

  const node = (
    <>
      <StudentPickerDialog open={!!state?.picking} onClose={() => setState(null)} onPick={(studentId) => setState({ studentId })} />
      <RecordPaymentDialog open={!!state?.studentId && !!plan.data} onClose={() => setState(null)} plan={plan.data ?? null} defaultInstallmentId={state?.installmentId} />
    </>
  )
  return {
    node,
    launch: (studentId?: string, installmentId?: string) => setState(studentId ? { studentId, installmentId } : { picking: true }),
    loadingPlan: plan.isLoading && !!state?.studentId,
  }
}

function StudentPickerDialog({ open, onClose, onPick }: { open: boolean; onClose: () => void; onPick: (studentId: string) => void }) {
  const [search, setSearch] = useState('')
  const { data, isFetching } = useStudents({ search, pageSize: 8, status: 'ACTIVE', sort: 'name', order: 'asc' })
  return (
    <Dialog open={open} onClose={onClose} size="md" title="Select student" description="Search by name, ID or phone number.">
      <SearchInput value={search} onChange={setSearch} placeholder="Type a student name…" className="max-w-none" />
      <div className="mt-3 min-h-40">
        {isFetching && !data ? (
          <LoadingState className="py-10" />
        ) : !data?.items.length ? (
          <EmptyState title="No students found" className="py-10" />
        ) : (
          <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
            {data.items.map((s) => (
              <li key={s.id}>
                <button type="button" onClick={() => onPick(s.id)} className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left hover:bg-slate-50">
                  <span>
                    <span className="block text-sm font-medium text-slate-900">{s.fullName}</span>
                    <span className="block text-xs text-slate-500">
                      {s.id} · {s.courseName}
                    </span>
                  </span>
                  <span className="flex items-center gap-2 text-xs">
                    {s.outstandingAmount ? <span className="font-medium text-amber-700">{formatCurrency(s.outstandingAmount)} due</span> : <StatusBadge status="PAID" />}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Dialog>
  )
}
