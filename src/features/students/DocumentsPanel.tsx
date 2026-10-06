import { FileText, Trash2, Upload } from 'lucide-react'
import { useRef, useState } from 'react'
import { useConfirm } from '@/components/common/ConfirmDialog'
import { EmptyState, ErrorState, LoadingState } from '@/components/common/States'
import { Badge } from '@/components/common/StatusBadge'
import { FormSelect } from '@/components/forms/fields'
import { Button } from '@/components/ui/button'
import { Card, CardHeader } from '@/components/ui/card'
import { DOCUMENT_CATEGORIES } from '@/constants/enums'
import { humanize, optionsFrom } from '@/constants/labels'
import { useAuth } from '@/features/auth/AuthContext'
import type { DocumentCategory } from '@/constants/enums'
import type { StoredDocument } from '@/types'
import { formatBytes, formatDateTime } from '@/utils/format'
import { useDocuments, useRemoveDocument, useUploadDocument } from './hooks'

/**
 * Document metadata list with a mock upload. Only name/size/type are sent —
 * replace `documentApi.upload` with a multipart or pre-signed-URL upload to
 * cloud storage (S3 / Azure Blob) when the backend exists.
 */
export function DocumentsPanel({ ownerType, ownerId }: { ownerType: StoredDocument['ownerType']; ownerId: string }) {
  const { data, isLoading, error, refetch } = useDocuments(ownerId)
  const upload = useUploadDocument()
  const remove = useRemoveDocument()
  const confirm = useConfirm()
  const { can } = useAuth()
  const [category, setCategory] = useState<DocumentCategory>('ID_PROOF')
  const fileRef = useRef<HTMLInputElement>(null)
  const canEdit = can(['students:update', 'applications:update'])

  const onFile = (file: File | undefined) => {
    if (!file) return
    upload.mutate({ ownerType, ownerId, category, fileName: file.name, sizeBytes: file.size, mimeType: file.type || 'application/octet-stream' })
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <Card>
      <CardHeader
        title="Documents"
        description="ID proof, education certificates, receipts and other files"
        action={
          canEdit && (
            <div className="flex items-end gap-2">
              <FormSelect label="Category" wrapperClassName="[&>label]:sr-only" value={category} onChange={(e) => setCategory(e.target.value as DocumentCategory)} options={optionsFrom(DOCUMENT_CATEGORIES)} />
              <input ref={fileRef} type="file" className="sr-only" id={`file-${ownerId}`} onChange={(e) => onFile(e.target.files?.[0])} />
              <Button onClick={() => fileRef.current?.click()} loading={upload.isPending}>
                <Upload className="h-4 w-4" aria-hidden /> Upload
              </Button>
            </div>
          )
        }
      />
      {isLoading ? (
        <LoadingState className="py-8" />
      ) : error ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : !data?.length ? (
        <EmptyState title="No documents uploaded" description="Upload an ID proof or education certificate to get started." icon={<FileText className="h-5 w-5" />} />
      ) : (
        <ul className="divide-y divide-slate-100">
          {data.map((d) => (
            <li key={d.id} className="flex items-center justify-between gap-3 px-5 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                  <FileText className="h-4 w-4" aria-hidden />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900">{d.fileName}</p>
                  <p className="text-xs text-slate-500">
                    {formatBytes(d.sizeBytes)} · {d.uploadedByName} · {formatDateTime(d.uploadedAt)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge tone="neutral" icon={false}>
                  {humanize(d.category)}
                </Badge>
                {canEdit && (
                  <Button variant="ghost" size="icon-sm" aria-label={`Remove ${d.fileName}`} onClick={() => confirm({ title: `Remove ${d.fileName}?`, description: 'The document is hidden from the student record.', tone: 'danger', confirmLabel: 'Remove', run: () => remove.mutateAsync(d.id) })}>
                    <Trash2 className="h-4 w-4 text-slate-400" />
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
