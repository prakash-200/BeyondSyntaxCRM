import { BadgeCheck, GraduationCap, ShieldX } from 'lucide-react'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { LoadingState } from '@/components/common/States'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DescriptionList } from '@/components/ui/misc'
import { COMPANY_NAME } from '@/constants/config'
import { formatDate } from '@/utils/format'
import { useVerifyCertificate } from './hooks'

/** Public page — no authentication. Anyone with the certificate ID can confirm it is genuine. */
export default function VerifyCertificatePage() {
  const { certificateId = '' } = useParams()
  const navigate = useNavigate()
  const [value, setValue] = useState(certificateId)
  const { data, isLoading, error } = useVerifyCertificate(certificateId)

  return (
    <div className="min-h-dvh bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-6 py-4">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-white" aria-hidden>
            <GraduationCap className="h-5 w-5" />
          </span>
          <div>
            <p className="text-sm font-semibold">{COMPANY_NAME}</p>
            <p className="text-xs text-slate-500">Certificate verification</p>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="text-2xl font-semibold tracking-tight">Verify a certificate</h1>
        <p className="mt-1 text-sm text-slate-500">Enter the certificate ID printed on the certificate, e.g. CERT-DOTNET-2026-00125.</p>
        <form
          className="mt-5 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (value.trim()) navigate(`/verify/${encodeURIComponent(value.trim())}`)
          }}
        >
          <Input aria-label="Certificate ID" value={value} onChange={(e) => setValue(e.target.value)} placeholder="CERT-…" className="font-mono" />
          <Button type="submit">Verify</Button>
        </form>

        <div className="mt-8" aria-live="polite">
          {certificateId && isLoading && <LoadingState label="Checking certificate…" />}
          {certificateId && !isLoading && (error || !data?.valid) && (
            <div role="alert" className="flex gap-4 rounded-xl border border-red-200 bg-red-50 p-6">
              <ShieldX className="h-8 w-8 shrink-0 text-red-600" aria-hidden />
              <div>
                <p className="font-semibold text-red-800">Certificate not found</p>
                <p className="mt-1 text-sm text-red-700">We could not find a certificate with ID “{certificateId}”. Check the ID and try again.</p>
              </div>
            </div>
          )}
          {data?.valid && data.certificate && (
            <div className="rounded-xl border border-emerald-200 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-3">
                <BadgeCheck className="h-8 w-8 text-emerald-600" aria-hidden />
                <div>
                  <p className="font-semibold text-emerald-800">Valid certificate</p>
                  <p className="font-mono text-xs text-slate-500">{data.certificate.id}</p>
                </div>
              </div>
              <div className="mt-6">
                <DescriptionList
                  items={[
                    { label: 'Awarded to', value: <span className="font-medium">{data.certificate.studentName}</span> },
                    { label: 'Course', value: data.certificate.courseName },
                    { label: 'Batch', value: data.certificate.batchName ?? '—' },
                    { label: 'Training period', value: `${formatDate(data.certificate.startDate)} – ${formatDate(data.certificate.completionDate)}` },
                    { label: 'Issued on', value: formatDate(data.certificate.issuedDate) },
                    { label: 'Issued by', value: COMPANY_NAME },
                  ]}
                />
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
