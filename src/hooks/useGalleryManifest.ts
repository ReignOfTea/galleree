import { useMemo } from 'react'
import type { GalleryManifest } from '../lib/manifest'
import rawManifest from 'virtual:gallery-manifest'

export type ResolvedGalleryImage = {
  file: string
  url: string
}

/** Resolved image plus parsed filename tags / location for grid & lightbox */
export type GalleryEntry = ResolvedGalleryImage & {
  tags: string[]
  locationDisplay: string | null
}

const manifest = rawManifest as GalleryManifest

export function useGalleryManifest(): {
  entries: ResolvedGalleryImage[]
} {
  return useMemo(() => {
    const base = import.meta.env.BASE_URL
    const entries = manifest.images.map(({ file }) => ({
      file,
      url: `${base}gallery/${encodeURIComponent(file)}`,
    }))
    return { entries }
  }, [])
}
