import { SELECT_CUSTOM, SELECT_NONE } from "./registryTypes"
import type { UploadRow } from "./types"

export function resolveCollectionSlug(row: UploadRow): string | null {
  if (row.collectionSelect === SELECT_NONE) return null
  return row.collectionSelect
}

export function resolveCameraValue(row: UploadRow): string {
  if (row.cameraSelect === SELECT_NONE) return ""
  if (row.cameraSelect === SELECT_CUSTOM) return row.cameraCustom.trim()
  return row.cameraSelect
}

export function resolveLensValue(row: UploadRow): string {
  if (row.lensSelect === SELECT_NONE) return ""
  if (row.lensSelect === SELECT_CUSTOM) return row.lensCustom.trim()
  return row.lensSelect
}
