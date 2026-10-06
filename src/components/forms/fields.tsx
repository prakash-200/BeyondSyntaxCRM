import { useId, type InputHTMLAttributes, type ReactNode, type Ref, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { Input, Label, Select, Textarea } from '@/components/ui/input'
import { cn } from '@/utils/cn'

interface FieldChrome {
  label: string
  error?: string
  hint?: ReactNode
  required?: boolean
  wrapperClassName?: string
}

function Chrome({ id, label, error, hint, required, wrapperClassName, children }: FieldChrome & { id: string; children: ReactNode }) {
  return (
    <div className={wrapperClassName}>
      <Label htmlFor={id} required={required}>
        {label}
      </Label>
      {children}
      {hint && !error && (
        <p id={`${id}-hint`} className="mt-1 text-xs text-slate-500">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} role="alert" className="mt-1 text-xs font-medium text-red-600">
          {error}
        </p>
      )}
    </div>
  )
}

const describedBy = (id: string, error?: string, hint?: ReactNode) => (error ? `${id}-error` : hint ? `${id}-hint` : undefined)

export function FormInput({ label, error, hint, required, wrapperClassName, id, className, ref, ...props }: FieldChrome & InputHTMLAttributes<HTMLInputElement> & { ref?: Ref<HTMLInputElement> }) {
  const generated = useId()
  const fid = id ?? generated
  return (
    <Chrome id={fid} label={label} error={error} hint={hint} required={required} wrapperClassName={wrapperClassName}>
      <Input ref={ref} id={fid} aria-invalid={!!error} aria-describedby={describedBy(fid, error, hint)} aria-required={required} className={className} {...props} />
    </Chrome>
  )
}

export function FormTextarea({ label, error, hint, required, wrapperClassName, id, className, ref, ...props }: FieldChrome & TextareaHTMLAttributes<HTMLTextAreaElement> & { ref?: Ref<HTMLTextAreaElement> }) {
  const generated = useId()
  const fid = id ?? generated
  return (
    <Chrome id={fid} label={label} error={error} hint={hint} required={required} wrapperClassName={wrapperClassName}>
      <Textarea ref={ref} id={fid} aria-invalid={!!error} aria-describedby={describedBy(fid, error, hint)} aria-required={required} className={className} {...props} />
    </Chrome>
  )
}

export interface Option {
  value: string
  label: string
}

export function FormSelect({
  label,
  error,
  hint,
  required,
  wrapperClassName,
  id,
  options,
  placeholder,
  className,
  ref,
  ...props
}: FieldChrome & SelectHTMLAttributes<HTMLSelectElement> & { options: Option[]; placeholder?: string; ref?: Ref<HTMLSelectElement> }) {
  const generated = useId()
  const fid = id ?? generated
  return (
    <Chrome id={fid} label={label} error={error} hint={hint} required={required} wrapperClassName={wrapperClassName}>
      <Select ref={ref} id={fid} aria-invalid={!!error} aria-describedby={describedBy(fid, error, hint)} aria-required={required} className={className} {...props}>
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </Select>
    </Chrome>
  )
}

/** Grid wrapper for form layouts. */
export function FormGrid({ children, columns = 2, className }: { children: ReactNode; columns?: 1 | 2 | 3; className?: string }) {
  return <div className={cn('grid gap-4', columns === 1 && 'grid-cols-1', columns === 2 && 'grid-cols-1 sm:grid-cols-2', columns === 3 && 'grid-cols-1 sm:grid-cols-3', className)}>{children}</div>
}

export function FormError({ message }: { message?: string | null }) {
  if (!message) return null
  return (
    <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
      {message}
    </p>
  )
}
