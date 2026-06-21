export type UploadRow = {
  id: string
  sourcePath: string
  previewSrc: string
  title: string
  description: string
  tags: string
  location: string
  /** `YYYY-MM-DD` from the date picker */
  captureDate: string
  /** Full ISO capture time from EXIF (preserves time-of-day for sort). */
  captureDateTimeIso: string
  collectionSelect: string
  /** When true, sets this photo as the selected collection’s cover on upload. */
  collectionSetCover: boolean
  cameraSelect: string
  cameraCustom: string
  lensSelect: string
  lensCustom: string
  alt: string
  hidden: boolean
  sortOrder: string
  copyright: string
  extension: string
  destId: string
  destFilename: string
  destExists: boolean
  /** When set, updates an existing gallery photo (metadata; image unchanged unless replaced). */
  editExistingId: string | null
  /** Preserve sidecar uploadedAt when editing. */
  preserveUploadedAt: string | null
  /** Sidecar exifDisplay preserved on metadata-only edits. */
  preserveExifDisplay: { label: string; value: string }[] | null
  /** Path to the gallery file when loaded via Edit existing. */
  editGalleryImagePath: string | null
  /** Original dest filename when editing (for cleanup if extension changes). */
  editOriginalFilename: string | null
  /** When true, upload replaces the gallery original bytes for this id. */
  replaceImageFile: boolean
}

export type GalleryPhotoEdit = {
  id: string
  destFilename: string
  imagePath: string
  title: string
  description: string | null
  tags: string[]
  location: string | null
  capturedOn: string | null
  capturedAt: string | null
  collectionSlug: string | null
  camera: string | null
  lens: string | null
  alt: string | null
  hidden: boolean
  sortOrder: number | null
  copyright: string | null
  uploadedAt: string | null
  exifDisplay: { label: string; value: string }[] | null
}
