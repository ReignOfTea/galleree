import type { GalleryEntry } from '../hooks/useGalleryManifest'

export type GalleryLabelFields = Pick<
  GalleryEntry,
  'displayTitle' | 'file' | 'locationDisplay' | 'capturedAt' | 'capturedAtIsDateOnly'
>

/** Format parsed capture instant for UI (respects date-only filenames). */
export function formatCaptureDate(
  ms: number,
  dateOnly: boolean,
  variant: 'toolbar' | 'detailsLong' | 'caption' | 'alt',
): string {
  const d = new Date(ms)
  if (dateOnly) {
    if (variant === 'detailsLong' || variant === 'alt') {
      return d.toLocaleDateString(undefined, {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    }
    return d.toLocaleDateString(undefined, { dateStyle: 'medium' })
  }
  if (variant === 'detailsLong') {
    return d.toLocaleString(undefined, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  }
  return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

type AltFields = GalleryLabelFields & {
  alt?: string | null
  description?: string | null
}

/** Accessible description: alt, else title + location + date */
export function galleryImageDescription(e: AltFields): string {
  if (e.alt?.trim()) return e.alt.trim()
  const title = e.displayTitle ?? e.file
  const parts = [title]
  if (e.description?.trim()) parts.push(e.description.trim())
  if (e.locationDisplay) parts.push(e.locationDisplay)
  if (e.capturedAt != null) {
    parts.push(
      formatCaptureDate(e.capturedAt, e.capturedAtIsDateOnly, 'alt'),
    )
  }
  return parts.join(', ')
}

/** Caption meta line — excludes camera/lens (shown as separate equipment chips). */
export function galleryCaptionMetaParts(
  e: Pick<
    GalleryEntry,
    | 'locationDisplay'
    | 'capturedAt'
    | 'capturedAtIsDateOnly'
    | 'eventLabel'
  >,
): string[] {
  const parts: string[] = []
  if (e.locationDisplay) parts.push(e.locationDisplay)
  if (e.capturedAt != null) {
    parts.push(formatCaptureDate(e.capturedAt, e.capturedAtIsDateOnly, 'caption'))
  }
  if (e.eventLabel) parts.push(e.eventLabel)
  return parts
}
