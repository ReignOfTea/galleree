import { collectionSlugFromTitle } from './galleryCollectionMeta'
import type { GalleryEntry } from '../hooks/useGalleryManifest'

export type CollectionOption = {
  slug: string
  title: string
}

export function buildCollectionOptions(
  entries: Pick<GalleryEntry, 'eventLabel' | 'collectionSlug'>[],
): CollectionOption[] {
  const bySlug = new Map<string, string>()
  for (const e of entries) {
    if (!e.eventLabel) continue
    const slug =
      e.collectionSlug ?? collectionSlugFromTitle(e.eventLabel) ?? null
    if (!slug) continue
    if (!bySlug.has(slug)) bySlug.set(slug, e.eventLabel)
  }
  return [...bySlug.entries()]
    .map(([slug, title]) => ({ slug, title }))
    .sort((a, b) => a.title.localeCompare(b.title))
}

export function resolveCollectionTitleFromSlug(
  slug: string,
  options: CollectionOption[],
): string | null {
  const normalized = slug.trim().toLowerCase()
  const hit = options.find((o) => o.slug === normalized)
  return hit?.title ?? null
}

export function collectionSlugForTitle(
  title: string,
  options: CollectionOption[],
): string | null {
  const hit = options.find((o) => o.title === title)
  if (hit) return hit.slug
  return collectionSlugFromTitle(title)
}
