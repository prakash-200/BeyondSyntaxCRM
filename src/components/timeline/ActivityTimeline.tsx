import { ArrowRight } from 'lucide-react'
import { ErrorState, EmptyState, LoadingState } from '@/components/common/States'
import type { AuditLog } from '@/types'
import { cn } from '@/utils/cn'
import { formatShortDateTime } from '@/utils/format'

const DOT: Partial<Record<AuditLog['entityType'], string>> = {
  PAYMENT: 'bg-emerald-500',
  REFUND: 'bg-purple-500',
  FEE_PLAN: 'bg-emerald-500',
  BATCH: 'bg-sky-500',
  APPLICATION: 'bg-brand-500',
  STUDENT: 'bg-brand-500',
  CERTIFICATE: 'bg-amber-500',
  LEAD: 'bg-slate-400',
}

/** Reusable audit-backed timeline (student, lead, application, payment, batch…). */
export function ActivityTimeline({ items, isLoading, error, onRetry, emptyText = 'No activity recorded yet.', compact }: { items?: AuditLog[]; isLoading?: boolean; error?: unknown; onRetry?: () => void; emptyText?: string; compact?: boolean }) {
  if (isLoading) return <LoadingState label="Loading activity…" className="py-8" />
  if (error) return <ErrorState error={error} title="Unable to load activity" onRetry={onRetry} className="py-8" />
  if (!items?.length) return <EmptyState title={emptyText} className="py-8" />
  return (
    <ol className="relative ml-2 border-l border-slate-200" aria-label="Activity timeline">
      {items.map((log) => (
        <li key={log.id} className={cn('relative pl-6', compact ? 'pb-4' : 'pb-6', 'last:pb-0')}>
          <span className={cn('absolute -left-[5px] top-1.5 h-2.5 w-2.5 rounded-full ring-4 ring-white', DOT[log.entityType] ?? 'bg-slate-400')} aria-hidden />
          <time dateTime={log.timestamp} className="text-xs font-medium tabular-nums text-slate-500">
            {formatShortDateTime(log.timestamp)}
          </time>
          <p className="mt-0.5 text-sm font-medium text-slate-900">{log.description}</p>
          <p className="text-xs text-slate-500">by {log.userName}</p>
          {(log.previousValue || log.newValue) && (
            <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-slate-600">
              {log.previousValue && <span className="rounded bg-slate-100 px-1.5 py-0.5">{log.previousValue}</span>}
              {log.previousValue && log.newValue && <ArrowRight className="h-3 w-3 text-slate-400" aria-label="changed to" />}
              {log.newValue && <span className="rounded bg-brand-50 px-1.5 py-0.5 text-brand-700">{log.newValue}</span>}
            </p>
          )}
          {log.reason && <p className="mt-1 text-xs italic text-slate-500">Reason: {log.reason}</p>}
        </li>
      ))}
    </ol>
  )
}
