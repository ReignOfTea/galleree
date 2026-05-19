/** Shareable gallery filter state in the URL query string. */

const COLLECTION_PARAM = 'collection'
const LOCATION_PARAM = 'location'
const TAGS_PARAM = 'tags'
const QUERY_PARAM = 'q'

export type GalleryUrlFilters = {
  location: string | null
  tags: string[]
  searchQuery: string
}

export type GalleryUrlState = GalleryUrlFilters & {
  collection: string | null
}

function decodeParam(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

export function parseCollectionSlugFromUrl(): string | null {
  if (typeof window === 'undefined') return null
  const url = new URL(window.location.href)
  const q = url.searchParams.get(COLLECTION_PARAM)
  if (q) {
    const decoded = decodeParam(q).trim()
    return decoded ? decoded.toLowerCase() : null
  }
  if (url.hash.startsWith('#collection=')) {
    try {
      const decoded = decodeURIComponent(url.hash.slice(12)).trim()
      return decoded ? decoded.toLowerCase() : null
    } catch {
      return null
    }
  }
  return null
}

export function parseGalleryUrlFilters(): GalleryUrlFilters {
  if (typeof window === 'undefined') {
    return { location: null, tags: [], searchQuery: '' }
  }
  const url = new URL(window.location.href)
  const locationRaw = url.searchParams.get(LOCATION_PARAM)
  const location = locationRaw
    ? decodeParam(locationRaw).trim() || null
    : null

  const tagsRaw = url.searchParams.get(TAGS_PARAM)
  const tags = tagsRaw
    ? tagsRaw
        .split(',')
        .map((t) => decodeParam(t.trim()))
        .filter(Boolean)
    : []

  const qRaw = url.searchParams.get(QUERY_PARAM)
  const searchQuery = qRaw ? decodeParam(qRaw) : ''

  return { location, tags, searchQuery }
}

export function parseGalleryUrlState(): GalleryUrlState {
  return {
    collection: parseCollectionSlugFromUrl(),
    ...parseGalleryUrlFilters(),
  }
}

export function writeGalleryUrlState(state: GalleryUrlState): void {
  if (typeof window === 'undefined') return
  const url = new URL(window.location.href)

  if (url.hash.startsWith('#collection=')) {
    url.hash = ''
  }

  if (state.collection) {
    url.searchParams.set(COLLECTION_PARAM, state.collection)
  } else {
    url.searchParams.delete(COLLECTION_PARAM)
  }

  if (state.location) {
    url.searchParams.set(LOCATION_PARAM, state.location)
  } else {
    url.searchParams.delete(LOCATION_PARAM)
  }

  if (state.tags.length > 0) {
    url.searchParams.set(TAGS_PARAM, state.tags.join(','))
  } else {
    url.searchParams.delete(TAGS_PARAM)
  }

  const q = state.searchQuery.trim()
  if (q) {
    url.searchParams.set(QUERY_PARAM, q)
  } else {
    url.searchParams.delete(QUERY_PARAM)
  }

  window.history.replaceState(
    null,
    '',
    `${url.pathname}${url.search}${url.hash}`,
  )
}

/** Shareable URL with only the collection filter (clears search/facet params). */
export function collectionPageUrl(slug: string): string {
  const url = new URL(window.location.href)
  url.searchParams.set(COLLECTION_PARAM, slug)
  url.searchParams.delete(LOCATION_PARAM)
  url.searchParams.delete(TAGS_PARAM)
  url.searchParams.delete(QUERY_PARAM)
  url.searchParams.delete('photo')
  if (url.hash.startsWith('#collection=')) {
    url.hash = ''
  }
  return url.toString()
}
