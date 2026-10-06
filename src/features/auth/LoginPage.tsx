import { zodResolver } from '@hookform/resolvers/zod'
import { Eye, EyeOff, GraduationCap, Lock, Mail } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { z } from 'zod'
import { authApi } from '@/api/authApi'
import { getErrorMessage } from '@/api/apiClient'
import { FormError, FormInput } from '@/components/forms/fields'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Checkbox } from '@/components/ui/input'
import { APP_NAME, COMPANY_NAME } from '@/constants/config'
import { useAuth } from './AuthContext'

const schema = z.object({
  email: z.string().min(1, 'Email is required').email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
  remember: z.boolean(),
})
type Values = z.infer<typeof schema>

const DEMO_ACCOUNTS = [
  { role: 'Super Admin', email: 'superadmin@company.com' },
  { role: 'Admin', email: 'admin@company.com' },
  { role: 'Counselor', email: 'counselor@company.com' },
  { role: 'Accountant', email: 'accountant@company.com' },
  { role: 'Trainer', email: 'trainer@company.com' },
]

function ForgotPassword({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [busy, setBusy] = useState(false)
  const form = useForm<{ email: string }>({ resolver: zodResolver(z.object({ email: z.string().min(1, 'Email is required').email('Enter a valid email address') })) })
  const submit = form.handleSubmit(async ({ email }) => {
    setBusy(true)
    try {
      await authApi.forgotPassword(email)
      toast.success('If an account exists for that email, a reset link has been sent.')
      onClose()
      form.reset()
    } catch (e) {
      toast.error(getErrorMessage(e))
    } finally {
      setBusy(false)
    }
  })
  return (
    <Dialog
      open={open}
      onClose={onClose}
      locked={busy}
      size="sm"
      title="Reset your password"
      description="Enter your work email and we’ll send reset instructions."
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={submit} loading={busy}>
            Send reset link
          </Button>
        </>
      }
    >
      <form onSubmit={submit} noValidate>
        <FormInput label="Work email" type="email" autoComplete="email" error={form.formState.errors.email?.message} {...form.register('email')} />
      </form>
    </Dialog>
  )
}

export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [showPassword, setShowPassword] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [forgot, setForgot] = useState(false)

  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { email: '', password: '', remember: true } })
  const { errors, isSubmitting } = form.formState

  const onSubmit = form.handleSubmit(async (values) => {
    setServerError(null)
    try {
      await login(values)
      const from = (location.state as { from?: string } | null)?.from
      navigate(from && from !== '/login' ? from : '/dashboard', { replace: true })
    } catch (e) {
      setServerError(getErrorMessage(e))
    }
  })

  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-brand-950 p-12 text-white lg:flex">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10">
            <GraduationCap className="h-6 w-6" aria-hidden />
          </span>
          <span className="text-lg font-semibold">{COMPANY_NAME}</span>
        </div>
        <div>
          <h2 className="max-w-md text-3xl font-semibold leading-tight">Run admissions, batches, fees and certification from one place.</h2>
          <ul className="mt-6 max-w-md space-y-3 text-sm text-brand-200">
            <li>• Lead-to-certificate lifecycle with full audit history</li>
            <li>• Role-based access for counselors, accountants and trainers</li>
            <li>• Installments, invoices and payment tracking in INR</li>
          </ul>
        </div>
        <p className="text-xs text-brand-300">© {new Date().getFullYear()} {COMPANY_NAME}. Internal use only.</p>
        <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-brand-600/30 blur-3xl" aria-hidden />
      </div>

      <div className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 text-white">
              <GraduationCap className="h-6 w-6" aria-hidden />
            </span>
            <span className="text-lg font-semibold">{COMPANY_NAME}</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Sign in</h1>
          <p className="mt-1 text-sm text-slate-500">Welcome back to the {APP_NAME}. Use your employee account.</p>

          <form onSubmit={onSubmit} noValidate className="mt-6 space-y-4">
            <FormError message={serverError} />
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-[34px] h-4 w-4 text-slate-400" aria-hidden />
              <FormInput label="Email" type="email" autoComplete="email" placeholder="you@company.com" className="pl-9" error={errors.email?.message} {...form.register('email')} />
            </div>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-[34px] h-4 w-4 text-slate-400" aria-hidden />
              <FormInput label="Password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" className="px-9" error={errors.password?.message} {...form.register('password')} />
              <button type="button" onClick={() => setShowPassword((s) => !s)} className="absolute right-2 top-[28px] rounded p-1.5 text-slate-400 hover:text-slate-700" aria-label={showPassword ? 'Hide password' : 'Show password'}>
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <Checkbox {...form.register('remember')} /> Remember me
              </label>
              <button type="button" onClick={() => setForgot(true)} className="text-sm font-medium text-brand-700 hover:underline">
                Forgot password?
              </button>
            </div>
            <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>
              {isSubmitting ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>

          <div className="mt-8 rounded-xl border border-dashed border-slate-300 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Demo accounts</p>
            <p className="mt-1 text-xs text-slate-500">
              Password for all: <code className="rounded bg-slate-100 px-1 py-0.5">Password@123</code>
            </p>
            <ul className="mt-3 space-y-1.5">
              {DEMO_ACCOUNTS.map((a) => (
                <li key={a.email} className="flex items-center justify-between gap-2 text-sm">
                  <span>
                    <span className="font-medium text-slate-800">{a.role}</span>
                    <span className="block text-xs text-slate-500">{a.email}</span>
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      form.setValue('email', a.email, { shouldValidate: true })
                      form.setValue('password', 'Password@123', { shouldValidate: true })
                    }}
                  >
                    Use
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
      <ForgotPassword open={forgot} onClose={() => setForgot(false)} />
    </div>
  )
}
