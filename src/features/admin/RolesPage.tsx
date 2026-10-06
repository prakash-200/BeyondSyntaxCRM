import { Lock } from 'lucide-react'
import { useEffect, useState } from 'react'
import { PageHeader } from '@/components/common/PageHeader'
import { ErrorState, LoadingState } from '@/components/common/States'
import { Button } from '@/components/ui/button'
import { ROLES, type Role } from '@/constants/enums'
import { ACTIONS, ACTION_LABELS, RESOURCES, RESOURCE_LABELS, ROLE_LABELS, type Action, type Permission } from '@/constants/permissions'
import { useAuth } from '@/features/auth/AuthContext'
import { cn } from '@/utils/cn'
import { toast } from 'sonner'
import { useRoles, useUpdateRole } from './hooks'

const SHORT: Record<Action, string> = { view: 'V', create: 'C', update: 'U', delete: 'D', approve: 'A' }

export default function RolesPage() {
  const { can, refresh } = useAuth()
  const { data, isLoading, error, refetch } = useRoles()
  const update = useUpdateRole()
  const canEdit = can('roles:update')
  const [draft, setDraft] = useState<Record<string, Set<Permission>>>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (data) setDraft(Object.fromEntries(data.map((r) => [r.role, new Set(r.permissions)])))
  }, [data])

  if (isLoading) return <LoadingState />
  if (error || !data) return <ErrorState error={error} onRetry={refetch} />

  const changedRoles = data.filter((r) => {
    const d = draft[r.role]
    return d && (d.size !== r.permissions.length || r.permissions.some((p) => !d.has(p)))
  })

  const toggle = (role: Role, p: Permission) =>
    setDraft((prev) => {
      const next = new Set(prev[role])
      if (next.has(p)) next.delete(p)
      else next.add(p)
      return { ...prev, [role]: next }
    })

  const save = async () => {
    setSaving(true)
    try {
      for (const r of changedRoles) await update.mutateAsync({ role: r.role, permissions: [...draft[r.role]] })
      await refresh()
      toast.success(`Permissions updated for ${changedRoles.map((r) => ROLE_LABELS[r.role]).join(', ')}`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Unable to save permissions')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <PageHeader
        title="Roles & permissions"
        description="What each role can do. V = view, C = create, U = update, D = delete, A = approve / issue. Changes are enforced by the API and written to the audit log."
        actions={
          canEdit && (
            <>
              <Button variant="outline" disabled={!changedRoles.length || saving} onClick={() => data && setDraft(Object.fromEntries(data.map((r) => [r.role, new Set(r.permissions)])))}>Discard</Button>
              <Button loading={saving} disabled={!changedRoles.length} onClick={save}>Save changes{changedRoles.length ? ` (${changedRoles.length})` : ''}</Button>
            </>
          )
        }
      />
      {!canEdit && <p className="mb-4 rounded-lg bg-slate-100 px-4 py-2.5 text-sm text-slate-600">View only — only a Super Admin can change permissions.</p>}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[900px] text-left text-sm">
          <caption className="sr-only">Permission matrix</caption>
          <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th scope="col" className="sticky left-0 z-10 bg-slate-50 px-5 py-3">Module</th>
              {data.map((r) => (
                <th key={r.role} scope="col" className="px-3 py-3 text-center">
                  {r.label}
                  <span className="block text-[10px] font-normal normal-case text-slate-400">{r.employeeCount} active</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {RESOURCES.map((res) => (
              <tr key={res}>
                <th scope="row" className="sticky left-0 z-10 bg-white px-5 py-2.5 font-medium text-slate-800">{RESOURCE_LABELS[res]}</th>
                {ROLES.map((role) => {
                  const locked = role === 'SUPER_ADMIN' || !canEdit
                  return (
                    <td key={role} className="px-3 py-2.5">
                      <div className="flex justify-center gap-1">
                        {ACTIONS.map((a) => {
                          const p = `${res}:${a}` as Permission
                          const on = draft[role]?.has(p) ?? false
                          return (
                            <button
                              key={a}
                              type="button"
                              disabled={locked}
                              aria-pressed={on}
                              aria-label={`${ROLE_LABELS[role]} — ${ACTION_LABELS[a]} ${RESOURCE_LABELS[res]}`}
                              title={`${ACTION_LABELS[a]} ${RESOURCE_LABELS[res]}`}
                              onClick={() => toggle(role, p)}
                              className={cn('h-6 w-6 rounded text-[11px] font-semibold transition-colors', on ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-400', !locked && !on && 'hover:bg-slate-200', locked && 'cursor-default')}
                            >
                              {SHORT[a]}
                              <span className="sr-only">{on ? ' granted' : ' not granted'}</span>
                            </button>
                          )
                        })}
                      </div>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-500">
        <Lock className="h-3.5 w-3.5" aria-hidden /> Super Admin always has full access and cannot be edited. Trainers only see batches and students assigned to them regardless of permissions.
      </p>
    </>
  )
}
