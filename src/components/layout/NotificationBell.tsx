import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Bell, CheckCheck } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { notificationApi } from '@/api/auditApi'
import { useApiMutation } from '@/hooks/useApiMutation'
import { cn } from '@/utils/cn'
import { formatShortDateTime } from '@/utils/format'
import { EmptyState } from '@/components/common/States'

export function NotificationBell() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data = [] } = useQuery({ queryKey: ['notifications'], queryFn: notificationApi.list, refetchInterval: 60_000 })
  const unread = data.filter((n) => !n.read).length

  const markAll = useApiMutation({ mutationFn: notificationApi.markAllRead, invalidate: ['notifications'] })
  const markOne = useApiMutation({ mutationFn: notificationApi.markRead, invalidate: ['notifications'], silentError: true })

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen((o) => !o)
          if (!open) void queryClient.invalidateQueries({ queryKey: ['notifications'] })
        }}
        aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="relative rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">{unread}</span>}
      </button>
      {open && (
        <div role="dialog" aria-label="Notifications" className="absolute right-0 top-full z-50 mt-2 w-[min(92vw,380px)] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <p className="text-sm font-semibold">Notifications</p>
            <button type="button" onClick={() => markAll.mutate()} disabled={!unread} className="inline-flex items-center gap-1 text-xs font-medium text-brand-700 disabled:text-slate-400">
              <CheckCheck className="h-3.5 w-3.5" /> Mark all read
            </button>
          </div>
          <ul className="max-h-[60vh] divide-y divide-slate-100 overflow-y-auto">
            {data.length === 0 && <EmptyState title="You're all caught up" className="py-10" />}
            {data.map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => {
                    if (!n.read) markOne.mutate(n.id)
                    setOpen(false)
                    if (n.link) navigate(n.link)
                  }}
                  className={cn('flex w-full gap-3 px-4 py-3 text-left hover:bg-slate-50', !n.read && 'bg-brand-50/40')}
                >
                  <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', n.read ? 'bg-transparent' : 'bg-brand-600')} aria-hidden />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-slate-900">
                      {n.title}
                      {!n.read && <span className="sr-only"> (unread)</span>}
                    </span>
                    <span className="block text-xs text-slate-600">{n.message}</span>
                    <span className="mt-0.5 block text-[11px] text-slate-400">{formatShortDateTime(n.createdAt)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
