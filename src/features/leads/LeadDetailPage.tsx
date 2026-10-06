import { CalendarPlus, CheckCircle2, ExternalLink, Pencil, UserCheck, UserCog } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useParams } from 'react-router-dom'
import { Can } from '@/components/common/Can'
import { PageHeader } from '@/components/common/PageHeader'
import { EmptyState, ErrorState, LoadingState } from '@/components/common/States'
import { StatusBadge } from '@/components/common/StatusBadge'
import { FormSelect } from '@/components/forms/fields'
import { ActivityTimeline } from '@/components/timeline/ActivityTimeline'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Dialog } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/input'
import { DescriptionList } from '@/components/ui/misc'
import { Tabs, TabPanel } from '@/components/ui/tabs'
import { humanize } from '@/constants/labels'
import { useAuth } from '@/features/auth/AuthContext'
import { useLookups } from '@/hooks/useLookups'
import { today } from '@/utils/clock'
import { formatDate, formatDateTime, formatPhone, formatTime } from '@/utils/format'
import { CompleteFollowUpDialog, ConvertLeadDialog, FollowUpFormDialog, LeadFormDialog, RescheduleDialog } from './LeadDialogs'
import { useAddLeadNote, useAssignLead, useLead, useLeadActivity, useLeadFollowUps } from './hooks'
import type { FollowUp } from '@/types'

export default function LeadDetailPage() {
  const { id = '' } = useParams()
  const { can } = useAuth()
  const { data: lead, isLoading, error, refetch } = useLead(id)
  const followUps = useLeadFollowUps(id)
  const activity = useLeadActivity(id)
  const { employeeOptions } = useLookups()
  const addNote = useAddLeadNote()
  const assign = useAssignLead()
  const [tab, setTab] = useState('overview')
  const [edit, setEdit] = useState(false)
  const [schedule, setSchedule] = useState(false)
  const [convert, setConvert] = useState(false)
  const [assigning, setAssigning] = useState(false)
  const [complete, setComplete] = useState<FollowUp | null>(null)
  const [resched, setResched] = useState<FollowUp | null>(null)
  const [note, setNote] = useState('')
  const assignForm = useForm<{ employeeId: string }>()

  if (isLoading) return <LoadingState label="Loading lead…" />
  if (error || !lead) return <ErrorState error={error} title="Unable to load lead" onRetry={refetch} />
  const converted = lead.status === 'CONVERTED'

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: 'Leads', to: '/leads' }, { label: lead.name }]}
        title={
          <span className="flex flex-wrap items-center gap-3">
            {lead.name}
            <StatusBadge status={lead.status} />
            <StatusBadge status={lead.priority} label={`${humanize(lead.priority)} priority`} />
          </span>
        }
        description={`${lead.id} · created ${formatDate(lead.createdAt)} · ${lead.interestedCourseName}`}
        actions={
          <>
            <Can permission="leads:update">
              <Button variant="outline" onClick={() => setEdit(true)}>
                <Pencil className="h-4 w-4" aria-hidden /> Edit
              </Button>
              <Button variant="outline" onClick={() => setAssigning(true)}>
                <UserCog className="h-4 w-4" aria-hidden /> Assign
              </Button>
            </Can>
            {!converted && (
              <Can permission="followups:create">
                <Button variant="outline" onClick={() => setSchedule(true)}>
                  <CalendarPlus className="h-4 w-4" aria-hidden /> Schedule follow-up
                </Button>
              </Can>
            )}
            <Can permission="applications:create">
              <Button onClick={() => setConvert(true)} disabled={converted}>
                <UserCheck className="h-4 w-4" aria-hidden /> {converted ? 'Converted' : 'Convert'}
              </Button>
            </Can>
          </>
        }
      />

      {(lead.applicationId || lead.studentId) && (
        <div className="mb-4 flex flex-wrap gap-3 rounded-xl border border-brand-100 bg-brand-50 px-4 py-3 text-sm">
          {lead.applicationId && (
            <Link className="inline-flex items-center gap-1 font-medium text-brand-700 hover:underline" to={`/applications/${lead.applicationId}`}>
              <ExternalLink className="h-3.5 w-3.5" aria-hidden /> Application {lead.applicationId}
            </Link>
          )}
          {lead.studentId && (
            <Link className="inline-flex items-center gap-1 font-medium text-brand-700 hover:underline" to={`/students/${lead.studentId}`}>
              <ExternalLink className="h-3.5 w-3.5" aria-hidden /> Student {lead.studentId}
            </Link>
          )}
        </div>
      )}

      <Tabs
        value={tab}
        onChange={setTab}
        label="Lead sections"
        items={[
          { value: 'overview', label: 'Overview' },
          { value: 'followups', label: 'Follow-ups', count: followUps.data?.length },
          { value: 'notes', label: 'Notes', count: lead.notes.length },
          { value: 'activity', label: 'Activity' },
        ]}
      />

      <div className="mt-5">
        <TabPanel value="overview" active={tab}>
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader title="Lead details" />
              <CardContent>
                <DescriptionList
                  items={[
                    { label: 'Phone', value: formatPhone(lead.phone) },
                    { label: 'Email', value: lead.email || '—' },
                    { label: 'Location', value: lead.location || '—' },
                    { label: 'Education', value: lead.education || '—' },
                    { label: 'Interested course', value: lead.interestedCourseName },
                    { label: 'Lead source', value: humanize(lead.source) },
                    { label: 'Assigned counselor', value: lead.assignedToName },
                    { label: 'Next follow-up', value: lead.nextFollowUp ? formatDate(lead.nextFollowUp) : '—' },
                  ]}
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader title="Latest note" />
              <CardContent>{lead.notes[0] ? <><p className="text-sm text-slate-700">{lead.notes[0].text}</p><p className="mt-2 text-xs text-slate-500">{lead.notes[0].createdByName} · {formatDateTime(lead.notes[0].createdAt)}</p></> : <p className="text-sm text-slate-500">No notes yet.</p>}</CardContent>
            </Card>
          </div>
        </TabPanel>

        <TabPanel value="followups" active={tab}>
          <Card>
            {followUps.isLoading ? (
              <LoadingState className="py-8" />
            ) : !followUps.data?.length ? (
              <EmptyState title="No follow-ups yet" description="Schedule a call, WhatsApp message or meeting." className="py-10" />
            ) : (
              <ul className="divide-y divide-slate-100">
                {followUps.data.map((f) => (
                  <li key={f.id} className="flex flex-wrap items-start justify-between gap-3 px-5 py-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium text-slate-900">
                          {humanize(f.type)} · {formatDate(f.date)} {formatTime(f.time)}
                        </p>
                        <StatusBadge status={f.status === 'PENDING' && f.date < today() ? 'OVERDUE' : f.status} />
                      </div>
                      <p className="mt-0.5 text-xs text-slate-500">{f.employeeName}</p>
                      {f.notes && <p className="mt-1 whitespace-pre-line text-sm text-slate-600">{f.notes}</p>}
                      {f.outcome && (
                        <p className="mt-1 flex items-start gap-1 text-sm text-emerald-700">
                          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> {f.outcome}
                        </p>
                      )}
                    </div>
                    {f.status === 'PENDING' && can('followups:update') && (
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => setResched(f)}>
                          Reschedule
                        </Button>
                        <Button size="sm" onClick={() => setComplete(f)}>
                          Complete
                        </Button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </TabPanel>

        <TabPanel value="notes" active={tab}>
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              {lead.notes.length === 0 ? (
                <EmptyState title="No notes yet" className="py-10" />
              ) : (
                <ul className="divide-y divide-slate-100">
                  {lead.notes.map((n) => (
                    <li key={n.id} className="px-5 py-4">
                      <p className="whitespace-pre-line text-sm text-slate-800">{n.text}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {n.createdByName} · {formatDateTime(n.createdAt)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
            <Can permission="leads:update">
              <Card className="h-fit">
                <CardHeader title="Add a note" />
                <CardContent className="space-y-3">
                  <Textarea aria-label="Note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Call summary, objections, documents promised…" />
                  <Button
                    loading={addNote.isPending}
                    disabled={!note.trim()}
                    onClick={() => addNote.mutate({ id, text: note.trim() }, { onSuccess: () => setNote('') })}
                  >
                    Save note
                  </Button>
                </CardContent>
              </Card>
            </Can>
          </div>
        </TabPanel>

        <TabPanel value="activity" active={tab}>
          <Card>
            <CardContent>
              <ActivityTimeline items={activity.data} isLoading={activity.isLoading} error={activity.error} onRetry={activity.refetch} />
            </CardContent>
          </Card>
        </TabPanel>
      </div>

      <LeadFormDialog open={edit} onClose={() => setEdit(false)} lead={lead} />
      <FollowUpFormDialog open={schedule} onClose={() => setSchedule(false)} entity={{ id: lead.id, name: lead.name, assignedToId: lead.assignedToId }} />
      <ConvertLeadDialog lead={convert ? lead : null} onClose={() => setConvert(false)} />
      <CompleteFollowUpDialog followUp={complete} onClose={() => setComplete(null)} />
      <RescheduleDialog followUp={resched} onClose={() => setResched(null)} />
      <Dialog
        open={assigning}
        onClose={() => setAssigning(false)}
        size="sm"
        title="Assign counselor"
        footer={
          <>
            <Button variant="outline" onClick={() => setAssigning(false)}>
              Cancel
            </Button>
            <Button
              loading={assign.isPending}
              onClick={assignForm.handleSubmit((v) => v.employeeId && assign.mutate({ id, employeeId: v.employeeId }, { onSuccess: () => setAssigning(false) }))}
            >
              Assign
            </Button>
          </>
        }
      >
        <FormSelect label="Counselor" placeholder="Select…" defaultValue={lead.assignedToId} options={employeeOptions('COUNSELOR')} {...assignForm.register('employeeId')} />
      </Dialog>
    </>
  )
}
