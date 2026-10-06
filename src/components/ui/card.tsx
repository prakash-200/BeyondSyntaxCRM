import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/utils/cn'

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('rounded-xl border border-slate-200 bg-white shadow-xs', className)} {...props} />
}

export function CardHeader({ className, title, description, action, children, ...props }: Omit<HTMLAttributes<HTMLDivElement>, 'title'> & { title?: ReactNode; description?: ReactNode; action?: ReactNode }) {
  return (
    <div className={cn('flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4', className)} {...props}>
      <div className="min-w-0">
        {title && <h3 className="text-sm font-semibold text-slate-900">{title}</h3>}
        {description && <p className="mt-0.5 text-xs text-slate-500">{description}</p>}
        {children}
      </div>
      {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
    </div>
  )
}

export function CardContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-5', className)} {...props} />
}
