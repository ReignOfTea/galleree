import { useMemo } from 'react'
import type { FilenameMeta } from '../lib/filenameMeta'
import type { GalleryManifest } from '../lib/manifest'
import rawManifest from 'virtual:gallery-manifest'

function encodeGallerySegments(relativePath: string): string {
  return relativePath
    .split('/')
    .filter(Boolean)
    .map(encodeURIComponent)
    .join('/')
}

export type ResolvedGalleryImage = {
  file: string
  /** Full-resolution asset */
  url: string
  /** Smaller grid thumbnail when `npm run build` generated `gallery/thumbs/{stem}.jpg` */
  thumbUrl: string | null
}

/** Resolved image plus parsed filename metadata for grid & lightbox */
export type GalleryEntry = ResolvedGalleryImage & FilenameMeta

const manifest = rawManifest as GalleryManifest

export function useGalleryManifest(): {
  entries: ResolvedGalleryImage[]
} {
  return useMemo(() => {
    const base = import.meta.env.BASE_URL
    const entries = manifest.images.map(({ file, thumb }) => ({
      file,
      url: `${base}gallery/${encodeGallerySegments(file)}`,
      thumbUrl: thumb
        ? `${base}gallery/${encodeGallerySegments(thumb)}`
        : null,
    }))
    return { entries }
  }, [])
}
