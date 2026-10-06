import { zodResolver } from '@hookform/resolvers/zod'
import { RotateCcw } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { PageHeader } from '@/components/common/PageHeader'
import { ErrorState, LoadingState } from '@/components/common/States'
import { FormError, FormGrid, FormInput, FormTextarea } from '@/components/forms/fields'
import { applyServerErrors } from '@/components/forms/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { USE_MOCK_API, API_BASE_URL } from '@/api/apiClient'
import { useAuth } from '@/features/auth/AuthContext'
import { useSettings, useUpdateSettings } from './hooks'

const schema = z.object({
  companyName: z.string().trim().min(2, 'Required'),
  legalName: z.string().trim().min(2, 'Required'),
  address: z.string().trim().min(5, 'Enter the registered address'),
  phone: z.string().trim().min(5, 'Required'),
  email: z.string().trim().email('Enter a valid email address'),
  gstin: z.string().trim().refine((v) => v === '' || /^\d{2}[A-Z]{5}\d{4}[A-Z]\dZ[A-Z\d]$/.test(v), 'Invalid GSTIN format'),
  taxRate: z.number({ message: 'Enter 0 if no GST applies' }).min(0).max(28, 'Maximum 28%'),
  invoicePrefix: z.string().trim().min(2).max(6),
  minAttendanceAlert: z.number({ message: 'Enter a percentage' }).min(0).max(100),
  certificateMinProgress: z.number({ message: 'Enter a percentage' }).min(0).max(100),
})
type Values = z.infer<typeof schema>

export default function SettingsPage() {
  const { can } = useAuth()
  const { data, isLoading, error, refetch } = useSettings()
  const update = useUpdateSettings()
  const [formError, setFormError] = useState('')
  const canEdit = can('settings:update')
  const form = useForm<Values>({ resolver: zodResolver(schema) })
  useEffect(() => {
    if (data) form.reset(data)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data])
  if (isLoading) return <LoadingState />
  if (error || !data) return <ErrorState error={error} onRetry={refetch} />
  const e = form.formState.errors
  const submit = form.handleSubmit(async (v) => {
    setFormError('')
    try {
      await update.mutateAsync(v)
    } catch (err) {
      setFormError(applyServerErrors(form, err))
    }
  })

  return (
    <>
      <PageHeader
        title="Settings"
        description="Company details used on invoices and certificates, plus business thresholds."
        actions={canEdit && <Button onClick={submit} loading={update.isPending} disabled={!form.formState.isDirty}>Save settings</Button>}
      />
      <form onSubmit={submit} noValidate className="space-y-4">
        <FormError message={formError} />
        <fieldset disabled={!canEdit} className="space-y-4">
          <Card>
            <CardHeader title="Company" description="Shown on invoices and certificates" />
            <CardContent>
              <FormGrid>
                <FormInput label="Display name" error={e.companyName?.message} {...form.register('companyName')} />
                <FormInput label="Legal name" error={e.legalName?.message} {...form.register('legalName')} />
                <FormTextarea label="Registered address" wrapperClassName="sm:col-span-2" error={e.address?.message} {...form.register('address')} />
                <FormInput label="Phone" error={e.phone?.message} {...form.register('phone')} />
                <FormInput label="Accounts email" type="email" error={e.email?.message} {...form.register('email')} />
              </FormGrid>
            </CardContent>
          </Card>
          <Card>
            <CardHeader title="Billing" />
            <CardContent>
              <FormGrid columns={3}>
                <FormInput label="GSTIN" placeholder="29ABCDE1234F1Z5" error={e.gstin?.message} {...form.register('gstin')} />
                <FormInput label="GST rate (%)" type="number" step="0.5" hint="Applied (tax-inclusive) to new invoices. 0 = no GST." error={e.taxRate?.message} {...form.register('taxRate', { valueAsNumber: true })} />
                <FormInput label="Invoice prefix" error={e.invoicePrefix?.message} {...form.register('invoicePrefix')} />
              </FormGrid>
            </CardContent>
          </Card>
          <Card>
            <CardHeader title="Training rules" />
            <CardContent>
              <FormGrid>
                <FormInput label="Low-attendance alert below (%)" type="number" error={e.minAttendanceAlert?.message} {...form.register('minAttendanceAlert', { valueAsNumber: true })} />
                <FormInput label="Minimum progress for certificates (%)" type="number" hint="Below this, completing a course or issuing a certificate needs an override reason." error={e.certificateMinProgress?.message} {...form.register('certificateMinProgress', { valueAsNumber: true })} />
              </FormGrid>
            </CardContent>
          </Card>
        </fieldset>
      </form>
      <Card className="mt-4">
        <CardHeader title="Environment" description="Read-only" />
        <CardContent className="space-y-3 text-sm">
          <p>
            Data source: <strong>{USE_MOCK_API ? 'In-browser mock API (demo data)' : `ASP.NET Core API at ${API_BASE_URL}`}</strong>
          </p>
          {USE_MOCK_API && (
            <>
              <p className="text-slate-600">Mock data lives in memory. Reloading the page restores the original demo dataset.</p>
              <Button variant="outline" onClick={() => window.location.reload()}>
                <RotateCcw className="h-4 w-4" aria-hidden /> Reset demo data
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </>
  )
}
