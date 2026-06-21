import type { ExifDisplayRow } from "@galleree/exif-display"
import { galleryMetaFromUploadFields } from "@galleree/gallery-meta"

type UploadFields = Parameters<typeof galleryMetaFromUploadFields>[0]

/** Build sidecar meta; attaches exifDisplay without requiring a shared API bump. */
export function galleryMetaForUpload(
  fields: UploadFields,
  id: string,
  uploadedAt: string | undefined,
  exifDisplay: ExifDisplayRow[] | null,
) {
  const meta = galleryMetaFromUploadFields(fields, id, uploadedAt)
  if (exifDisplay?.length) {
    meta.exifDisplay = exifDisplay
  }
  return meta
}
