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

/** Prefer manifest absolute URL; otherwise root-relative path + current origin in the browser. */
function resolveSharePageUrlForUi(
  manifestShareUrl: string | undefined,
  shareStub: string | undefined,
  viteBase: string,
): string | null {
  const raw =
    manifestShareUrl ??
    (shareStub ? `${viteBase}${encodeGallerySegments(shareStub)}` : null)
  if (raw == null) return null
  if (/^https?:\/\//i.test(raw)) return raw
  if (typeof window !== 'undefined' && raw.startsWith('/')) {
    return `${window.location.origin}${raw}`
  }
  return raw
}

export type ResolvedGalleryImage = {
  file: string
  /** Full-resolution asset */
  url: string
  /** Smaller grid thumbnail when `npm run build` generated `gallery/thumbs/{stem}.jpg` */
  thumbUrl: string | null
  /** Absolute `https://…` URL for static share page when manifest includes `siteUrl` build output */
  sharePageUrl: string | null
}

/** Resolved image plus parsed filename metadata for grid & lightbox */
export type GalleryEntry = ResolvedGalleryImage & FilenameMeta

const manifest = rawManifest as GalleryManifest

export function useGalleryManifest(): {
  entries: ResolvedGalleryImage[]
} {
  return useMemo(() => {
    const base = import.meta.env.BASE_URL
    const entries = manifest.images.map(
      ({ file, thumb, shareStub, sharePageUrl: manifestShareUrl }) => ({
        file,
        url: `${base}gallery/${encodeGallerySegments(file)}`,
        thumbUrl: thumb
          ? `${base}gallery/${encodeGallerySegments(thumb)}`
          : null,
        sharePageUrl: resolveSharePageUrlForUi(
          manifestShareUrl,
          shareStub,
          base,
        ),
      }),
    )
    return { entries }
  }, [])
}
