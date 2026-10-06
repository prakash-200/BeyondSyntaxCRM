import { AlertCircle, CheckCircle2, CircleDot, Clock, Info, Sparkles, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { humanize, toneFor, type Tone } from '@/constants/labels'
import { cn } from '@/utils/cn'

const TONE_CLASSES: Record<Tone, string> = {
  success: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  warning: 'bg-amber-50 text-amber-800 ring-amber-600/25',
  danger: 'bg-red-50 text-red-700 ring-red-600/20',
  info: 'bg-sky-50 text-sky-700 ring-sky-600/20',
  neutral: 'bg-slate-100 text-slate-700 ring-slate-500/20',
  brand: 'bg-brand-50 text-brand-700 ring-brand-600/20',
  purple: 'bg-purple-50 text-purple-700 ring-purple-600/20',
}

// Icons make the status readable without relying on colour alone.
const TONE_ICONS: Record<Tone, LucideIcon> = {
  success: CheckCircle2,
  warning: Clock,
  danger: AlertCircle,
  info: Info,
  neutral: CircleDot,
  brand: Sparkles,
  purple: CircleDot,
}

export function Badge({ tone = 'neutral', children, className, icon = true }: { tone?: Tone; children: ReactNode; className?: string; icon?: boolean }) {
  const Icon = TONE_ICONS[tone]
  return (
    <span className={cn('inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset', TONE_CLASSES[tone], className)}>
      {icon && <Icon className="h-3 w-3" aria-hidden />}
      {children}
    </span>
  )
}

/** Single place that decides how every status code in the system looks. */
export function StatusBadge({ status, label, className }: { status: string | null | undefined; label?: string; className?: string }) {
  if (!status) return <span className="text-slate-400">—</span>
  return (
    <Badge tone={toneFor(status)} className={className}>
      {label ?? humanize(status)}
    </Badge>
  )
}
