import { ArrowDownRight, ArrowUpRight, Minus, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { cn } from '@/utils/cn'
import { formatChange } from '@/utils/format'

interface KpiCardProps {
  label: string
  value: ReactNode
  icon?: LucideIcon
  /** Percent change; omit/null to hide. */
  change?: number | null
  /** When true a decrease is good (e.g. outstanding fees). */
  invertTrend?: boolean
  hint?: ReactNode
  to?: string
  accent?: string
}

export function KpiCard({ label, value, icon: Icon, change, invertTrend, hint, to, accent = 'bg-brand-50 text-brand-600' }: KpiCardProps) {
  const hasChange = change !== undefined && change !== null && change !== 0
  const up = (change ?? 0) > 0
  const good = invertTrend ? !up : up
  const body = (
    <div className="flex h-full items-start justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-xs transition-shadow hover:shadow-sm">
      <div className="min-w-0">
        <p className="truncate text-xs font-medium text-slate-500">{label}</p>
        <p className="mt-1.5 truncate text-2xl font-semibold tracking-tight text-slate-900 tabular-nums">{value}</p>
        <div className="mt-1.5 flex min-h-5 items-center gap-1.5 text-xs">
          {hasChange ? (
            <span className={cn('inline-flex items-center gap-0.5 font-medium', good ? 'text-emerald-600' : 'text-red-600')}>
              {up ? <ArrowUpRight className="h-3.5 w-3.5" aria-hidden /> : <ArrowDownRight className="h-3.5 w-3.5" aria-hidden />}
              {formatChange(change!)}
              <span className="sr-only">{good ? ' (favourable)' : ' (unfavourable)'}</span>
            </span>
          ) : change === 0 ? (
            <span className="inline-flex items-center gap-0.5 text-slate-400">
              <Minus className="h-3.5 w-3.5" aria-hidden /> no change
            </span>
          ) : null}
          {hint && <span className="text-slate-500">{hint}</span>}
        </div>
      </div>
      {Icon && (
        <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', accent)}>
          <Icon className="h-[18px] w-[18px]" aria-hidden />
        </span>
      )}
    </div>
  )
  return to ? (
    <Link to={to} className="block h-full rounded-xl focus-visible:outline-2">
      {body}
    </Link>
  ) : (
    body
  )
}
