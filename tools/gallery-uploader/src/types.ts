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
}
