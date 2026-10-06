import type { FieldValues, Path, UseFormReturn } from 'react-hook-form'
import { ApiError, getErrorMessage } from '@/api/apiClient'

/** Map ASP.NET-style field errors onto the form; returns a general message for the rest. */
export function applyServerErrors<T extends FieldValues>(form: UseFormReturn<T>, error: unknown): string {
  if (error instanceof ApiError && error.errors) {
    for (const [field, messages] of Object.entries(error.errors)) {
      const name = (field.charAt(0).toLowerCase() + field.slice(1)) as Path<T>
      if (name in form.getValues()) form.setError(name, { type: 'server', message: messages[0] })
    }
    if (Object.keys(error.errors).every((f) => (f.charAt(0).toLowerCase() + f.slice(1)) in form.getValues())) return ''
  }
  return getErrorMessage(error)
}

export const PHONE_REGEX = /^(\+91[\s-]?)?[6-9]\d{9}$/
export const PHONE_MESSAGE = 'Enter a valid 10-digit Indian mobile number'
