import { useQuery } from '@tanstack/react-query'
import { Loader2, Search } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { commonApi } from '@/api/reportApi'
import { Input } from '@/components/ui/input'
import { useDebouncedValue } from '@/hooks/useDebounce'
import type { SearchResults } from '@/types'

const GROUPS: { key: keyof SearchResults; label: string; path: (id: string) => string }[] = [
  { key: 'students', label: 'Students', path: (id) => `/students/${id}` },
  { key: 'leads', label: 'Leads', path: (id) => `/leads/${id}` },
  { key: 'applications', label: 'Applications', path: (id) => `/applications/${id}` },
  { key: 'payments', label: 'Payments', path: (id) => `/payments/${id}` },
  { key: 'courses', label: 'Courses', path: (id) => `/courses/${id}` },
  { key: 'batches', label: 'Batches', path: (id) => `/batches/${id}` },
]

export function GlobalSearch() {
  const [value, setValue] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const debounced = useDebouncedValue(value.trim(), 300)
  const ref = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listId = useId()
  const navigate = useNavigate()

  const { data, isFetching } = useQuery({ queryKey: ['search', debounced], queryFn: () => commonApi.search(debounced), enabled: debounced.length >= 2, staleTime: 30_000 })

  const flat = data ? GROUPS.flatMap((g) => data[g.key].map((hit) => ({ ...hit, group: g.label, to: g.path(hit.id) }))) : []

  useEffect(() => setActive(0), [debounced])

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        inputRef.current?.focus()
        setOpen(true)
      }
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [])

  const go = (to: string) => {
    setOpen(false)
    setValue('')
    navigate(to)
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') setOpen(false)
    else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((a) => Math.min(flat.length - 1, a + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => Math.max(0, a - 1))
    } else if (e.key === 'Enter' && flat[active]) go(flat[active].to)
  }

  const showPanel = open && debounced.length >= 2
  let index = -1

  return (
    <div ref={ref} className="relative w-full max-w-md">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
      <Input
        ref={inputRef}
        type="search"
        role="combobox"
        aria-label="Search students, leads, applications, payments, courses and batches"
        aria-expanded={showPanel}
        aria-controls={listId}
        aria-activedescendant={flat[active] ? `${listId}-${active}` : undefined}
        autoComplete="off"
        placeholder="Search students, leads, payments…  (Ctrl+K)"
        value={value}
        onChange={(e) => {
          setValue(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        className="bg-slate-50 pl-9"
      />
      {isFetching && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-400" aria-hidden />}
      {showPanel && (
        <div id={listId} role="listbox" aria-label="Search results" className="absolute left-0 right-0 top-full z-50 mt-1.5 max-h-[70vh] overflow-y-auto rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
          {!isFetching && flat.length === 0 && <p className="px-3 py-6 text-center text-sm text-slate-500">No results for “{debounced}”.</p>}
          {data &&
            GROUPS.map((g) =>
              data[g.key].length ? (
                <div key={g.key} role="group" aria-label={g.label} className="mb-1">
                  <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{g.label}</p>
                  {data[g.key].map((hit) => {
                    index++
                    const i = index
                    return (
                      <button key={hit.id} id={`${listId}-${i}`} role="option" aria-selected={i === active} onMouseEnter={() => setActive(i)} onClick={() => go(g.path(hit.id))} className={`flex w-full flex-col rounded-lg px-3 py-2 text-left ${i === active ? 'bg-brand-50' : 'hover:bg-slate-50'}`}>
                        <span className="text-sm font-medium text-slate-900">{hit.title}</span>
                        <span className="text-xs text-slate-500">{hit.subtitle}</span>
                      </button>
                    )
                  })}
                </div>
              ) : null,
            )}
        </div>
      )}
    </div>
  )
}
