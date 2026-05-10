import type { GalleryEntry } from '../hooks/useGalleryManifest'

export type GallerySortOrder =
  | 'date-desc'
  | 'date-asc'
  | 'title-asc'
  | 'title-desc'

export const DEFAULT_GALLERY_SORT_ORDER: GallerySortOrder = 'date-desc'

export const GALLERY_SORT_OPTIONS: {
  value: GallerySortOrder
  label: string
}[] = [
  { value: 'date-desc', label: 'Newest' },
  { value: 'date-asc', label: 'Oldest' },
  { value: 'title-asc', label: 'A–Z' },
  { value: 'title-desc', label: 'Z–A' },
]

function titleSortKey(entry: GalleryEntry): string {
  const stem =
    entry.displayTitle?.trim() ||
    entry.file.replace(/\.[^.]+$/, '').replace(/_/g, ' ')
  return stem.toLowerCase()
}

function tieBreak(a: GalleryEntry, b: GalleryEntry): number {
  return a.file.localeCompare(b.file)
}

/** Stable ordering for the gallery grid / lightbox navigation. */
export function compareGalleryEntries(
  a: GalleryEntry,
  b: GalleryEntry,
  order: GallerySortOrder,
): number {
  switch (order) {
    case 'date-desc': {
      const ta = a.capturedAt ?? Number.NEGATIVE_INFINITY
      const tb = b.capturedAt ?? Number.NEGATIVE_INFINITY
      if (tb !== ta) return tb - ta
      break
    }
    case 'date-asc': {
      const ta = a.capturedAt ?? Number.POSITIVE_INFINITY
      const tb = b.capturedAt ?? Number.POSITIVE_INFINITY
      if (ta !== tb) return ta - tb
      break
    }
    case 'title-asc': {
      const cmp = titleSortKey(a).localeCompare(titleSortKey(b))
      if (cmp !== 0) return cmp
      break
    }
    case 'title-desc': {
      const cmp = titleSortKey(b).localeCompare(titleSortKey(a))
      if (cmp !== 0) return cmp
      break
    }
    default:
      break
  }
  return tieBreak(a, b)
}
