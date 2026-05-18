/** `?collection=` query (primary) or `#collection=` hash — slug from meta `collectionSlug`. */

const COLLECTION_PARAM = 'collection'

export function parseCollectionSlugFromLocation(): string | null {
  if (typeof window === 'undefined') return null
  const url = new URL(window.location.href)
  const q = url.searchParams.get(COLLECTION_PARAM)
  if (q) {
    try {
      const decoded = decodeURIComponent(q).trim()
      return decoded ? decoded.toLowerCase() : null
    } catch {
      const t = q.trim()
      return t ? t.toLowerCase() : null
    }
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

export function setCollectionSlugInLocation(slug: string | null): void {
  const url = new URL(window.location.href)
  if (url.hash.startsWith('#collection=')) {
    url.hash = ''
  }
  if (slug) {
    url.searchParams.set(COLLECTION_PARAM, slug)
  } else {
    url.searchParams.delete(COLLECTION_PARAM)
  }
  window.history.replaceState(
    null,
    '',
    `${url.pathname}${url.search}${url.hash}`,
  )
}

/** Shareable URL for the current origin + base path with only the collection filter applied. */
export function collectionPageUrl(slug: string): string {
  const url = new URL(window.location.href)
  url.searchParams.set(COLLECTION_PARAM, slug)
  url.searchParams.delete('photo')
  if (url.hash.startsWith('#collection=')) {
    url.hash = ''
  }
  return url.toString()
}
