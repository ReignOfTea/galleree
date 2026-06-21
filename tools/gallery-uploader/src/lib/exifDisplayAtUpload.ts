import type { ExifDisplayRow } from "@galleree/exif-display"
import {
  exifToDisplayRowsForPublish,
  sanitizeExifRowsForPublish,
} from "@galleree/exif-display"
import { appInvoke } from "../tauriBridge"
import type { UploadRow } from "../types"

export async function readExifDisplayFromPath(
  sourcePath: string,
): Promise<ExifDisplayRow[] | null> {
  try {
    const raw = await appInvoke<Record<string, unknown>>("read_exif_publish_raw", {
      path: sourcePath,
    })
    const rows = sanitizeExifRowsForPublish(exifToDisplayRowsForPublish(raw))
    return rows.length > 0 ? rows : null
  } catch {
    return null
  }
}

/** Metadata-only edits keep sidecar rows; new uploads and image swaps refresh from file. */
export async function resolveExifDisplayForRow(
  row: UploadRow,
): Promise<ExifDisplayRow[] | null> {
  if (row.editExistingId && !row.replaceImageFile) {
    return row.preserveExifDisplay
  }
  return readExifDisplayFromPath(row.sourcePath)
}
