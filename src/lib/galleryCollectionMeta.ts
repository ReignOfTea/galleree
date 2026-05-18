import { displayTitleToSlug } from './slug'

export const GALLERY_COLLECTION_META_VERSION = 1 as const

/** Registry entry at `public/gallery/meta/collections/{slug}.json` */
export type GalleryCollectionMetaFile = {
  version: typeof GALLERY_COLLECTION_META_VERSION
  slug: string
  title: string
  description: string | null
  /** Gallery image `id` used as collection cover */
  coverImageId: string | null
}

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export function isValidCollectionSlug(slug: string): boolean {
  const t = slug.trim().toLowerCase()
  return t.length > 0 && t.length <= 80 && SLUG_RE.test(t)
}

export function collectionSlugFromTitle(title: string): string | null {
  const slug = displayTitleToSlug(title)
  return slug && isValidCollectionSlug(slug) ? slug : null
}

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x)
}

function nullableString(raw: unknown): string | null {
  if (raw == null) return null
  if (typeof raw !== 'string') return null
  const t = raw.trim()
  return t ? t : null
}

export function parseGalleryCollectionMetaFile(
  raw: unknown,
): GalleryCollectionMetaFile | null {
  if (!isRecord(raw)) return null
  if (raw.version !== GALLERY_COLLECTION_META_VERSION) return null

  const slug =
    typeof raw.slug === 'string' && isValidCollectionSlug(raw.slug)
      ? raw.slug.trim().toLowerCase()
      : null
  const title =
    typeof raw.title === 'string' && raw.title.trim()
      ? raw.title.trim()
      : null
  if (!slug || !title) return null

  const cover =
    typeof raw.coverImageId === 'string' && raw.coverImageId.trim()
      ? raw.coverImageId.trim().toLowerCase()
      : null

  return {
    version: GALLERY_COLLECTION_META_VERSION,
    slug,
    title,
    description: nullableString(raw.description),
    coverImageId: cover,
  }
}

export function serializeGalleryCollectionMeta(
  meta: GalleryCollectionMetaFile,
): string {
  return `${JSON.stringify(meta, null, 2)}\n`
}
