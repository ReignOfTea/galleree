import { useCallback, useEffect, useMemo, useState } from 'react'
import { galleryColumns, maxConcurrentImageLoads } from '../lib/config'
import {
  clearPhotoFromLocation,
  parsePhotoFromLocation,
  photoIsInLocation,
  setPhotoInLocation,
} from '../lib/photoDeepLink'
import { createLoadGate } from '../lib/loadGate'
import type { GalleryEntry } from '../hooks/useGalleryManifest'
import { GalleryRow } from './GalleryRow'
import { PhotoLightbox, type LightboxPhoto } from './PhotoLightbox'

function toLightboxPhoto(entry: GalleryEntry): LightboxPhoto {
  return entry
}

type Props = {
  items: GalleryEntry[]
  /** Full gallery (ignores tag filter) for resolving `#photo=` / `?photo=` links. */
  allItems: GalleryEntry[]
  siteTitle: string
}

export function Gallery({ items, allItems, siteTitle }: Props) {
  const [lightbox, setLightbox] = useState<LightboxPhoto | null>(null)

  useEffect(() => {
    const syncFromLocation = () => {
      const file = parsePhotoFromLocation()
      if (!file) {
        setLightbox(null)
        return
      }
      const entry = allItems.find((e) => e.file === file)
      if (entry) {
        setLightbox(toLightboxPhoto(entry))
      } else {
        setLightbox(null)
        clearPhotoFromLocation()
      }
    }

    syncFromLocation()
    window.addEventListener('hashchange', syncFromLocation)
    window.addEventListener('popstate', syncFromLocation)
    return () => {
      window.removeEventListener('hashchange', syncFromLocation)
      window.removeEventListener('popstate', syncFromLocation)
    }
  }, [allItems])

  const openLightbox = useCallback((item: GalleryEntry) => {
    setLightbox(toLightboxPhoto(item))
  }, [])

  useEffect(() => {
    if (!lightbox) return
    setPhotoInLocation(lightbox.file)
  }, [lightbox])

  const goAdjacent = useCallback(
    (direction: -1 | 1) => {
      setLightbox((prev) => {
        if (!prev) return prev
        const i = items.findIndex((e) => e.file === prev.file)
        if (i < 0) return prev
        const nextEntry = items[i + direction]
        if (!nextEntry) return prev
        return toLightboxPhoto(nextEntry)
      })
    },
    [items],
  )

  const closeLightbox = useCallback(() => {
    setLightbox(null)
    if (photoIsInLocation()) {
      clearPhotoFromLocation()
    }
  }, [])

  const gate = useMemo(
    () => createLoadGate(maxConcurrentImageLoads),
    [],
  )
  const columns = galleryColumns

  const rows = useMemo(() => {
    const out: GalleryEntry[][] = []
    for (let i = 0; i < items.length; i += columns) {
      out.push(items.slice(i, i + columns))
    }
    return out
  }, [items, columns])

  if (items.length === 0) {
    return (
      <p className="gallery-empty gallery-empty-filter">
        Nothing in this series yet. Choose another filter or add matching images to
        your gallery folder.
      </p>
    )
  }

  return (
    <>
      <div className="gallery-grid">
        {rows.map((row) => (
          <GalleryRow
            key={row.map((x) => x.file).join('|')}
            row={row}
            columns={columns}
            gate={gate}
            onPhotoOpen={openLightbox}
          />
        ))}
      </div>
      {lightbox ? (
        <PhotoLightbox
          key={lightbox.file}
          photo={lightbox}
          siteTitle={siteTitle}
          onClose={closeLightbox}
          onAdjacent={items.length > 1 ? goAdjacent : undefined}
        />
      ) : null}
    </>
  )
}
