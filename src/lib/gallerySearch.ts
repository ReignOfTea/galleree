import type { GalleryEntry } from '../hooks/useGalleryManifest'
import { formatCaptureDate } from './galleryLabels'

/** Flatten fields users might type in the search box (multiple date formats help match). */
function searchHaystack(item: GalleryEntry): string {
  const parts: string[] = [
    item.file,
    item.displayTitle ?? '',
    item.locationDisplay ?? '',
    ...item.tags,
    item.cameraLabel ?? '',
    item.eventLabel ?? '',
  ]
  if (item.capturedAt != null) {
    parts.push(
      formatCaptureDate(item.capturedAt, item.capturedAtIsDateOnly, 'toolbar'),
      formatCaptureDate(item.capturedAt, item.capturedAtIsDateOnly, 'detailsLong'),
      formatCaptureDate(item.capturedAt, item.capturedAtIsDateOnly, 'caption'),
    )
    const d = new Date(item.capturedAt)
    parts.push(
      d.toISOString(),
      String(d.getFullYear()),
      String(d.getMonth() + 1).padStart(2, '0'),
      String(d.getDate()).padStart(2, '0'),
    )
  }
  return parts.join('\0').toLowerCase()
}

/** Every whitespace-separated term must match somewhere (AND). */
export function galleryEntryMatchesQuery(
  item: GalleryEntry,
  query: string,
): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  const hay = searchHaystack(item)
  const terms = q.split(/\s+/).filter(Boolean)
  return terms.every((term) => hay.includes(term))
}
