import { preloadCachedImage } from './assetCache'

const done = new Set<string>()
const inflight = new Map<string, Promise<void>>()

/** Warm and decode a full-resolution lightbox image (deduped, fire-and-forget). */
export function preloadLightboxImage(url: string): void {
  if (!url || done.has(url)) return
  if (inflight.has(url)) return

  const task = preloadCachedImage(url)
    .then(() => {
      done.add(url)
    })
    .catch(() => undefined)
    .finally(() => {
      inflight.delete(url)
    })

  inflight.set(url, task)
}

export function preloadLightboxNeighbors(
  items: readonly { file: string; viewUrl: string }[],
  currentFile: string,
): void {
  const index = items.findIndex((e) => e.file === currentFile)
  if (index < 0) return
  for (const delta of [-1, 1] as const) {
    const neighbor = items[index + delta]
    if (neighbor) preloadLightboxImage(neighbor.viewUrl)
  }
}

export function scheduleLightboxNeighborsPreload(
  items: readonly { file: string; viewUrl: string }[],
  currentFile: string,
): void {
  const run = () => preloadLightboxNeighbors(items, currentFile)
  if (typeof requestIdleCallback === 'function') {
    requestIdleCallback(run, { timeout: 1200 })
  } else {
    window.setTimeout(run, 0)
  }
}
