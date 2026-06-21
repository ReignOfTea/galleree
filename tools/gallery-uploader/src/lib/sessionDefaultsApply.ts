import { SELECT_NONE } from "../registryTypes"
import type { UploadRow } from "../types"
import type { SessionDefaults } from "./sessionDefaults"
import { applySessionDefaults, applyCaptureDateDefault, EMPTY_SESSION_DEFAULTS } from "./sessionDefaults"
import { DEFAULT_CAMERA_SLUG, DEFAULT_LENS_SLUG } from "./equipmentDefaults"

/** Sensible starter defaults for a new upload session (Sony α7 IV + Tamron 28-200). */
export function initialSessionDefaults(copyrightPlaceholder = ""): SessionDefaults {
  return {
    ...EMPTY_SESSION_DEFAULTS,
    tags: "photos",
    cameraSelect: DEFAULT_CAMERA_SLUG,
    lensSelect: DEFAULT_LENS_SLUG,
    copyright: copyrightPlaceholder,
  }
}

export function hasMeaningfulSessionDefaults(
  defaults: SessionDefaults,
  baseline: SessionDefaults = EMPTY_SESSION_DEFAULTS,
): boolean {
  return (
    defaults.tags !== baseline.tags ||
    defaults.collectionSelect !== baseline.collectionSelect ||
    defaults.hidden !== baseline.hidden ||
    defaults.cameraSelect !== baseline.cameraSelect ||
    defaults.lensSelect !== baseline.lensSelect ||
    defaults.copyright !== baseline.copyright ||
    defaults.location !== baseline.location ||
    defaults.captureDate !== baseline.captureDate
  )
}

function applySessionDefaultsForced(row: UploadRow, defaults: SessionDefaults): void {
  if (defaults.tags.trim()) row.tags = defaults.tags.trim()
  if (defaults.collectionSelect !== SELECT_NONE) {
    row.collectionSelect = defaults.collectionSelect
  }
  if (defaults.hidden !== null) row.hidden = defaults.hidden
  if (defaults.cameraSelect !== SELECT_NONE) row.cameraSelect = defaults.cameraSelect
  if (defaults.lensSelect !== SELECT_NONE) row.lensSelect = defaults.lensSelect
  if (defaults.copyright.trim()) row.copyright = defaults.copyright.trim()
  if (defaults.location.trim()) row.location = defaults.location.trim()
  applyCaptureDateDefault(row, defaults.captureDate, { force: true })
}

/** Apply session defaults to all queued rows (or only non-edit rows). */
export function applySessionDefaultsToQueued(
  rows: UploadRow[],
  defaults: SessionDefaults,
  opts: { force?: boolean; skipEdits?: boolean } = {},
): UploadRow[] {
  return rows.map((row) => {
    if (opts.skipEdits && row.editExistingId) return row
    const next = { ...row }
    if (opts.force) {
      applySessionDefaultsForced(next, defaults)
    } else {
      applySessionDefaults(next, defaults)
    }
    return next
  })
}
