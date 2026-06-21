import { SELECT_NONE } from "../registryTypes"
import type { UploadRow } from "../types"

export type SessionDefaults = {
  tags: string
  collectionSelect: string
  /** When null, do not override hidden on new photos. */
  hidden: boolean | null
  cameraSelect: string
  lensSelect: string
  copyright: string
  location: string
  /** YYYY-MM-DD; empty = do not set. */
  captureDate: string
}

export const EMPTY_SESSION_DEFAULTS: SessionDefaults = {
  tags: "",
  collectionSelect: SELECT_NONE,
  hidden: null,
  cameraSelect: SELECT_NONE,
  lensSelect: SELECT_NONE,
  copyright: "",
  location: "",
  captureDate: "",
}

/** Apply a default capture date (and align captureDateTimeIso when needed). */
export function applyCaptureDateDefault(
  row: UploadRow,
  date: string,
  opts: { force?: boolean } = {},
): void {
  const d = date.trim()
  if (!d) return
  if (!opts.force && row.captureDate.trim()) return
  row.captureDate = d
  const iso = row.captureDateTimeIso.trim()
  if (iso && /^\d{4}-\d{2}-\d{2}T/.test(iso)) {
    row.captureDateTimeIso = `${d}T${iso.split("T")[1]}`
  } else {
    row.captureDateTimeIso = `${d}T12:00:00.000Z`
  }
}

/** Apply session defaults to a newly ingested row (after EXIF hints). */
export function applySessionDefaults(row: UploadRow, defaults: SessionDefaults): void {
  if (defaults.tags.trim()) {
    row.tags = defaults.tags.trim()
  }
  if (defaults.collectionSelect !== SELECT_NONE) {
    row.collectionSelect = defaults.collectionSelect
  }
  if (defaults.hidden !== null) {
    row.hidden = defaults.hidden
  }
  if (defaults.cameraSelect !== SELECT_NONE && row.cameraSelect === SELECT_NONE) {
    row.cameraSelect = defaults.cameraSelect
  }
  if (defaults.lensSelect !== SELECT_NONE && row.lensSelect === SELECT_NONE) {
    row.lensSelect = defaults.lensSelect
  }
  if (defaults.copyright.trim() && !row.copyright.trim()) {
    row.copyright = defaults.copyright.trim()
  }
  if (defaults.location.trim() && !row.location.trim()) {
    row.location = defaults.location.trim()
  }
  applyCaptureDateDefault(row, defaults.captureDate)
}

export function sessionDefaultsEqual(a: SessionDefaults, b: SessionDefaults): boolean {
  return (
    a.tags === b.tags &&
    a.collectionSelect === b.collectionSelect &&
    a.hidden === b.hidden &&
    a.cameraSelect === b.cameraSelect &&
    a.lensSelect === b.lensSelect &&
    a.copyright === b.copyright &&
    a.location === b.location &&
    a.captureDate === b.captureDate
  )
}
