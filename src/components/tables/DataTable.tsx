import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight } from 'lucide-react'
import type { ReactNode } from 'react'
import { ErrorState, EmptyState } from '@/components/common/States'
import { Button } from '@/components/ui/button'
import { DropdownMenu, type MenuItem } from '@/components/ui/dropdown-menu'
import { Select } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/misc'
import { cn } from '@/utils/cn'
import { formatNumber } from '@/utils/format'

export interface Column<T> {
  key: string
  header: ReactNode
  cell: (row: T) => ReactNode
  /** Server-side sort key; omit for non-sortable columns. */
  sortKey?: string
  align?: 'left' | 'right' | 'center'
  className?: string
  /** Hide the column below this breakpoint. */
  hideBelow?: 'sm' | 'md' | 'lg' | 'xl'
}

interface PaginationProps {
  page: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
  onPageSizeChange?: (size: number) => void
}

interface DataTableProps<T> {
  caption: string
  columns: Column<T>[]
  rows?: T[]
  rowKey: (row: T) => string
  isLoading?: boolean
  isFetching?: boolean
  error?: unknown
  onRetry?: () => void
  sort?: { key?: string; order: 'asc' | 'desc'; onSort: (key: string) => void }
  pagination?: PaginationProps
  onRowClick?: (row: T) => void
  rowActions?: (row: T) => MenuItem[]
  rowClassName?: (row: T) => string | undefined
  empty?: { title?: string; description?: ReactNode; action?: ReactNode }
  /** Keep the header visible while the body scrolls. */
  stickyHeader?: boolean
  className?: string
}

const HIDE: Record<NonNullable<Column<unknown>['hideBelow']>, string> = {
  sm: 'hidden sm:table-cell',
  md: 'hidden md:table-cell',
  lg: 'hidden lg:table-cell',
  xl: 'hidden xl:table-cell',
}

export function DataTable<T>({ caption, columns, rows, rowKey, isLoading, isFetching, error, onRetry, sort, pagination, onRowClick, rowActions, rowClassName, empty, stickyHeader, className }: DataTableProps<T>) {
  const showSkeleton = isLoading && !rows
  const colCount = columns.length + (rowActions ? 1 : 0)

  return (
    <div className={cn('overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs', className)}>
      <div className={cn('relative overflow-auto scrollbar-thin', stickyHeader && 'max-h-[68vh]')} aria-busy={isLoading || isFetching}>
        {isFetching && !isLoading && <div className="absolute inset-x-0 top-0 z-20 h-0.5 animate-pulse bg-brand-500" aria-hidden />}
        <table className="w-full min-w-[640px] border-collapse text-left text-sm">
          <caption className="sr-only">{caption}</caption>
          <thead className={cn('bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500', stickyHeader && 'sticky top-0 z-10 shadow-[0_1px_0_0_rgb(226_232_240)]')}>
            <tr>
              {columns.map((col) => {
                const sorted = sort?.key === col.sortKey
                return (
                  <th
                    key={col.key}
                    scope="col"
                    aria-sort={col.sortKey && sorted ? (sort!.order === 'asc' ? 'ascending' : 'descending') : undefined}
                    className={cn('px-4 py-3', col.align === 'right' && 'text-right', col.align === 'center' && 'text-center', col.hideBelow && HIDE[col.hideBelow], col.className)}
                  >
                    {col.sortKey && sort ? (
                      <button type="button" onClick={() => sort.onSort(col.sortKey!)} className={cn('inline-flex items-center gap-1 uppercase tracking-wide hover:text-slate-900', sorted && 'text-slate-900')}>
                        {col.header}
                        {sorted ? sort.order === 'asc' ? <ArrowUp className="h-3 w-3" aria-hidden /> : <ArrowDown className="h-3 w-3" aria-hidden /> : <ArrowUpDown className="h-3 w-3 opacity-40" aria-hidden />}
                      </button>
                    ) : (
                      col.header
                    )}
                  </th>
                )
              })}
              {rowActions && (
                <th scope="col" className="w-12 px-2 py-3">
                  <span className="sr-only">Actions</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {showSkeleton &&
              Array.from({ length: 6 }, (_, i) => (
                <tr key={i}>
                  {Array.from({ length: colCount }, (_, j) => (
                    <td key={j} className="px-4 py-3.5">
                      <Skeleton className="h-4 w-full max-w-[160px]" />
                    </td>
                  ))}
                </tr>
              ))}
            {!showSkeleton &&
              !error &&
              rows?.map((row) => (
                <tr
                  key={rowKey(row)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={cn('transition-colors', onRowClick && 'cursor-pointer hover:bg-slate-50', rowClassName?.(row))}
                >
                  {columns.map((col) => (
                    <td key={col.key} className={cn('px-4 py-3 align-middle', col.align === 'right' && 'text-right tabular-nums', col.align === 'center' && 'text-center', col.hideBelow && HIDE[col.hideBelow], col.className)}>
                      {col.cell(row)}
                    </td>
                  ))}
                  {rowActions && (
                    <td className="px-2 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu items={rowActions(row)} />
                    </td>
                  )}
                </tr>
              ))}
          </tbody>
        </table>
        {error ? <ErrorState error={error} title="Unable to load records" onRetry={onRetry} /> : null}
        {!showSkeleton && !error && rows && rows.length === 0 && <EmptyState title={empty?.title ?? 'No records found'} description={empty?.description ?? 'Try adjusting your search or filters.'} action={empty?.action} />}
      </div>
      {pagination && !error && (pagination.total > 0 || isLoading) && <Pagination {...pagination} />}
    </div>
  )
}

const PAGE_SIZES = [10, 20, 50]

export function Pagination({ page, pageSize, total, onPageChange, onPageSizeChange }: PaginationProps) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(total, page * pageSize)
  return (
    <nav aria-label="Pagination" className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 text-xs text-slate-600">
      <p aria-live="polite">
        Showing <span className="font-medium text-slate-900">{formatNumber(from)}</span>–<span className="font-medium text-slate-900">{formatNumber(to)}</span> of <span className="font-medium text-slate-900">{formatNumber(total)}</span>
      </p>
      <div className="flex items-center gap-3">
        {onPageSizeChange && (
          <label className="flex items-center gap-2">
            <span className="hidden sm:inline">Rows</span>
            <Select aria-label="Rows per page" value={pageSize} onChange={(e) => onPageSizeChange(Number(e.target.value))} className="h-8 w-[84px] text-xs">
              {PAGE_SIZES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </label>
        )}
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon-sm" onClick={() => onPageChange(page - 1)} disabled={page <= 1} aria-label="Previous page">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-[72px] text-center tabular-nums">
            Page {page} of {pages}
          </span>
          <Button variant="outline" size="icon-sm" onClick={() => onPageChange(page + 1)} disabled={page >= pages} aria-label="Next page">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </nav>
  )
}
