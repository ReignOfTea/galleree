import {
  parseCollectionSlugFromUrl,
  parseGalleryUrlFilters,
  writeGalleryUrlState,
} from './galleryUrlState'

/** `?collection=` query (primary) or `#collection=` hash — slug from meta `collectionSlug`. */
export function parseCollectionSlugFromLocation(): string | null {
  return parseCollectionSlugFromUrl()
}

export function setCollectionSlugInLocation(slug: string | null): void {
  const filters = parseGalleryUrlFilters()
  writeGalleryUrlState({
    collection: slug?.trim().toLowerCase() ?? null,
    ...filters,
  })
}

export {
  collectionPageUrl,
  collectionSharePageUrl,
} from './galleryUrlState'
