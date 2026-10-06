import { CalendarPlus, Eye, Pencil, Plus, Trash2, UserCheck } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Can } from '@/components/common/Can'
import { useConfirm } from '@/components/common/ConfirmDialog'
import { PageHeader } from '@/components/common/PageHeader'
import { StatusBadge } from '@/components/common/StatusBadge'
import { DataTable, type Column } from '@/components/tables/DataTable'
import { ListFilters } from '@/components/tables/FilterBar'
import { Button } from '@/components/ui/button'
import type { MenuItem } from '@/components/ui/dropdown-menu'
import { LEAD_SOURCES, LEAD_STATUSES, PRIORITIES } from '@/constants/enums'
import { humanize, optionsFrom } from '@/constants/labels'
import { useAuth } from '@/features/auth/AuthContext'
import { useListState } from '@/hooks/useListState'
import { useLookups } from '@/hooks/useLookups'
import type { Lead } from '@/types'
import { today } from '@/utils/clock'
import { formatDate, formatPhone } from '@/utils/format'
import { ConvertLeadDialog, FollowUpFormDialog, LeadFormDialog } from './LeadDialogs'
import { useDeleteLead, useLeads } from './hooks'

export default function LeadsPage() {
  const state = useListState({ sort: 'createdAt', order: 'desc' })
  const { data, isLoading, isFetching, error, refetch } = useLeads(state.params)
  const { courseOptions, employeeOptions } = useLookups()
  const { can } = useAuth()
  const confirm = useConfirm()
  const navigate = useNavigate()
  const del = useDeleteLead()
  const [form, setForm] = useState<{ open: boolean; lead: Lead | null }>({ open: false, lead: null })
  const [followUpFor, setFollowUpFor] = useState<Lead | null>(null)
  const [convertFor, setConvertFor] = useState<Lead | null>(null)

  const columns: Column<Lead>[] = [
    {
      key: 'name',
      header: 'Lead',
      sortKey: 'name',
      cell: (l) => (
        <div className="min-w-0">
          <Link to={`/leads/${l.id}`} className="font-medium text-slate-900 hover:text-brand-700" onClick={(e) => e.stopPropagation()}>
            {l.name}
          </Link>
          <p className="text-xs text-slate-500">
            {l.id} · {formatPhone(l.phone)}
          </p>
        </div>
      ),
    },
    { key: 'course', header: 'Course', sortKey: 'course', hideBelow: 'md', cell: (l) => l.interestedCourseName },
    { key: 'source', header: 'Source', hideBelow: 'xl', cell: (l) => humanize(l.source) },
    { key: 'assigned', header: 'Counselor', hideBelow: 'lg', cell: (l) => l.assignedToName },
    { key: 'status', header: 'Status', sortKey: 'status', cell: (l) => <StatusBadge status={l.status} /> },
    { key: 'priority', header: 'Priority', sortKey: 'priority', hideBelow: 'lg', cell: (l) => <StatusBadge status={l.priority} /> },
    {
      key: 'next',
      header: 'Next follow-up',
      sortKey: 'nextFollowUp',
      hideBelow: 'md',
      cell: (l) => (l.nextFollowUp ? <span className={l.nextFollowUp < today() ? 'font-medium text-red-600' : ''}>{formatDate(l.nextFollowUp)}{l.nextFollowUp < today() && ' (overdue)'}</span> : <span className="text-slate-400">—</span>),
    },
    { key: 'created', header: 'Created', sortKey: 'createdAt', hideBelow: 'xl', cell: (l) => formatDate(l.createdAt) },
  ]

  const actions = (l: Lead): MenuItem[] => {
    const converted = l.status === 'CONVERTED'
    return [
      { label: 'View details', icon: <Eye />, onSelect: () => navigate(`/leads/${l.id}`) },
      { label: 'Edit lead', icon: <Pencil />, hidden: !can('leads:update'), onSelect: () => setForm({ open: true, lead: l }) },
      { label: 'Schedule follow-up', icon: <CalendarPlus />, hidden: !can('followups:create') || converted, onSelect: () => setFollowUpFor(l) },
      { label: converted ? 'Converted' : 'Convert…', icon: <UserCheck />, disabled: converted, hidden: !can('applications:create'), onSelect: () => setConvertFor(l) },
      {
        label: 'Delete lead',
        icon: <Trash2 />,
        danger: true,
        separatorBefore: true,
        hidden: !can('leads:delete'),
        disabled: !!l.studentId,
        onSelect: () =>
          confirm({ title: `Delete ${l.name}?`, description: 'The lead is archived (soft delete) and its pending follow-ups are cancelled. This action cannot be undone from the UI.', confirmLabel: 'Delete lead', tone: 'danger', run: () => del.mutateAsync(l.id) }),
      },
    ]
  }

  return (
    <>
      <PageHeader
        title="Leads"
        description="Track enquiries from first contact to admission."
        actions={
          <Can permission="leads:create">
            <Button onClick={() => setForm({ open: true, lead: null })}>
              <Plus className="h-4 w-4" aria-hidden /> Add lead
            </Button>
          </Can>
        }
      />
      <ListFilters
        state={state}
        searchPlaceholder="Search name, phone, email, ID…"
        selects={[
          { key: 'status', label: 'Status', options: optionsFrom(LEAD_STATUSES) },
          { key: 'source', label: 'Source', options: optionsFrom(LEAD_SOURCES) },
          { key: 'priority', label: 'Priority', options: optionsFrom(PRIORITIES) },
          { key: 'courseId', label: 'Course', options: courseOptions },
          { key: 'assignedToId', label: 'Counselor', options: employeeOptions('COUNSELOR') },
        ]}
        dateRange={{ label: 'Created' }}
      />
      <DataTable
        caption="Leads"
        columns={columns}
        rows={data?.items}
        rowKey={(l) => l.id}
        isLoading={isLoading}
        isFetching={isFetching}
        error={error}
        onRetry={refetch}
        sort={{ key: state.sort, order: state.order, onSort: state.toggleSort }}
        pagination={{ page: state.page, pageSize: state.pageSize, total: data?.total ?? 0, onPageChange: state.setPage, onPageSizeChange: state.setPageSize }}
        onRowClick={(l) => navigate(`/leads/${l.id}`)}
        rowActions={actions}
        empty={{ title: 'No leads found', description: state.activeFilterCount ? 'No leads match your filters.' : 'Add your first lead to get started.' }}
      />
      <LeadFormDialog open={form.open} lead={form.lead} onClose={() => setForm({ open: false, lead: null })} />
      <FollowUpFormDialog open={!!followUpFor} onClose={() => setFollowUpFor(null)} entity={followUpFor ? { id: followUpFor.id, name: followUpFor.name, assignedToId: followUpFor.assignedToId } : null} />
      <ConvertLeadDialog lead={convertFor} onClose={() => setConvertFor(null)} />
    </>
  )
}
