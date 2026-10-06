import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useParams } from 'react-router-dom'
import { Can } from '@/components/common/Can'
import { useConfirm } from '@/components/common/ConfirmDialog'
import { PageHeader } from '@/components/common/PageHeader'
import { EmptyState, ErrorState, LoadingState } from '@/components/common/States'
import { StatusBadge } from '@/components/common/StatusBadge'
import { FormInput, FormTextarea } from '@/components/forms/fields'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Dialog } from '@/components/ui/dialog'
import { DescriptionList } from '@/components/ui/misc'
import { Tabs, TabPanel } from '@/components/ui/tabs'
import { humanize } from '@/constants/labels'
import { useAuth } from '@/features/auth/AuthContext'
import { useBatches } from '@/features/batches/hooks'
import type { CourseModule } from '@/types'
import { formatCurrency, formatDate } from '@/utils/format'
import { CourseFormDialog } from './CoursesPage'
import { useAddModule, useCourse, useCourseModules, useRemoveModule, useReorderModules, useUpdateModule } from './hooks'

function ModuleDialog({ courseId, module, open, onClose }: { courseId: string; module: CourseModule | null; open: boolean; onClose: () => void }) {
  const add = useAddModule()
  const upd = useUpdateModule()
  const form = useForm<{ name: string; description: string; durationWeeks: number }>({ defaultValues: { name: '', description: '', durationWeeks: 2 } })
  useEffect(() => {
    if (open) form.reset(module ? { name: module.name, description: module.description, durationWeeks: module.durationWeeks } : { name: '', description: '', durationWeeks: 2 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, module])
  const busy = add.isPending || upd.isPending
  const submit = form.handleSubmit(async (v) => {
    if (!v.name.trim()) return form.setError('name', { message: 'Module name is required' })
    if (!(v.durationWeeks >= 1)) return form.setError('durationWeeks', { message: 'At least 1 week' })
    try {
      if (module) await upd.mutateAsync({ id: module.id, body: v })
      else await add.mutateAsync({ courseId, body: v })
      onClose()
    } catch (e) {
      form.setError('name', { message: e instanceof Error ? e.message : 'Failed' })
    }
  })
  const e = form.formState.errors
  return (
    <Dialog
      open={open}
      onClose={onClose}
      locked={busy}
      size="sm"
      title={module ? 'Edit module' : 'Add module'}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={submit} loading={busy}>
            Save
          </Button>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        <FormInput label="Module name" required error={e.name?.message} {...form.register('name')} />
        <FormInput label="Duration (weeks)" type="number" error={e.durationWeeks?.message} {...form.register('durationWeeks', { valueAsNumber: true })} />
        <FormTextarea label="Description" {...form.register('description')} />
      </form>
    </Dialog>
  )
}

export default function CourseDetailPage() {
  const { id = '' } = useParams()
  const { data: course, isLoading, error, refetch } = useCourse(id)
  const modules = useCourseModules(id)
  const batches = useBatches({ courseId: id, pageSize: 20, sort: 'startDate', order: 'desc' })
  const reorder = useReorderModules()
  const remove = useRemoveModule()
  const confirm = useConfirm()
  const { can } = useAuth()
  const [tab, setTab] = useState('modules')
  const [edit, setEdit] = useState(false)
  const [moduleDialog, setModuleDialog] = useState<{ open: boolean; module: CourseModule | null }>({ open: false, module: null })

  if (isLoading) return <LoadingState label="Loading course…" />
  if (error || !course) return <ErrorState error={error} title="Unable to load course" onRetry={refetch} />

  const mods = modules.data ?? []
  const move = (index: number, dir: -1 | 1) => {
    const ids = mods.map((m) => m.id)
    ;[ids[index], ids[index + dir]] = [ids[index + dir], ids[index]]
    reorder.mutate({ courseId: id, orderedIds: ids })
  }
  const canEdit = can('courses:update')

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: 'Courses', to: '/courses' }, { label: course.name }]}
        title={
          <span className="flex flex-wrap items-center gap-3">
            {course.name}
            <StatusBadge status={course.status} />
          </span>
        }
        description={`${course.id} · ${humanize(course.category)} · ${course.durationMonths} months · ${humanize(course.mode)}`}
        actions={
          <Can permission="courses:update">
            <Button variant="outline" onClick={() => setEdit(true)}>
              <Pencil className="h-4 w-4" aria-hidden /> Edit course
            </Button>
          </Can>
        }
      />
      <div className="mb-5 grid gap-3 sm:grid-cols-4">
        {[
          ['Course fee', formatCurrency(course.totalFee)],
          ['Modules', course.moduleCount],
          ['Students enrolled', course.studentCount],
          ['Live batches', course.activeBatches],
        ].map(([l, v]) => (
          <div key={String(l)} className="rounded-xl border border-slate-200 bg-white px-4 py-3">
            <p className="text-xs text-slate-500">{l}</p>
            <p className="mt-1 text-xl font-semibold tabular-nums">{v}</p>
          </div>
        ))}
      </div>
      <Tabs value={tab} onChange={setTab} label="Course sections" items={[{ value: 'modules', label: 'Modules', count: mods.length }, { value: 'overview', label: 'Overview' }, { value: 'batches', label: 'Batches', count: batches.data?.total }]} />
      <div className="mt-5">
        <TabPanel value="modules" active={tab}>
          <Card>
            <CardHeader
              title="Curriculum"
              description="Use the arrows to reorder modules."
              action={
                <Can permission="courses:update">
                  <Button size="sm" onClick={() => setModuleDialog({ open: true, module: null })}>
                    <Plus className="h-3.5 w-3.5" aria-hidden /> Add module
                  </Button>
                </Can>
              }
            />
            {modules.isLoading ? (
              <LoadingState className="py-8" />
            ) : !mods.length ? (
              <EmptyState title="No modules yet" description="Add the modules students will progress through." />
            ) : (
              <ol className="divide-y divide-slate-100">
                {mods.map((m, i) => (
                  <li key={m.id} className="flex items-center gap-4 px-5 py-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-sm font-semibold tabular-nums text-brand-700">{String(m.sequence).padStart(2, '0')}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-900">{m.name}</p>
                      <p className="truncate text-xs text-slate-500">
                        {m.durationWeeks} weeks · {m.description}
                      </p>
                    </div>
                    {canEdit && (
                      <div className="flex shrink-0 items-center gap-0.5">
                        <Button variant="ghost" size="icon-sm" aria-label={`Move ${m.name} up`} disabled={i === 0 || reorder.isPending} onClick={() => move(i, -1)}>
                          <ArrowUp className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon-sm" aria-label={`Move ${m.name} down`} disabled={i === mods.length - 1 || reorder.isPending} onClick={() => move(i, 1)}>
                          <ArrowDown className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon-sm" aria-label={`Edit ${m.name}`} onClick={() => setModuleDialog({ open: true, module: m })}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon-sm" aria-label={`Remove ${m.name}`} onClick={() => confirm({ title: `Remove “${m.name}”?`, description: 'Student progress for this module is kept but no longer counted.', tone: 'danger', confirmLabel: 'Remove', run: () => remove.mutateAsync(m.id) })}>
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </TabPanel>
        <TabPanel value="overview" active={tab}>
          <Card>
            <CardHeader title="Course details" />
            <CardContent className="space-y-5">
              <p className="text-sm text-slate-700">{course.description || 'No description.'}</p>
              <DescriptionList
                items={[
                  { label: 'Category', value: humanize(course.category) },
                  { label: 'Mode', value: humanize(course.mode) },
                  { label: 'Duration', value: `${course.durationMonths} months` },
                  { label: 'Total fee', value: formatCurrency(course.totalFee) },
                ]}
              />
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Discount rules</p>
                <ul className="mt-2 space-y-1 text-sm text-slate-700">
                  {course.discountRules.length ? course.discountRules.map((r) => <li key={r.label}>• {r.label} — {r.percent}%</li>) : <li className="text-slate-500">No standard discounts.</li>}
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabPanel>
        <TabPanel value="batches" active={tab}>
          <Card>
            {batches.isLoading ? (
              <LoadingState className="py-8" />
            ) : !batches.data?.items.length ? (
              <EmptyState title="No batches for this course" />
            ) : (
              <ul className="divide-y divide-slate-100">
                {batches.data.items.map((b) => (
                  <li key={b.id}>
                    <Link to={`/batches/${b.id}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-slate-50">
                      <div>
                        <p className="text-sm font-medium text-slate-900">{b.name}</p>
                        <p className="text-xs text-slate-500">
                          {formatDate(b.startDate)} → {formatDate(b.endDate)} · {b.trainerName} · {b.currentStudentCount}/{b.capacity} students
                        </p>
                      </div>
                      <StatusBadge status={b.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </TabPanel>
      </div>
      <CourseFormDialog open={edit} course={course} onClose={() => setEdit(false)} />
      <ModuleDialog courseId={id} module={moduleDialog.module} open={moduleDialog.open} onClose={() => setModuleDialog({ open: false, module: null })} />
    </>
  )
}
