import { Printer } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { PageHeader } from '@/components/common/PageHeader'
import { ErrorState, LoadingState } from '@/components/common/States'
import { Button } from '@/components/ui/button'
import { CertificateView } from './CertificateView'
import { useCertificate } from './hooks'

export default function CertificateDetailPage() {
  const { id = '' } = useParams()
  const { data, isLoading, error, refetch } = useCertificate(id)
  if (isLoading) return <LoadingState label="Loading certificate…" />
  if (error || !data) return <ErrorState error={error} title="Unable to load certificate" onRetry={refetch} />
  return (
    <>
      <div className="no-print">
        <PageHeader
          breadcrumbs={[{ label: 'Certificates', to: '/certificates' }, { label: data.id }]}
          title="Certificate preview"
          description={
            <>
              Issued to <Link className="text-brand-700 hover:underline" to={`/students/${data.studentId}`}>{data.studentName}</Link> · publicly verifiable at <Link className="text-brand-700 hover:underline" to={`/verify/${data.id}`}>/verify/{data.id}</Link>
            </>
          }
          actions={
            <Button onClick={() => window.print()}>
              <Printer className="h-4 w-4" aria-hidden /> Print / save as PDF
            </Button>
          }
        />
      </div>
      <CertificateView certificate={data} />
    </>
  )
}
