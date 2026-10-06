import { X } from 'lucide-react'
import { useEffect, useId, useRef, type ReactNode } from 'react'
import { cn } from '@/utils/cn'
import { Button } from './button'

interface BaseProps {
  open: boolean
  onClose: () => void
  title: ReactNode
  description?: ReactNode
  children?: ReactNode
  footer?: ReactNode
  /** Prevent closing via backdrop / Esc while a request is running. */
  locked?: boolean
}

/**
 * Accessible modal built on the native <dialog> element: focus is trapped,
 * Esc closes it, background content is inert, and focus returns to the opener.
 */
function useDialog(open: boolean, onClose: () => void, locked?: boolean) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (open && !el.open) el.showModal()
    if (!open && el.open) el.close()
  }, [open])
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const onCancel = (e: Event) => {
      e.preventDefault()
      if (!locked) onClose()
    }
    el.addEventListener('cancel', onCancel)
    return () => el.removeEventListener('cancel', onCancel)
  }, [onClose, locked])
  const onBackdrop = (e: React.MouseEvent<HTMLDialogElement>) => {
    if (e.target === e.currentTarget && !locked) onClose()
  }
  return { ref, onBackdrop }
}

const SIZES = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' }

export function Dialog({ open, onClose, title, description, children, footer, locked, size = 'md' }: BaseProps & { size?: keyof typeof SIZES }) {
  const { ref, onBackdrop } = useDialog(open, onClose, locked)
  const titleId = useId()
  const descId = useId()
  return (
    <dialog
      ref={ref}
      onClick={onBackdrop}
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      className={cn('app-dialog m-auto w-[calc(100%-2rem)] rounded-xl bg-white p-0 shadow-2xl', SIZES[size])}
    >
      {open && (
        <div className="flex max-h-[88vh] flex-col">
          <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-4">
            <div>
              <h2 id={titleId} className="text-base font-semibold text-slate-900">
                {title}
              </h2>
              {description && (
                <p id={descId} className="mt-1 text-sm text-slate-500">
                  {description}
                </p>
              )}
            </div>
            <Button variant="ghost" size="icon-sm" onClick={onClose} disabled={locked} aria-label="Close dialog">
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="overflow-y-auto px-6 py-5">{children}</div>
          {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 bg-slate-50/60 px-6 py-3">{footer}</div>}
        </div>
      )}
    </dialog>
  )
}

/** Right-hand slide-over panel for detail views. */
export function Drawer({ open, onClose, title, description, children, footer, locked, width = 'max-w-xl' }: BaseProps & { width?: string }) {
  const { ref, onBackdrop } = useDialog(open, onClose, locked)
  const titleId = useId()
  return (
    <dialog ref={ref} onClick={onBackdrop} aria-labelledby={titleId} className={cn('app-dialog app-drawer m-0 ml-auto h-dvh max-h-dvh w-full rounded-none bg-white p-0 shadow-2xl sm:rounded-l-xl', width)}>
      {open && (
        <div className="flex h-full flex-col">
          <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-4">
            <div>
              <h2 id={titleId} className="text-base font-semibold text-slate-900">
                {title}
              </h2>
              {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
            </div>
            <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close panel">
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
          {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 bg-slate-50/60 px-6 py-3">{footer}</div>}
        </div>
      )}
    </dialog>
  )
}
