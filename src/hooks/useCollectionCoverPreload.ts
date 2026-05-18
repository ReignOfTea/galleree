import { useEffect } from 'react'
import type { GalleryCollection } from '../lib/galleryCollections'
import {
  pruneGalleryAssetCache,
  scheduleCollectionCoverPreload,
} from '../lib/assetCache'
import type { LoadGate } from '../lib/loadGate'

/** Idle-preload collection cover thumbs and prune stale cache entries. */
export function useCollectionCoverPreload(
  collections: readonly GalleryCollection[],
  gate?: LoadGate,
): void {
  useEffect(() => {
    void pruneGalleryAssetCache()
  }, [])

  useEffect(() => {
    return scheduleCollectionCoverPreload(collections, gate)
  }, [collections, gate])
}
