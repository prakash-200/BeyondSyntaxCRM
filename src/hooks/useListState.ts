import { useCallback, useMemo, useState } from 'react'
import type { ListParams } from '@/types'

interface Options {
  pageSize?: number
  sort?: string
  order?: 'asc' | 'desc'
  filters?: Record<string, string>
}

/**
 * Server-side table state (search, filters, sorting, pagination). The output
 * `params` maps 1:1 to query-string parameters understood by the REST API.
 */
export function useListState(options: Options = {}) {
  const initialFilters = options.filters ?? {}
  const [search, setSearchValue] = useState('')
  const [filters, setFilters] = useState<Record<string, string>>(initialFilters)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSizeValue] = useState(options.pageSize ?? 10)
  const [sort, setSort] = useState<string | undefined>(options.sort)
  const [order, setOrder] = useState<'asc' | 'desc'>(options.order ?? 'asc')

  const setSearch = useCallback((value: string) => {
    setSearchValue(value)
    setPage(1)
  }, [])

  const setFilter = useCallback((key: string, value: string) => {
    setFilters((f) => ({ ...f, [key]: value }))
    setPage(1)
  }, [])

  const setPageSize = useCallback((size: number) => {
    setPageSizeValue(size)
    setPage(1)
  }, [])

  const toggleSort = useCallback(
    (key: string) => {
      if (sort === key) setOrder((o) => (o === 'asc' ? 'desc' : 'asc'))
      else {
        setSort(key)
        setOrder('asc')
      }
      setPage(1)
    },
    [sort],
  )

  const reset = useCallback(() => {
    setSearchValue('')
    setFilters(initialFilters)
    setPage(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const params = useMemo<ListParams>(() => {
    const out: ListParams = { page, pageSize }
    if (search.trim()) out.search = search.trim()
    if (sort) {
      out.sort = sort
      out.order = order
    }
    for (const [k, v] of Object.entries(filters)) if (v) out[k] = v
    return out
  }, [page, pageSize, search, sort, order, filters])

  const activeFilterCount = Object.entries(filters).filter(([k, v]) => v && v !== (initialFilters[k] ?? '')).length + (search.trim() ? 1 : 0)

  return { params, search, filters, page, pageSize, sort, order, setSearch, setFilter, setPage, setPageSize, toggleSort, reset, activeFilterCount }
}

export type ListState = ReturnType<typeof useListState>
