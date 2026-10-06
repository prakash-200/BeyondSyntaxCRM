import { Search, X } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import type { Option } from '@/components/forms/fields'
import { Button } from '@/components/ui/button'
import { Input, Select } from '@/components/ui/input'
import { useDebouncedValue } from '@/hooks/useDebounce'
import type { ListState } from '@/hooks/useListState'
import { cn } from '@/utils/cn'

export function FilterBar({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div role="search" className={cn('mb-4 flex flex-wrap items-center gap-2', className)}>
      {children}
    </div>
  )
}

/** Debounced search box — the parent only sees the value after the user pauses typing. */
export function SearchInput({ value, onChange, placeholder = 'Search…', label = 'Search', className }: { value: string; onChange: (v: string) => void; placeholder?: string; label?: string; className?: string }) {
  const [local, setLocal] = useState(value)
  const debounced = useDebouncedValue(local, 350)
  useEffect(() => {
    if (debounced !== value) onChange(debounced)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced])
  useEffect(() => {
    setLocal(value) // external reset
  }, [value])
  return (
    <div className={cn('relative min-w-[200px] flex-1 sm:max-w-xs', className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
      <Input type="search" aria-label={label} value={local} onChange={(e) => setLocal(e.target.value)} placeholder={placeholder} className="pl-9" />
    </div>
  )
}

export function FilterSelect({ label, value, onChange, options, allLabel, className }: { label: string; value: string; onChange: (v: string) => void; options: Option[]; allLabel?: string; className?: string }) {
  return (
    <Select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} className={cn('w-auto min-w-[140px] max-w-[220px]', className)}>
      <option value="">{allLabel ?? `All ${label.toLowerCase()}`}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </Select>
  )
}

export function DateRangeFilter({ from, to, onChange, label = 'Date' }: { from: string; to: string; onChange: (from: string, to: string) => void; label?: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <Input type="date" aria-label={`${label} from`} value={from} max={to || undefined} onChange={(e) => onChange(e.target.value, to)} className="w-[140px]" />
      <span className="text-xs text-slate-400" aria-hidden>
        to
      </span>
      <Input type="date" aria-label={`${label} to`} value={to} min={from || undefined} onChange={(e) => onChange(from, e.target.value)} className="w-[140px]" />
    </div>
  )
}

/** Convenience: search + a set of selects + optional date range wired to useListState. */
export function ListFilters({
  state,
  searchPlaceholder,
  selects = [],
  dateRange,
  extra,
}: {
  state: ListState
  searchPlaceholder?: string
  selects?: { key: string; label: string; options: Option[]; allLabel?: string }[]
  dateRange?: { label?: string }
  extra?: ReactNode
}) {
  return (
    <FilterBar>
      <SearchInput value={state.search} onChange={state.setSearch} placeholder={searchPlaceholder} />
      {selects.map((s) => (
        <FilterSelect key={s.key} label={s.label} allLabel={s.allLabel} value={state.filters[s.key] ?? ''} onChange={(v) => state.setFilter(s.key, v)} options={s.options} />
      ))}
      {dateRange && (
        <DateRangeFilter
          label={dateRange.label}
          from={state.filters.from ?? ''}
          to={state.filters.to ?? ''}
          onChange={(f, t) => {
            state.setFilter('from', f)
            state.setFilter('to', t)
          }}
        />
      )}
      {extra}
      {state.activeFilterCount > 0 && (
        <Button variant="ghost" size="sm" onClick={state.reset}>
          <X className="h-3.5 w-3.5" aria-hidden /> Clear ({state.activeFilterCount})
        </Button>
      )}
    </FilterBar>
  )
}
