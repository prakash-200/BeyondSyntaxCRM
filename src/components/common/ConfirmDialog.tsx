import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'
import { getErrorMessage } from '@/api/apiClient'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Label, Textarea } from '@/components/ui/input'

export interface ConfirmOptions {
  title: string
  description?: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  tone?: 'danger' | 'primary'
  /** Ask for a justification (stored in the audit log). */
  reason?: { label?: string; placeholder?: string; required?: boolean }
  /** Optional async action: the dialog shows a spinner and any error, and only closes on success. */
  run?: (reason: string) => Promise<unknown>
}

type Confirm = (options: ConfirmOptions) => Promise<{ reason: string } | null>

const ConfirmContext = createContext<Confirm | null>(null)

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null)
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const resolver = useRef<((v: { reason: string } | null) => void) | null>(null)

  const confirm = useCallback<Confirm>((opts) => {
    setReason('')
    setError(null)
    setOptions(opts)
    return new Promise((resolve) => {
      resolver.current = resolve
    })
  }, [])

  const finish = (value: { reason: string } | null) => {
    resolver.current?.(value)
    resolver.current = null
    setOptions(null)
  }

  const needsReason = options?.reason?.required && !reason.trim()

  const submit = async () => {
    if (!options) return
    if (options.run) {
      setBusy(true)
      setError(null)
      try {
        await options.run(reason.trim())
        finish({ reason: reason.trim() })
      } catch (e) {
        setError(getErrorMessage(e))
      } finally {
        setBusy(false)
      }
    } else finish({ reason: reason.trim() })
  }

  const value = useMemo(() => confirm, [confirm])

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      <Dialog
        open={!!options}
        onClose={() => finish(null)}
        locked={busy}
        size="sm"
        title={options?.title ?? ''}
        description={options?.description}
        footer={
          <>
            <Button variant="outline" onClick={() => finish(null)} disabled={busy}>
              {options?.cancelLabel ?? 'Cancel'}
            </Button>
            <Button variant={options?.tone === 'danger' ? 'danger' : 'primary'} onClick={submit} loading={busy} disabled={!!needsReason}>
              {options?.confirmLabel ?? 'Confirm'}
            </Button>
          </>
        }
      >
        {options?.reason && (
          <div>
            <Label htmlFor="confirm-reason" required={options.reason.required}>
              {options.reason.label ?? 'Reason'}
            </Label>
            <Textarea id="confirm-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder={options.reason.placeholder ?? 'Add a short justification…'} autoFocus />
          </div>
        )}
        {error && (
          <p role="alert" className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
      </Dialog>
    </ConfirmContext.Provider>
  )
}

export function useConfirm(): Confirm {
  const ctx = useContext(ConfirmContext)
  if (!ctx) throw new Error('useConfirm must be used inside <ConfirmProvider>')
  return ctx
}
