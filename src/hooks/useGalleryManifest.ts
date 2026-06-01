import { useEffect, useState } from 'react'
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
import type {
  GalleryManifest,
  ManifestEquipmentEntry,
  ManifestThumbVariant,
} from '../lib/manifest'
import { GALLERY_MANIFEST_FILENAME } from '../lib/manifest'

function encodeGallerySegments(relativePath: string): string {
  return relativePath
    .split('/')
    .filter(Boolean)
    .map(encodeURIComponent)
    .join('/')
}

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

function thumbSrcSetFromVariants(
  base: string,
  variants: ManifestThumbVariant[] | undefined,
  fallbackUrl: string | null,
  kind: 'path' | 'pathAvif',
): string | null {
  if (variants && variants.length > 0) {
    const parts = variants
      .map((v) => {
        const rel = kind === 'pathAvif' ? v.pathAvif : v.path
        if (!rel) return null
        return `${base}gallery/${encodeGallerySegments(rel)} ${v.width}w`
      })
      .filter(Boolean) as string[]
    if (parts.length > 0) return parts.join(', ')
  }
  if (kind === 'pathAvif') return null
  return fallbackUrl ? `${fallbackUrl} 720w` : null
}

export type ResolvedGalleryImage = {
  file: string
  /** Full-resolution asset */
  url: string
  /** Lightbox / warm URL (~2400px WebP when built) */
  viewUrl: string
  /** Display derivative when generated */
  displayUrl: string | null
  thumbUrl: string | null
  thumbSrcSet: string | null
  thumbSrcSetAvif: string | null
  thumbAspect: number
  sharePageUrl: string | null
  blurHash: string | null
}

export type GalleryEntry = ResolvedGalleryImage & ResolvedGalleryMeta

export type GalleryManifestState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | {
      status: 'ready'
      entries: GalleryEntry[]
      equipment: GalleryEquipmentRegistry
      collections: GalleryCollection[]
    }

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

function manifestToState(manifest: GalleryManifest, base: string): Omit<
  Extract<GalleryManifestState, { status: 'ready' }>,
  'status'
> {
  const registry = manifest.collections ?? {}
  const collectionTitles = new Map(
    Object.entries(registry).map(([slug, doc]) => [slug, doc.title]),
  )
  const cameras = resolveEquipmentMap(manifest.equipment?.cameras ?? {}, base)
  const lenses = resolveEquipmentMap(manifest.equipment?.lenses ?? {}, base)
  const cameraMap = new Map(Object.entries(cameras))
  const lensMap = new Map(Object.entries(lenses))
  const entries = manifest.images.map(
    ({
      file,
      meta,
      thumb,
      thumbVariants,
      display,
      thumbWidth,
      thumbHeight,
      shareStub,
      sharePageUrl: manifestShareUrl,
      blurHash,
    }) => {
      const url = `${base}gallery/${encodeGallerySegments(file)}`
      const thumbUrl = thumb
        ? `${base}gallery/${encodeGallerySegments(thumb)}`
        : null
      const displayUrl = display
        ? `${base}gallery/${encodeGallerySegments(display)}`
        : null
      const viewUrl = displayUrl ?? url
      return {
        file,
        url,
        viewUrl,
        displayUrl,
        thumbUrl,
        thumbSrcSet: thumbSrcSetFromVariants(
          base,
          thumbVariants,
          thumbUrl,
          'path',
        ),
        thumbSrcSetAvif: thumbSrcSetFromVariants(
          base,
          thumbVariants,
          null,
          'pathAvif',
        ),
        thumbAspect: thumbAspectFromSize(thumbWidth, thumbHeight),
        sharePageUrl: resolveSharePageUrlForUi(
          manifestShareUrl,
          shareStub,
          base,
        ),
        blurHash: blurHash ?? null,
        ...resolveEntryMeta(meta, {
          collectionTitleBySlug: collectionTitles,
          cameras: cameraMap,
          lenses: lensMap,
        }),
      }
    },
  )
  const collections = buildGalleryCollections(entries, registry)
  return { entries, equipment: { cameras, lenses }, collections }
}

export function useGalleryManifest(): GalleryManifestState {
  const [state, setState] = useState<GalleryManifestState>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false
    const base = import.meta.env.BASE_URL
    const url = `${base}${GALLERY_MANIFEST_FILENAME}`

    ;(async () => {
      try {
        const res = await fetch(url, { credentials: 'same-origin' })
        if (!res.ok) {
          throw new Error(`${res.status} ${res.statusText}`)
        }
        const manifest = (await res.json()) as GalleryManifest
        if (cancelled) return
        setState({ status: 'ready', ...manifestToState(manifest, base) })
      } catch (e) {
        if (cancelled) return
        setState({
          status: 'error',
          message:
            e instanceof Error ? e.message : 'Could not load gallery manifest',
        })
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  return state
}

/** Sync resolver when manifest JSON is already available (tests/build). */
export function galleryEntriesFromManifest(
  manifest: GalleryManifest,
  base: string,
): ReturnType<typeof manifestToState> {
  return manifestToState(manifest, base)
}
