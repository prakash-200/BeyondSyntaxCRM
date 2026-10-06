import { AlertTriangle, Inbox, Loader2, ShieldAlert } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { getErrorMessage } from '@/api/apiClient'
import { Button } from '@/components/ui/button'
import { cn } from '@/utils/cn'

export function EmptyState({ title = 'Nothing here yet', description, action, icon, className }: { title?: string; description?: ReactNode; action?: ReactNode; icon?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-14 text-center', className)}>
      <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-500">{icon ?? <Inbox className="h-5 w-5" />}</div>
      <p className="text-sm font-semibold text-slate-900">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-slate-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function ErrorState({ error, title = 'Unable to load data', onRetry, className }: { error?: unknown; title?: string; onRetry?: () => void; className?: string }) {
  return (
    <div role="alert" className={cn('flex flex-col items-center justify-center px-6 py-14 text-center', className)}>
      <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-red-50 text-red-600">
        <AlertTriangle className="h-5 w-5" />
      </div>
      <p className="text-sm font-semibold text-slate-900">{title}</p>
      {error !== undefined && <p className="mt-1 max-w-sm text-sm text-slate-500">{getErrorMessage(error)}</p>}
      {onRetry && (
        <Button variant="outline" size="sm" className="mt-4" onClick={onRetry}>
          Retry
        </Button>
      )}
    </div>
  )
}

export function LoadingState({ label = 'Loading…', className }: { label?: string; className?: string }) {
  return (
    <div role="status" aria-live="polite" className={cn('flex items-center justify-center gap-2 px-6 py-14 text-sm text-slate-500', className)}>
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
      {label}
    </div>
  )
}

export function ForbiddenState() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-50 text-amber-600">
        <ShieldAlert className="h-7 w-7" />
      </div>
      <h1 className="text-xl font-semibold text-slate-900">Access denied</h1>
      <p className="mt-1 max-w-md text-sm text-slate-500">Your role does not have permission to view this page. If you think this is a mistake, contact an administrator.</p>
      <Button className="mt-5" variant="outline">
        <Link to="/dashboard">Back to dashboard</Link>
      </Button>
    </div>
  )
}

/** Renders loading / error / empty states around query results. */
export function QueryBoundary({
  isLoading,
  error,
  onRetry,
  isEmpty,
  empty,
  loadingLabel,
  children,
}: {
  isLoading: boolean
  error: unknown
  onRetry?: () => void
  isEmpty?: boolean
  empty?: ReactNode
  loadingLabel?: string
  children: ReactNode
}) {
  if (isLoading) return <LoadingState label={loadingLabel} />
  if (error) return <ErrorState error={error} onRetry={onRetry} />
  if (isEmpty) return <>{empty ?? <EmptyState />}</>
  return <>{children}</>
}
