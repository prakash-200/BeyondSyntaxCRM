import { zodResolver } from '@hookform/resolvers/zod'
import { Upload } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { FormError, FormGrid, FormInput, FormSelect } from '@/components/forms/fields'
import { applyServerErrors, PHONE_MESSAGE, PHONE_REGEX } from '@/components/forms/utils'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { EDUCATION_LEVELS, GENDERS, LEAD_SOURCES } from '@/constants/enums'
import { optionsFrom } from '@/constants/labels'
import { useLookups } from '@/hooks/useLookups'
import type { ImportResult, ImportRow, Student } from '@/types'
import { today } from '@/utils/clock'
import { parseCsv } from '@/utils/csv'
import { useCreateStudent, useImportStudents, useUpdateStudent } from './hooks'

const year = new Date().getFullYear()
const schema = z.object({
  fullName: z.string().trim().min(2, 'Enter the full name').max(80),
  phone: z.string().trim().regex(PHONE_REGEX, PHONE_MESSAGE),
  email: z.string().trim().min(1, 'Email is required').email('Enter a valid email address'),
  dateOfBirth: z.string().refine((d) => d === '' || d < today(), 'Date of birth must be in the past'),
  gender: z.enum(GENDERS),
  address: z.string().trim().max(200),
  city: z.string().trim().max(60),
  state: z.string().trim().max(60),
  postalCode: z.string().trim().refine((v) => v === '' || /^\d{6}$/.test(v), 'Postal code must be 6 digits'),
  education: z.string(),
  college: z.string().trim().max(120),
  graduationYear: z.number({ message: 'Enter a valid year' }).int().min(1980, 'Enter a valid year').max(year + 6, 'Enter a valid year'),
  experience: z.string().trim().max(80),
  currentOccupation: z.string().trim().max(80),
  source: z.enum(LEAD_SOURCES),
  counselorId: z.string().min(1, 'Select a counselor'),
  courseId: z.string().min(1, 'Select a course'),
})
type Values = z.infer<typeof schema>

const EMPTY: Values = { fullName: '', phone: '', email: '', dateOfBirth: '', gender: 'MALE', address: '', city: '', state: '', postalCode: '', education: '', college: '', graduationYear: year, experience: 'Fresher', currentOccupation: '', source: 'WALK_IN', counselorId: '', courseId: '' }

export function StudentFormDialog({ open, onClose, student }: { open: boolean; onClose: () => void; student?: Student | null }) {
  const { courseOptions, employeeOptions } = useLookups()
  const create = useCreateStudent()
  const update = useUpdateStudent()
  const [formError, setFormError] = useState('')
  const editing = !!student
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: EMPTY })

  useEffect(() => {
    if (!open) return
    setFormError('')
    form.reset(student ? { ...EMPTY, ...student, graduationYear: student.graduationYear } : EMPTY)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, student])

  const busy = create.isPending || update.isPending
  const submit = form.handleSubmit(async (v) => {
    setFormError('')
    try {
      if (editing) {
        const { courseId: _courseId, ...body } = v
        void _courseId
        await update.mutateAsync({ id: student!.id, body })
      } else await create.mutateAsync(v)
      onClose()
    } catch (e) {
      setFormError(applyServerErrors(form, e))
    }
  })
  const e = form.formState.errors

  return (
    <Dialog
      open={open}
      onClose={onClose}
      locked={busy}
      size="xl"
      title={editing ? `Edit student — ${student!.fullName}` : 'Add student'}
      description={editing ? student!.id : 'Direct admission (for walk-ins). Students from leads are created when admission is approved.'}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={submit} loading={busy}>
            {editing ? 'Save changes' : 'Create student'}
          </Button>
        </>
      }
    >
      <form onSubmit={submit} noValidate className="space-y-6">
        <FormError message={formError} />
        <section aria-labelledby="sec-personal">
          <h3 id="sec-personal" className="mb-3 text-sm font-semibold text-slate-900">
            Personal details
          </h3>
          <FormGrid columns={3}>
            <FormInput label="Full name" required error={e.fullName?.message} {...form.register('fullName')} />
            <FormInput label="Phone" required inputMode="tel" error={e.phone?.message} {...form.register('phone')} />
            <FormInput label="Email" type="email" required error={e.email?.message} {...form.register('email')} />
            <FormInput label="Date of birth" type="date" max={today()} error={e.dateOfBirth?.message} {...form.register('dateOfBirth')} />
            <FormSelect label="Gender" options={optionsFrom(GENDERS)} {...form.register('gender')} />
            <FormInput label="Postal code" inputMode="numeric" error={e.postalCode?.message} {...form.register('postalCode')} />
            <FormInput label="Address" wrapperClassName="sm:col-span-3" error={e.address?.message} {...form.register('address')} />
            <FormInput label="City" {...form.register('city')} />
            <FormInput label="State" {...form.register('state')} />
          </FormGrid>
        </section>
        <section aria-labelledby="sec-edu">
          <h3 id="sec-edu" className="mb-3 text-sm font-semibold text-slate-900">
            Education & experience
          </h3>
          <FormGrid columns={3}>
            <FormSelect label="Education" placeholder="Select…" options={EDUCATION_LEVELS.map((v) => ({ value: v, label: v }))} {...form.register('education')} />
            <FormInput label="College / University" error={e.college?.message} {...form.register('college')} />
            <FormInput label="Graduation year" type="number" error={e.graduationYear?.message} {...form.register('graduationYear', { valueAsNumber: true })} />
            <FormInput label="Experience" placeholder="Fresher, 2 years…" {...form.register('experience')} />
            <FormInput label="Current occupation" {...form.register('currentOccupation')} />
          </FormGrid>
        </section>
        <section aria-labelledby="sec-adm">
          <h3 id="sec-adm" className="mb-3 text-sm font-semibold text-slate-900">
            Admission
          </h3>
          <FormGrid columns={3}>
            <FormSelect label="Course" required placeholder="Select…" options={courseOptions} disabled={editing} hint={editing ? 'Course is fixed after admission' : undefined} error={e.courseId?.message} {...form.register('courseId')} />
            <FormSelect label="Source" options={optionsFrom(LEAD_SOURCES)} {...form.register('source')} />
            <FormSelect label="Assigned counselor" required placeholder="Select…" options={employeeOptions('COUNSELOR')} error={e.counselorId?.message} {...form.register('counselorId')} />
          </FormGrid>
        </section>
      </form>
    </Dialog>
  )
}

/* ───────────── CSV import ───────────── */

const HEADER_ALIASES: Record<keyof ImportRow, string[]> = {
  fullName: ['fullname', 'name', 'student', 'studentname'],
  phone: ['phone', 'mobile', 'phonenumber'],
  email: ['email', 'emailid'],
  courseCode: ['course', 'coursecode', 'coursename'],
  city: ['city', 'location'],
}

export function parseStudentCsv(text: string): ImportRow[] {
  const [header, ...rows] = parseCsv(text)
  if (!header) return []
  const norm = header.map((h) => h.toLowerCase().replace(/[^a-z]/g, ''))
  const idx = (k: keyof ImportRow) => norm.findIndex((h) => HEADER_ALIASES[k].includes(h))
  const map = { fullName: idx('fullName'), phone: idx('phone'), email: idx('email'), courseCode: idx('courseCode'), city: idx('city') }
  return rows.map((r) => ({ fullName: r[map.fullName] ?? '', phone: r[map.phone] ?? '', email: r[map.email] ?? '', courseCode: map.courseCode >= 0 ? r[map.courseCode] : undefined, city: map.city >= 0 ? r[map.city] : undefined }))
}

export function ImportStudentsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const imp = useImportStudents()
  const [rows, setRows] = useState<ImportRow[]>([])
  const [fileName, setFileName] = useState('')
  const [result, setResult] = useState<ImportResult | null>(null)
  const [error, setError] = useState('')
  const ref = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setRows([])
      setResult(null)
      setError('')
      setFileName('')
    }
  }, [open])

  const onFile = async (file?: File) => {
    if (!file) return
    setFileName(file.name)
    setResult(null)
    setError('')
    const parsed = parseStudentCsv(await file.text())
    if (!parsed.length) setError('No rows found. The first row must be a header: name, phone, email, course, city.')
    setRows(parsed)
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      locked={imp.isPending}
      title="Import students"
      description="Upload a CSV with columns: name, phone, email, course (code or name), city."
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={imp.isPending}>
            {result ? 'Close' : 'Cancel'}
          </Button>
          {!result && (
            <Button
              disabled={!rows.length}
              loading={imp.isPending}
              onClick={async () => {
                try {
                  setResult(await imp.mutateAsync(rows))
                } catch (e) {
                  setError(e instanceof Error ? e.message : 'Import failed')
                }
              }}
            >
              Import {rows.length || ''} rows
            </Button>
          )}
        </>
      }
    >
      <div className="space-y-4">
        <FormError message={error} />
        <input ref={ref} type="file" accept=".csv,text/csv" className="sr-only" aria-label="Choose CSV file" onChange={(e) => onFile(e.target.files?.[0])} />
        <button type="button" onClick={() => ref.current?.click()} className="flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed border-slate-300 px-4 py-8 text-sm text-slate-600 hover:border-brand-400 hover:bg-brand-50/40">
          <Upload className="h-6 w-6 text-slate-400" aria-hidden />
          {fileName ? <span className="font-medium text-slate-900">{fileName} — {rows.length} rows</span> : <span>Click to choose a .csv file</span>}
        </button>
        {result && (
          <div role="status" className="rounded-lg bg-slate-50 p-4 text-sm">
            <p className="font-medium text-emerald-700">{result.created} students imported.</p>
            {result.skipped.length > 0 && (
              <>
                <p className="mt-2 font-medium text-amber-700">{result.skipped.length} rows skipped:</p>
                <ul className="mt-1 max-h-40 list-disc space-y-0.5 overflow-y-auto pl-5 text-xs text-slate-600">
                  {result.skipped.map((s) => (
                    <li key={s.row}>
                      Row {s.row}: {s.reason}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}
      </div>
    </Dialog>
  )
}
