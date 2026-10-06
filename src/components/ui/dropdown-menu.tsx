import { MoreHorizontal } from 'lucide-react'
import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/utils/cn'
import { Button } from './button'

export interface MenuItem {
  label: string
  icon?: ReactNode
  onSelect: () => void
  danger?: boolean
  disabled?: boolean
  hidden?: boolean
  separatorBefore?: boolean
}

/**
 * Popover menu rendered in a portal with fixed positioning so it is never
 * clipped by scrollable table containers.
 */
export function DropdownMenu({ items, trigger, label = 'Row actions', align = 'end' }: { items: MenuItem[]; trigger?: ReactNode; label?: string; align?: 'start' | 'end' }) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const id = useId()
  const visible = items.filter((i) => !i.hidden)

  const close = useCallback(() => {
    setOpen(false)
    btnRef.current?.focus()
  }, [])

  useEffect(() => {
    if (!open) return
    const rect = btnRef.current!.getBoundingClientRect()
    const width = 208
    const left = align === 'end' ? Math.max(8, rect.right - width) : Math.min(rect.left, window.innerWidth - width - 8)
    const estimatedHeight = visible.length * 36 + 16
    const top = rect.bottom + estimatedHeight > window.innerHeight ? Math.max(8, rect.top - estimatedHeight - 4) : rect.bottom + 4
    setPos({ top, left })
    const onDown = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node) && !btnRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    const onScroll = () => setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onScroll)
    queueMicrotask(() => menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]:not(:disabled)')?.focus())
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onScroll)
    }
  }, [open, align, close, visible.length])

  if (!visible.length) return null

  const onMenuKey = (e: React.KeyboardEvent) => {
    const nodes = [...(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not(:disabled)') ?? [])]
    const i = nodes.indexOf(document.activeElement as HTMLElement)
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      nodes[(i + 1) % nodes.length]?.focus()
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      nodes[(i - 1 + nodes.length) % nodes.length]?.focus()
    }
  }

  return (
    <>
      <Button ref={btnRef} variant="ghost" size={trigger ? 'md' : 'icon-sm'} aria-label={label} aria-haspopup="menu" aria-expanded={open} aria-controls={open ? id : undefined} onClick={(e) => { e.stopPropagation(); setOpen((o) => !o) }}>
        {trigger ?? <MoreHorizontal className="h-4 w-4" />}
      </Button>
      {open &&
        pos &&
        createPortal(
          <div ref={menuRef} id={id} role="menu" aria-label={label} onKeyDown={onMenuKey} style={{ top: pos.top, left: pos.left }} className="fixed z-[60] w-52 rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
            {visible.map((item) => (
              <div key={item.label}>
                {item.separatorBefore && <div className="my-1 h-px bg-slate-100" />}
                <button
                  role="menuitem"
                  disabled={item.disabled}
                  onClick={(e) => {
                    e.stopPropagation()
                    setOpen(false)
                    item.onSelect()
                  }}
                  className={cn('flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm focus:outline-none disabled:opacity-40', item.danger ? 'text-red-600 hover:bg-red-50 focus:bg-red-50' : 'text-slate-700 hover:bg-slate-100 focus:bg-slate-100')}
                >
                  {item.icon && <span className="h-4 w-4 shrink-0 [&>svg]:h-4 [&>svg]:w-4">{item.icon}</span>}
                  {item.label}
                </button>
              </div>
            ))}
          </div>,
          document.body,
        )}
    </>
  )
}
