import { Download, Eye, Pencil, Plus, Trash2, Upload } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { studentApi } from '@/api/studentApi'
import { Can } from '@/components/common/Can'
import { useConfirm } from '@/components/common/ConfirmDialog'
import { PageHeader } from '@/components/common/PageHeader'
import { StatusBadge } from '@/components/common/StatusBadge'
import { DataTable, type Column } from '@/components/tables/DataTable'
import { ListFilters } from '@/components/tables/FilterBar'
import { Button } from '@/components/ui/button'
import type { MenuItem } from '@/components/ui/dropdown-menu'
import { ProgressBar } from '@/components/ui/misc'
import { LEAD_SOURCES, STUDENT_STATUSES } from '@/constants/enums'
import { humanize, optionsFrom } from '@/constants/labels'
import { useAuth } from '@/features/auth/AuthContext'
import { useListState } from '@/hooks/useListState'
import { useLookups } from '@/hooks/useLookups'
import type { StudentListItem } from '@/types'
import { downloadFile, toCsv } from '@/utils/csv'
import { formatCurrency, formatDate, formatPhone } from '@/utils/format'
import { ImportStudentsDialog, StudentFormDialog } from './StudentDialogs'
import { useDeleteStudent, useStudents } from './hooks'

export default function StudentsPage({ scope }: { scope?: 'active' | 'completed' }) {
  const state = useListState({ sort: 'admissionDate', order: 'desc', filters: scope ? { status: scope === 'active' ? 'ACTIVE' : 'COMPLETED' } : {} })
  const { data, isLoading, isFetching, error, refetch } = useStudents(state.params)
  const { courseOptions, batchOptions, employeeOptions } = useLookups()
  const { can } = useAuth()
  const confirm = useConfirm()
  const del = useDeleteStudent()
  const navigate = useNavigate()
  const [form, setForm] = useState<{ open: boolean; student: StudentListItem | null }>({ open: false, student: null })
  const [importing, setImporting] = useState(false)
  const [exporting, setExporting] = useState(false)
  const showFees = can('fees:view')

  const exportCsv = async () => {
    setExporting(true)
    try {
      const rows = await studentApi.export(state.params)
      downloadFile(
        `students-${new Date().toISOString().slice(0, 10)}.csv`,
        toCsv(rows, [
          { header: 'Student ID', value: (r) => r.id },
          { header: 'Name', value: (r) => r.fullName },
          { header: 'Phone', value: (r) => r.phone },
          { header: 'Email', value: (r) => r.email },
          { header: 'Course', value: (r) => r.courseName },
          { header: 'Batch', value: (r) => r.batchName },
          { header: 'Status', value: (r) => humanize(r.status) },
          { header: 'Counselor', value: (r) => r.counselorName },
          { header: 'Admission date', value: (r) => r.admissionDate },
          { header: 'Progress %', value: (r) => r.progressPercent },
        ]),
      )
      toast.success(`Exported ${rows.length} students`)
    } catch {
      toast.error('Export failed. Please try again.')
    } finally {
      setExporting(false)
    }
  }

  const columns: Column<StudentListItem>[] = [
    {
      key: 'name',
      header: 'Student',
      sortKey: 'name',
      cell: (s) => (
        <div>
          <Link to={`/students/${s.id}`} className="font-medium text-slate-900 hover:text-brand-700" onClick={(e) => e.stopPropagation()}>
            {s.fullName}
          </Link>
          <p className="text-xs text-slate-500">
            {s.id} · {formatPhone(s.phone)}
          </p>
        </div>
      ),
    },
    { key: 'course', header: 'Course', sortKey: 'course', hideBelow: 'md', cell: (s) => s.courseName },
    { key: 'batch', header: 'Batch', hideBelow: 'lg', cell: (s) => s.batchName ?? <span className="text-slate-400">Not assigned</span> },
    { key: 'status', header: 'Status', sortKey: 'status', cell: (s) => <StatusBadge status={s.status} /> },
    { key: 'progress', header: 'Progress', sortKey: 'progress', hideBelow: 'lg', className: 'w-36', cell: (s) => <ProgressBar value={s.progressPercent} showLabel label={`${s.fullName} progress`} /> },
    ...(showFees ? [{ key: 'due', header: 'Outstanding', sortKey: 'outstanding', align: 'right' as const, hideBelow: 'xl' as const, cell: (s: StudentListItem) => (s.outstandingAmount ? <span className="font-medium text-amber-700">{formatCurrency(s.outstandingAmount)}</span> : <span className="text-slate-400">—</span>) }] : []),
    { key: 'admission', header: 'Admitted', sortKey: 'admissionDate', hideBelow: 'xl', cell: (s) => formatDate(s.admissionDate) },
  ]

  const actions = (s: StudentListItem): MenuItem[] => [
    { label: 'View profile', icon: <Eye />, onSelect: () => navigate(`/students/${s.id}`) },
    { label: 'Edit student', icon: <Pencil />, hidden: !can('students:update'), onSelect: () => setForm({ open: true, student: s }) },
    {
      label: 'Delete student',
      icon: <Trash2 />,
      danger: true,
      separatorBefore: true,
      hidden: !can('students:delete'),
      onSelect: () => confirm({ title: `Delete ${s.fullName}?`, description: 'Students with fee or payment records cannot be deleted — change their status to Cancelled or Dropped instead.', confirmLabel: 'Delete student', tone: 'danger', run: () => del.mutateAsync(s.id) }),
    },
  ]

  const title = scope === 'active' ? 'Active students' : scope === 'completed' ? 'Completed students' : 'All students'

  return (
    <>
      <PageHeader
        title={title}
        description="Student records, enrolment and training status."
        actions={
          <>
            <Button variant="outline" onClick={exportCsv} loading={exporting}>
              <Download className="h-4 w-4" aria-hidden /> Export
            </Button>
            <Can permission="students:create">
              <Button variant="outline" onClick={() => setImporting(true)}>
                <Upload className="h-4 w-4" aria-hidden /> Import
              </Button>
              <Button onClick={() => setForm({ open: true, student: null })}>
                <Plus className="h-4 w-4" aria-hidden /> Add student
              </Button>
            </Can>
          </>
        }
      />
      <ListFilters
        state={state}
        searchPlaceholder="Search name, ID, phone, email…"
        selects={[
          ...(scope ? [] : [{ key: 'status', label: 'Status', options: optionsFrom(STUDENT_STATUSES) }]),
          { key: 'courseId', label: 'Course', options: courseOptions },
          { key: 'batchId', label: 'Batch', options: batchOptions },
          { key: 'counselorId', label: 'Counselor', options: employeeOptions('COUNSELOR') },
          { key: 'source', label: 'Source', options: optionsFrom(LEAD_SOURCES) },
        ]}
        dateRange={{ label: 'Admission' }}
      />
      <DataTable
        caption={title}
        columns={columns}
        rows={data?.items}
        rowKey={(s) => s.id}
        isLoading={isLoading}
        isFetching={isFetching}
        error={error}
        onRetry={refetch}
        sort={{ key: state.sort, order: state.order, onSort: state.toggleSort }}
        pagination={{ page: state.page, pageSize: state.pageSize, total: data?.total ?? 0, onPageChange: state.setPage, onPageSizeChange: state.setPageSize }}
        onRowClick={(s) => navigate(`/students/${s.id}`)}
        rowActions={actions}
        empty={{ title: 'No students found' }}
      />
      <StudentFormDialog open={form.open} student={form.student} onClose={() => setForm({ open: false, student: null })} />
      <ImportStudentsDialog open={importing} onClose={() => setImporting(false)} />
    </>
  )
}

export const ActiveStudentsPage = () => <StudentsPage scope="active" />
export const CompletedStudentsPage = () => <StudentsPage scope="completed" />
