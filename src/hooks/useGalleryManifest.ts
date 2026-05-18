import { useMemo } from 'react'
import {
  type GalleryEquipmentRegistry,
  type ResolvedEquipment,
} from '../lib/galleryEquipmentMeta'
import { thumbAspectFromSize } from '../lib/galleryJustifiedLayout'
import { resolveEntryMeta, type ResolvedGalleryMeta } from '../lib/galleryMeta'
import {
  buildGalleryCollections,
  type GalleryCollection,
} from '../lib/galleryCollections'
import type { GalleryManifest, ManifestEquipmentEntry } from '../lib/manifest'
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
  /** Width / height for justified grid layout */
  thumbAspect: number
  /** Absolute `https://…` URL for static share page when manifest includes `siteUrl` build output */
  sharePageUrl: string | null
}

/** Resolved image plus gallery metadata for grid & lightbox */
export type GalleryEntry = ResolvedGalleryImage & ResolvedGalleryMeta

const manifest = rawManifest as GalleryManifest

function resolveEquipmentMap(
  raw: Record<string, ManifestEquipmentEntry>,
  base: string,
): Record<string, ResolvedEquipment> {
  const out: Record<string, ResolvedEquipment> = {}
  for (const [slug, doc] of Object.entries(raw)) {
    out[slug] = {
      slug: doc.slug,
      name: doc.name,
      make: doc.make,
      model: doc.model,
      description: doc.description,
      imageUrl: doc.image
        ? `${base}gallery/${encodeGallerySegments(doc.image)}`
        : null,
      ...(doc.lensSlug ? { lensSlug: doc.lensSlug } : {}),
    }
  }
  return out
}

export function useGalleryManifest(): {
  entries: GalleryEntry[]
  equipment: GalleryEquipmentRegistry
  collections: GalleryCollection[]
} {
  return useMemo(() => {
    const base = import.meta.env.BASE_URL
    const registry = manifest.collections ?? {}
    const collectionTitles = new Map(
      Object.entries(registry).map(([slug, doc]) => [slug, doc.title]),
    )
    const cameras = resolveEquipmentMap(
      manifest.equipment?.cameras ?? {},
      base,
    )
    const lenses = resolveEquipmentMap(manifest.equipment?.lenses ?? {}, base)
    const cameraMap = new Map(Object.entries(cameras))
    const lensMap = new Map(Object.entries(lenses))
    const entries = manifest.images.map(
      ({
        file,
        meta,
        thumb,
        thumbWidth,
        thumbHeight,
        shareStub,
        sharePageUrl: manifestShareUrl,
      }) => ({
        file,
        url: `${base}gallery/${encodeGallerySegments(file)}`,
        thumbUrl: thumb
          ? `${base}gallery/${encodeGallerySegments(thumb)}`
          : null,
        thumbAspect: thumbAspectFromSize(thumbWidth, thumbHeight),
        sharePageUrl: resolveSharePageUrlForUi(
          manifestShareUrl,
          shareStub,
          base,
        ),
        ...resolveEntryMeta(meta, {
          collectionTitleBySlug: collectionTitles,
          cameras: cameraMap,
          lenses: lensMap,
        }),
      }),
    )
    const collections = buildGalleryCollections(entries, registry)
    return { entries, equipment: { cameras, lenses }, collections }
  }, [])
}
