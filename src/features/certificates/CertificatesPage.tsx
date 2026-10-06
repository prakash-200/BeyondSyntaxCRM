import { Award, Eye } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useConfirm } from '@/components/common/ConfirmDialog'
import { PageHeader } from '@/components/common/PageHeader'
import { StatusBadge } from '@/components/common/StatusBadge'
import { DataTable, type Column } from '@/components/tables/DataTable'
import { ListFilters } from '@/components/tables/FilterBar'
import { Button } from '@/components/ui/button'
import { ProgressBar } from '@/components/ui/misc'
import { Tabs } from '@/components/ui/tabs'
import { useAuth } from '@/features/auth/AuthContext'
import { useListState } from '@/hooks/useListState'
import { useLookups } from '@/hooks/useLookups'
import type { Certificate, EligibleStudent } from '@/types'
import { formatDate, formatPercent } from '@/utils/format'
import { useCertificates, useEligibleForCertificate, useIssueCertificate } from './hooks'

export default function CertificatesPage() {
  const { can } = useAuth()
  const canIssue = can('certificates:approve')
  const [tab, setTab] = useState(canIssue ? 'eligible' : 'issued')
  const state = useListState({ sort: 'issuedDate', order: 'desc' })
  const issued = useCertificates(state.params)
  const eligible = useEligibleForCertificate(canIssue)
  const { courseOptions, batchOptions } = useLookups()
  const issue = useIssueCertificate()
  const confirm = useConfirm()
  const navigate = useNavigate()

  const issueFor = (s: EligibleStudent) =>
    confirm({
      title: `Issue certificate to ${s.studentName}?`,
      description: s.completed ? `${s.courseName} · progress ${formatPercent(s.progressPercent)} · attendance ${formatPercent(s.attendancePercent)}.` : `${s.studentName} has not been marked as completed yet. Issuing early needs an override reason and is recorded in the audit log.`,
      reason: s.completed && s.progressPercent >= 90 ? undefined : { required: true, label: 'Override reason', placeholder: 'Why is the certificate being issued early?' },
      confirmLabel: 'Issue certificate',
      run: async (reason) => {
        const c = await issue.mutateAsync({ studentId: s.studentId, overrideReason: reason || undefined })
        navigate(`/certificates/${c.id}`)
      },
    })

  const issuedCols: Column<Certificate>[] = [
    { key: 'id', header: 'Certificate', sortKey: 'issuedDate', cell: (c) => <Link to={`/certificates/${c.id}`} className="font-mono text-xs font-medium text-brand-700 hover:underline">{c.id}</Link> },
    { key: 'student', header: 'Student', sortKey: 'student', cell: (c) => <Link to={`/students/${c.studentId}`} className="text-slate-900 hover:text-brand-700">{c.studentName}</Link> },
    { key: 'course', header: 'Course', sortKey: 'course', hideBelow: 'md', cell: (c) => c.courseName },
    { key: 'batch', header: 'Batch', hideBelow: 'lg', cell: (c) => c.batchName },
    { key: 'completed', header: 'Completed', hideBelow: 'lg', cell: (c) => formatDate(c.completionDate) },
    { key: 'issued', header: 'Issued', cell: (c) => formatDate(c.issuedDate) },
    { key: 'by', header: 'Issued by', hideBelow: 'xl', cell: (c) => c.issuedByName },
  ]

  return (
    <>
      <PageHeader title="Certificates" description="Issue and verify course-completion certificates. Public verification: /verify/<certificate id>." />
      <Tabs className="mb-4" label="Certificate views" value={tab} onChange={setTab} items={[{ value: 'eligible', label: 'Ready to issue', count: eligible.data?.length, hidden: !canIssue }, { value: 'issued', label: 'Issued', count: issued.data?.total }]} />
      {tab === 'eligible' ? (
        <DataTable<EligibleStudent>
          caption="Students ready for certification"
          columns={[
            { key: 's', header: 'Student', cell: (s) => <Link to={`/students/${s.studentId}`} className="font-medium text-slate-900 hover:text-brand-700">{s.studentName}</Link> },
            { key: 'c', header: 'Course', hideBelow: 'md', cell: (s) => <div>{s.courseName}<p className="text-xs text-slate-500">{s.batchName}</p></div> },
            { key: 'p', header: 'Progress', className: 'w-40', cell: (s) => <ProgressBar value={s.progressPercent} showLabel label="Progress" /> },
            { key: 'a', header: 'Attendance', align: 'right', hideBelow: 'md', cell: (s) => formatPercent(s.attendancePercent) },
            { key: 'st', header: 'Course status', cell: (s) => <StatusBadge status={s.completed ? 'COMPLETED' : 'PENDING'} label={s.completed ? 'Completed' : 'In progress'} /> },
            { key: 'act', header: '', align: 'right', cell: (s) => <Button size="sm" variant={s.completed ? 'primary' : 'outline'} onClick={() => issueFor(s)}><Award className="h-3.5 w-3.5" aria-hidden /> Issue</Button> },
          ]}
          rows={eligible.data}
          rowKey={(s) => s.studentId}
          isLoading={eligible.isLoading}
          error={eligible.error}
          onRetry={eligible.refetch}
          empty={{ title: 'No students are waiting for a certificate', description: 'Students appear here once they complete the course or reach 90% progress.' }}
        />
      ) : (
        <>
          <ListFilters state={state} searchPlaceholder="Search certificate ID, student…" selects={[{ key: 'courseId', label: 'Course', options: courseOptions }, { key: 'batchId', label: 'Batch', options: batchOptions }]} dateRange={{ label: 'Issued' }} />
          <DataTable
            caption="Issued certificates"
            columns={issuedCols}
            rows={issued.data?.items}
            rowKey={(c) => c.id}
            isLoading={issued.isLoading}
            isFetching={issued.isFetching}
            error={issued.error}
            onRetry={issued.refetch}
            sort={{ key: state.sort, order: state.order, onSort: state.toggleSort }}
            pagination={{ page: state.page, pageSize: state.pageSize, total: issued.data?.total ?? 0, onPageChange: state.setPage, onPageSizeChange: state.setPageSize }}
            onRowClick={(c) => navigate(`/certificates/${c.id}`)}
            rowActions={(c) => [{ label: 'View / print', icon: <Eye />, onSelect: () => navigate(`/certificates/${c.id}`) }]}
          />
        </>
      )}
    </>
  )
}
