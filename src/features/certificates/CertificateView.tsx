import { Award } from 'lucide-react'
import { COMPANY_NAME } from '@/constants/config'
import type { Certificate } from '@/types'
import { formatDate } from '@/utils/format'

/** Printable certificate. Landscape layout; later replaceable by a backend-rendered PDF. */
export function CertificateView({ certificate: c }: { certificate: Certificate }) {
  const url = `${window.location.origin}/verify/${c.id}`
  return (
    <article aria-label={`Certificate ${c.id}`} className="print-area mx-auto aspect-[1.414/1] w-full max-w-4xl rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex h-full flex-col items-center justify-between rounded-lg border-4 border-double border-brand-700 px-6 py-8 text-center sm:px-14">
        <div>
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand-50 text-brand-700" aria-hidden>
            <Award className="h-8 w-8" />
          </span>
          <p className="mt-2 text-sm font-semibold uppercase tracking-[0.25em] text-brand-700">{COMPANY_NAME}</p>
        </div>
        <div>
          <h2 className="font-serif text-3xl font-bold tracking-wide text-slate-900 sm:text-5xl">Certificate of Completion</h2>
          <p className="mt-5 text-sm text-slate-500">This is to certify that</p>
          <p className="mt-2 font-serif text-3xl font-semibold text-brand-800 sm:text-4xl">{c.studentName}</p>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-slate-600">
            has successfully completed the programme <strong className="text-slate-900">{c.courseName}</strong>
            {c.batchName && <> (batch {c.batchName})</>} from {formatDate(c.startDate)} to {formatDate(c.completionDate)}.
          </p>
        </div>
        <div className="grid w-full grid-cols-3 items-end gap-4 text-xs text-slate-500">
          <div className="text-left">
            <p className="font-medium text-slate-900">{formatDate(c.issuedDate)}</p>
            <p className="border-t border-slate-300 pt-1">Date of issue</p>
          </div>
          <div>
            <p className="font-mono text-[11px] font-semibold text-slate-900">{c.id}</p>
            <p className="break-all text-[10px]">Verify: {url}</p>
          </div>
          <div className="text-right">
            <p className="font-medium text-slate-900">{c.issuedByName}</p>
            <p className="border-t border-slate-300 pt-1">Authorised signatory</p>
          </div>
        </div>
      </div>
    </article>
  )
}
