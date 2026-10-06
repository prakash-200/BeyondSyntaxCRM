import { useRef, type KeyboardEvent, type ReactNode } from 'react'
import { cn } from '@/utils/cn'

export interface TabItem {
  value: string
  label: ReactNode
  count?: number
  hidden?: boolean
}

interface TabsProps {
  items: TabItem[]
  value: string
  onChange: (value: string) => void
  className?: string
  label?: string
  variant?: 'underline' | 'pills'
}

/** Accessible tab list (roles + arrow-key navigation). Panels are rendered by the caller. */
export function Tabs({ items, value, onChange, className, label = 'Sections', variant = 'underline' }: TabsProps) {
  const visible = items.filter((i) => !i.hidden)
  const refs = useRef<(HTMLButtonElement | null)[]>([])

  const onKeyDown = (e: KeyboardEvent, index: number) => {
    let next = index
    if (e.key === 'ArrowRight') next = (index + 1) % visible.length
    else if (e.key === 'ArrowLeft') next = (index - 1 + visible.length) % visible.length
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = visible.length - 1
    else return
    e.preventDefault()
    onChange(visible[next].value)
    refs.current[next]?.focus()
  }

  return (
    <div role="tablist" aria-label={label} className={cn('flex gap-1 overflow-x-auto scrollbar-thin', variant === 'underline' ? 'border-b border-slate-200' : 'rounded-lg bg-slate-100 p-1', className)}>
      {visible.map((item, i) => {
        const active = item.value === value
        return (
          <button
            key={item.value}
            ref={(el) => {
              refs.current[i] = el
            }}
            role="tab"
            id={`tab-${item.value}`}
            aria-selected={active}
            aria-controls={`panel-${item.value}`}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(item.value)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={cn(
              'inline-flex shrink-0 items-center gap-2 whitespace-nowrap text-sm font-medium transition-colors',
              variant === 'underline'
                ? cn('-mb-px border-b-2 px-3 py-2.5', active ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-500 hover:text-slate-800')
                : cn('rounded-md px-3 py-1.5', active ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'),
            )}
          >
            {item.label}
            {item.count !== undefined && (
              <span className={cn('rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums', active ? 'bg-brand-100 text-brand-700' : 'bg-slate-200 text-slate-600')}>{item.count}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}

export function TabPanel({ value, active, children, className }: { value: string; active: string; children: ReactNode; className?: string }) {
  if (value !== active) return null
  return (
    <div role="tabpanel" id={`panel-${value}`} aria-labelledby={`tab-${value}`} className={className}>
      {children}
    </div>
  )
}
