import { zodResolver } from '@hookform/resolvers/zod'
import { Pencil, Plus, Power } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Can } from '@/components/common/Can'
import { useConfirm } from '@/components/common/ConfirmDialog'
import { PageHeader } from '@/components/common/PageHeader'
import { StatusBadge } from '@/components/common/StatusBadge'
import { FormError, FormGrid, FormInput, FormSelect } from '@/components/forms/fields'
import { applyServerErrors, PHONE_MESSAGE, PHONE_REGEX } from '@/components/forms/utils'
import { DataTable, type Column } from '@/components/tables/DataTable'
import { ListFilters } from '@/components/tables/FilterBar'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Avatar } from '@/components/ui/misc'
import { ACTIVE_STATES, DEPARTMENTS, ROLES } from '@/constants/enums'
import { optionsFrom } from '@/constants/labels'
import { ROLE_LABELS } from '@/constants/permissions'
import { useAuth } from '@/features/auth/AuthContext'
import { useListState } from '@/hooks/useListState'
import type { Employee } from '@/types'
import { today } from '@/utils/clock'
import { formatDate, formatPhone } from '@/utils/format'
import { useCreateEmployee, useEmployees, useSetEmployeeStatus, useUpdateEmployee } from './hooks'

const schema = z.object({
  name: z.string().trim().min(2, 'Enter the employee’s name').max(80),
  email: z.string().trim().min(1, 'Email is required').email('Enter a valid email address'),
  phone: z.string().trim().regex(PHONE_REGEX, PHONE_MESSAGE),
  role: z.enum(ROLES),
  department: z.string().min(1, 'Select a department'),
  joiningDate: z.string().min(1, 'Choose the joining date').refine((d) => d <= today(), 'Joining date cannot be in the future'),
  specialization: z.string().max(120),
})
type Values = z.infer<typeof schema>

function EmployeeFormDialog({ open, onClose, employee }: { open: boolean; onClose: () => void; employee: Employee | null }) {
  const { user } = useAuth()
  const create = useCreateEmployee()
  const update = useUpdateEmployee()
  const [formError, setFormError] = useState('')
  const editing = !!employee
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { name: '', email: '', phone: '', role: 'COUNSELOR', department: '', joiningDate: today(), specialization: '' } })
  const role = form.watch('role')
  useEffect(() => {
    if (!open) return
    setFormError('')
    form.reset(employee ? { name: employee.name, email: employee.email, phone: employee.phone, role: employee.role, department: employee.department, joiningDate: employee.joiningDate, specialization: employee.specialization ?? '' } : { name: '', email: '', phone: '', role: 'COUNSELOR', department: 'Admissions', joiningDate: today(), specialization: '' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, employee])
  const busy = create.isPending || update.isPending
  const submit = form.handleSubmit(async (v) => {
    setFormError('')
    try {
      if (editing) await update.mutateAsync({ id: employee!.id, body: v })
      else await create.mutateAsync(v)
      onClose()
    } catch (e) {
      setFormError(applyServerErrors(form, e))
    }
  })
  const e = form.formState.errors
  const roleOptions = ROLES.filter((r) => r !== 'SUPER_ADMIN' || user?.role === 'SUPER_ADMIN').map((r) => ({ value: r, label: ROLE_LABELS[r] }))
  return (
    <Dialog
      open={open}
      onClose={onClose}
      locked={busy}
      size="lg"
      title={editing ? `Edit employee — ${employee!.name}` : 'Add employee'}
      description={editing ? employee!.id : 'The employee receives a temporary password and signs in with their work email.'}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button onClick={submit} loading={busy}>{editing ? 'Save changes' : 'Add employee'}</Button>
        </>
      }
    >
      <form onSubmit={submit} noValidate className="space-y-4">
        <FormError message={formError} />
        <FormGrid>
          <FormInput label="Full name" required error={e.name?.message} {...form.register('name')} />
          <FormInput label="Work email" type="email" required error={e.email?.message} {...form.register('email')} />
          <FormInput label="Phone" required inputMode="tel" error={e.phone?.message} {...form.register('phone')} />
          <FormInput label="Joining date" type="date" required max={today()} error={e.joiningDate?.message} {...form.register('joiningDate')} />
          <FormSelect label="Role" required options={roleOptions} error={e.role?.message} {...form.register('role')} />
          <FormSelect label="Department" required placeholder="Select…" options={DEPARTMENTS.map((d) => ({ value: d, label: d }))} error={e.department?.message} {...form.register('department')} />
        </FormGrid>
        {role === 'TRAINER' && <FormInput label="Specialization" placeholder="e.g. C#, ASP.NET Core, Azure" {...form.register('specialization')} />}
      </form>
    </Dialog>
  )
}

export default function EmployeesPage() {
  const state = useListState({ sort: 'name' })
  const { data, isLoading, isFetching, error, refetch } = useEmployees(state.params)
  const { can, user } = useAuth()
  const confirm = useConfirm()
  const setStatus = useSetEmployeeStatus()
  const [form, setForm] = useState<{ open: boolean; employee: Employee | null }>({ open: false, employee: null })

  const columns: Column<Employee>[] = [
    { key: 'name', header: 'Employee', sortKey: 'name', cell: (e) => <div className="flex items-center gap-3"><Avatar name={e.name} size="sm" /><div><p className="font-medium text-slate-900">{e.name}</p><p className="text-xs text-slate-500">{e.id} · {e.email}</p></div></div> },
    { key: 'phone', header: 'Phone', hideBelow: 'lg', cell: (e) => formatPhone(e.phone) },
    { key: 'role', header: 'Role', sortKey: 'role', cell: (e) => ROLE_LABELS[e.role] },
    { key: 'dept', header: 'Department', sortKey: 'department', hideBelow: 'md', cell: (e) => e.department },
    { key: 'joined', header: 'Joined', sortKey: 'joiningDate', hideBelow: 'lg', cell: (e) => formatDate(e.joiningDate) },
    { key: 'status', header: 'Status', sortKey: 'status', cell: (e) => <StatusBadge status={e.status} /> },
  ]

  return (
    <>
      <PageHeader
        title="Employees"
        description="Staff accounts and roles. Deactivating an employee keeps all of their historical records."
        actions={<Can permission="employees:create"><Button onClick={() => setForm({ open: true, employee: null })}><Plus className="h-4 w-4" aria-hidden /> Add employee</Button></Can>}
      />
      <ListFilters
        state={state}
        searchPlaceholder="Search name, email, ID…"
        selects={[
          { key: 'role', label: 'Role', options: ROLES.map((r) => ({ value: r, label: ROLE_LABELS[r] })) },
          { key: 'department', label: 'Department', options: DEPARTMENTS.map((d) => ({ value: d, label: d })) },
          { key: 'status', label: 'Status', options: optionsFrom(ACTIVE_STATES) },
        ]}
      />
      <DataTable
        caption="Employees"
        columns={columns}
        rows={data?.items}
        rowKey={(e) => e.id}
        isLoading={isLoading}
        isFetching={isFetching}
        error={error}
        onRetry={refetch}
        sort={{ key: state.sort, order: state.order, onSort: state.toggleSort }}
        pagination={{ page: state.page, pageSize: state.pageSize, total: data?.total ?? 0, onPageChange: state.setPage, onPageSizeChange: state.setPageSize }}
        rowClassName={(e) => (e.status === 'INACTIVE' ? 'opacity-60' : undefined)}
        rowActions={(e) => [
          { label: 'Edit employee', icon: <Pencil />, hidden: !can('employees:update'), onSelect: () => setForm({ open: true, employee: e }) },
          e.status === 'ACTIVE'
            ? { label: 'Deactivate', icon: <Power />, danger: true, separatorBefore: true, hidden: !can('employees:update'), disabled: e.id === user?.id, onSelect: () => confirm({ title: `Deactivate ${e.name}?`, description: 'They will no longer be able to sign in. Their leads, payments and audit history are kept.', reason: { label: 'Reason (optional)' }, tone: 'danger', confirmLabel: 'Deactivate', run: (reason) => setStatus.mutateAsync({ id: e.id, status: 'INACTIVE', reason }) }) }
            : { label: 'Activate', icon: <Power />, hidden: !can('employees:update'), onSelect: () => setStatus.mutate({ id: e.id, status: 'ACTIVE' }) },
        ]}
      />
      <EmployeeFormDialog open={form.open} employee={form.employee} onClose={() => setForm({ open: false, employee: null })} />
    </>
  )
}
