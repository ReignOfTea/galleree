export type UploadRow = {
  id: string
  sourcePath: string
  previewSrc: string
  title: string
  tags: string
  location: string
  /** `YYYY-MM-DD` from the date picker; empty means omit `dt-…` in the filename */
  captureDate: string
  camera: string
  event: string
  extension: string
  destFilename: string
  destExists: boolean
}
