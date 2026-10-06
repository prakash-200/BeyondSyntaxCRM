import type { DocumentCategory } from '@/constants/enums'
import type { DateTimeString, Id, SoftDeletable } from './common'

export interface StoredDocument extends SoftDeletable {
  id: Id
  ownerType: 'STUDENT' | 'LEAD' | 'APPLICATION'
  ownerId: Id
  category: DocumentCategory
  fileName: string
  sizeBytes: number
  mimeType: string
  uploadedById: Id
  uploadedByName?: string
  uploadedAt: DateTimeString
  /** Storage key — later an S3/Azure Blob key or signed URL. */
  storageKey: string
}
