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
}

export const EMPTY_SESSION_DEFAULTS: SessionDefaults = {
  tags: "",
  collectionSelect: SELECT_NONE,
  hidden: null,
  cameraSelect: SELECT_NONE,
  lensSelect: SELECT_NONE,
  copyright: "",
  location: "",
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
}

export function sessionDefaultsEqual(a: SessionDefaults, b: SessionDefaults): boolean {
  return (
    a.tags === b.tags &&
    a.collectionSelect === b.collectionSelect &&
    a.hidden === b.hidden &&
    a.cameraSelect === b.cameraSelect &&
    a.lensSelect === b.lensSelect &&
    a.copyright === b.copyright &&
    a.location === b.location
  )
}
