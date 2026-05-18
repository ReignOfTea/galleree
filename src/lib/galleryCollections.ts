import type { GalleryEntry } from '../hooks/useGalleryManifest'
import type { ManifestCollection } from './manifest'

export type GalleryCollection = {
  slug: string
  title: string
  description: string | null
  coverThumbUrl: string | null
  imageCount: number
}

export function entryMatchesCollectionSlug(
  entry: Pick<GalleryEntry, 'collectionSlug' | 'eventLabel'>,
  slug: string,
  titleBySlug: Map<string, string>,
): boolean {
  const normalized = slug.trim().toLowerCase()
  if (entry.collectionSlug?.toLowerCase() === normalized) return true
  const title = titleBySlug.get(normalized)
  return title != null && entry.eventLabel === title
}

export function buildGalleryCollections(
  entries: GalleryEntry[],
  registry: Record<string, ManifestCollection>,
): GalleryCollection[] {
  const titleBySlug = new Map<string, string>()
  for (const doc of Object.values(registry)) {
    titleBySlug.set(doc.slug, doc.title)
  }

  const bySlug = new Map<
    string,
    { title: string; description: string | null; coverImageId: string | null }
  >()

  for (const doc of Object.values(registry)) {
    bySlug.set(doc.slug, {
      title: doc.title,
      description: doc.description,
      coverImageId: doc.coverImageId,
    })
  }

  const counts = new Map<string, number>()
  const entriesBySlug = new Map<string, GalleryEntry[]>()

  for (const entry of entries) {
    const slug =
      entry.collectionSlug ??
      (entry.eventLabel
        ? [...titleBySlug.entries()].find(([, t]) => t === entry.eventLabel)?.[0]
        : null)
    if (!slug) continue

    counts.set(slug, (counts.get(slug) ?? 0) + 1)
    const list = entriesBySlug.get(slug) ?? []
    list.push(entry)
    entriesBySlug.set(slug, list)

    if (!bySlug.has(slug)) {
      bySlug.set(slug, {
        title: entry.eventLabel ?? slug,
        description: null,
        coverImageId: null,
      })
      titleBySlug.set(slug, entry.eventLabel ?? slug)
    }
  }

  const byId = new Map(entries.map((e) => [e.imageId, e]))

  return [...bySlug.entries()]
    .map(([slug, meta]) => {
      const inCollection = entriesBySlug.get(slug) ?? []
      let coverThumbUrl: string | null = null
      if (meta.coverImageId) {
        const coverEntry = byId.get(meta.coverImageId.toLowerCase())
        coverThumbUrl = coverEntry?.thumbUrl ?? coverEntry?.url ?? null
      }
      if (!coverThumbUrl && inCollection.length > 0) {
        const first = inCollection[0]
        coverThumbUrl = first.thumbUrl ?? first.url
      }
      return {
        slug,
        title: meta.title,
        description: meta.description,
        coverThumbUrl,
        imageCount: counts.get(slug) ?? 0,
      }
    })
    .filter((c) => c.imageCount > 0)
    .sort((a, b) => a.title.localeCompare(b.title))
}
