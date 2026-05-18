import type { GalleryCollection } from './galleryCollections'
import type { LoadGate } from './loadGate'
import { preloadImage } from './preloadImage'

/** Browser Cache Storage bucket for gallery thumbs and covers. */
export const GALLERY_ASSET_CACHE_NAME = 'galleree-gallery-v1'

/** Keep cached gallery assets for one week. */
export const GALLERY_ASSET_CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

const CACHED_AT_HEADER = 'x-galleree-cached-at'

function isCacheStorageAvailable(): boolean {
  return typeof caches !== 'undefined'
}

function isFresh(cachedAtHeader: string | null): boolean {
  if (!cachedAtHeader) return false
  const cachedAt = Number(cachedAtHeader)
  if (!Number.isFinite(cachedAt)) return false
  return Date.now() - cachedAt < GALLERY_ASSET_CACHE_MAX_AGE_MS
}

async function putCachedResponse(
  cache: Cache,
  src: string,
  response: Response,
): Promise<void> {
  const headers = new Headers(response.headers)
  headers.set(CACHED_AT_HEADER, String(Date.now()))
  const body = await response.blob()
  await cache.put(
    src,
    new Response(body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    }),
  )
}

/** Drop expired entries from the gallery asset cache. */
export async function pruneGalleryAssetCache(): Promise<void> {
  if (!isCacheStorageAvailable()) return
  try {
    const cache = await caches.open(GALLERY_ASSET_CACHE_NAME)
    const keys = await cache.keys()
    await Promise.all(
      keys.map(async (req) => {
        const res = await cache.match(req)
        if (!res) return
        if (!isFresh(res.headers.get(CACHED_AT_HEADER))) {
          await cache.delete(req)
        }
      }),
    )
  } catch {
    /* private mode / quota */
  }
}

/** Fetch into Cache Storage (when available) so repeat visits stay fast. */
export async function warmGalleryAsset(src: string): Promise<void> {
  if (!src) return

  if (isCacheStorageAvailable()) {
    try {
      const cache = await caches.open(GALLERY_ASSET_CACHE_NAME)
      const hit = await cache.match(src)
      if (hit && isFresh(hit.headers.get(CACHED_AT_HEADER))) {
        return
      }
      if (hit) await cache.delete(src)

      const res = await fetch(src, { credentials: 'same-origin' })
      if (res.ok) {
        await putCachedResponse(cache, src, res)
        return
      }
    } catch {
      /* fall through to decode preload */
    }
  }

  await fetch(src, { credentials: 'same-origin', cache: 'force-cache' }).catch(
    () => undefined,
  )
}

/** Warm cache (if supported) and decode the image for immediate display. */
export async function preloadCachedImage(src: string): Promise<void> {
  await warmGalleryAsset(src)
  await preloadImage(src)
}

export function preloadCollectionCovers(
  collections: readonly GalleryCollection[],
  gate?: LoadGate,
): void {
  const urls = [
    ...new Set(
      collections
        .map((c) => c.coverThumbUrl)
        .filter((url): url is string => Boolean(url)),
    ),
  ]
  for (const url of urls) {
    const task = () => preloadCachedImage(url).catch(() => undefined)
    if (gate) void gate.run(task)
    else void task()
  }
}

export function scheduleCollectionCoverPreload(
  collections: readonly GalleryCollection[],
  gate?: LoadGate,
): () => void {
  if (collections.length === 0) return () => undefined

  const run = () => preloadCollectionCovers(collections, gate)

  if (typeof requestIdleCallback === 'function') {
    const id = requestIdleCallback(run, { timeout: 2500 })
    return () => cancelIdleCallback(id)
  }

  const id = window.setTimeout(run, 400)
  return () => clearTimeout(id)
}
