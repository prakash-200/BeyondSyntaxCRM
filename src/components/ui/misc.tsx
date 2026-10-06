import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/utils/cn'
import { initials } from '@/utils/format'

export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('animate-pulse rounded-md bg-slate-200/80', className)} {...props} />
}

export function Avatar({ name, color = '#4f46e5', size = 'md', className }: { name: string; color?: string; size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const dims = { sm: 'h-7 w-7 text-[11px]', md: 'h-9 w-9 text-xs', lg: 'h-14 w-14 text-lg' }[size]
  return (
    <span aria-hidden className={cn('inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white', dims, className)} style={{ backgroundColor: color }}>
      {initials(name)}
    </span>
  )
}

const BAR_TONES = {
  brand: 'bg-brand-600',
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  danger: 'bg-red-500',
}

export function ProgressBar({ value, tone, className, showLabel = false, label }: { value: number; tone?: keyof typeof BAR_TONES; className?: string; showLabel?: boolean; label?: string }) {
  const v = Math.max(0, Math.min(100, value))
  const color = tone ?? (v >= 80 ? 'success' : v >= 40 ? 'brand' : 'warning')
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div role="progressbar" aria-valuenow={Math.round(v)} aria-valuemin={0} aria-valuemax={100} aria-label={label ?? 'Progress'} className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
        <div className={cn('h-full rounded-full transition-all', BAR_TONES[color])} style={{ width: `${v}%` }} />
      </div>
      {showLabel && <span className="w-10 text-right text-xs font-medium tabular-nums text-slate-600">{Math.round(v)}%</span>}
    </div>
  )
}

export function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn('relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors disabled:opacity-50', checked ? 'bg-brand-600' : 'bg-slate-300')}
    >
      <span className={cn('inline-block h-4 w-4 rounded-full bg-white shadow transition-transform', checked ? 'translate-x-4.5' : 'translate-x-0.5')} />
    </button>
  )
}

export function DescriptionList({ items, columns = 2, className }: { items: { label: string; value: ReactNode }[]; columns?: 1 | 2 | 3; className?: string }) {
  return (
    <dl className={cn('grid gap-x-8 gap-y-4', columns === 1 && 'grid-cols-1', columns === 2 && 'grid-cols-1 sm:grid-cols-2', columns === 3 && 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3', className)}>
      {items.map((it) => (
        <div key={it.label} className="min-w-0">
          <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{it.label}</dt>
          <dd className="mt-1 break-words text-sm text-slate-900">{it.value ?? '—'}</dd>
        </div>
      ))}
    </dl>
  )
}
