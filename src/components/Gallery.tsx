import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { galleryColumns, maxConcurrentImageLoads } from '../lib/config'
import {
  clearPhotoFromLocation,
  parsePhotoFromLocation,
  photoIsInLocation,
  setPhotoInLocation,
} from '../lib/photoDeepLink'
import { createLoadGate } from '../lib/loadGate'
import { packJustifiedGalleryRows } from '../lib/galleryJustifiedLayout'
import type { GalleryEntry } from '../hooks/useGalleryManifest'
import { useGalleryManifest } from '../hooks/useGalleryManifest'
import type { ResolvedEmptyMessages } from '../lib/siteConfig'
import { resolveCameraEquipmentDetail } from '../lib/galleryEquipmentMeta'
import type { EquipmentOpenContext } from './EquipmentCaptionLink'
import { EquipmentDetailModal } from './EquipmentDetailModal'
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
  /** Why the grid is empty when filters/search yield nothing */
  emptyHint?: 'filters' | 'search'
  emptyMessages: ResolvedEmptyMessages
  selectedTags: readonly string[]
  onToggleTag: (tag: string) => void
}

type GridMetrics = {
  width: number
  gap: number
}

function readGridMetrics(el: HTMLElement): GridMetrics {
  const style = getComputedStyle(el)
  const gap =
    parseFloat(style.getPropertyValue('--gallery-gap')) ||
    parseFloat(style.columnGap) ||
    parseFloat(style.gap) ||
    16
  return { width: el.clientWidth, gap }
}

export function Gallery({
  items,
  allItems,
  siteTitle,
  emptyHint,
  emptyMessages,
  selectedTags,
  onToggleTag,
}: Props) {
  const [lightbox, setLightbox] = useState<LightboxPhoto | null>(null)
  const [equipmentModal, setEquipmentModal] =
    useState<EquipmentOpenContext | null>(null)
  const { equipment } = useGalleryManifest()
  const gridRef = useRef<HTMLDivElement>(null)
  const [gridMetrics, setGridMetrics] = useState<GridMetrics>({ width: 0, gap: 16 })

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

  const openEquipment = useCallback((ctx: EquipmentOpenContext) => {
    if (!ctx.cameraRef.hasRegistry) return
    setEquipmentModal(ctx)
  }, [])

  const closeEquipment = useCallback(() => {
    setEquipmentModal(null)
  }, [])

  const equipmentDetail =
    equipmentModal != null
      ? resolveCameraEquipmentDetail(
          equipment,
          equipmentModal.cameraRef.slug,
          equipmentModal.lensRef,
        )
      : null

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

  useEffect(() => {
    const el = gridRef.current
    if (!el) return

    const update = () => setGridMetrics(readGridMetrics(el))
    update()

    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [items.length])

  const gate = useMemo(
    () => createLoadGate(maxConcurrentImageLoads),
    [],
  )
  const selectedTagSet = useMemo(() => new Set(selectedTags), [selectedTags])
  const columns = galleryColumns

  const layoutRows = useMemo(() => {
    if (gridMetrics.width <= 0) {
      const fallback: { items: GalleryEntry[]; thumbHeight: number }[] = []
      for (let i = 0; i < items.length; i += columns) {
        fallback.push({
          items: items.slice(i, i + columns),
          thumbHeight: 280,
        })
      }
      return fallback
    }
    return packJustifiedGalleryRows(items, {
      maxCols: columns,
      containerWidth: gridMetrics.width,
      gap: gridMetrics.gap,
    })
  }, [items, columns, gridMetrics])

  if (items.length === 0) {
    const message =
      emptyHint === 'search'
        ? emptyMessages.noSearch
        : emptyMessages.noFilters
    return (
      <p className="gallery-empty gallery-empty-filter">{message}</p>
    )
  }

  return (
    <>
      <div ref={gridRef} className="gallery-grid">
        {layoutRows.map((row, rowIndex) => (
          <GalleryRow
            key={row.items.map((x) => x.file).join('|')}
            row={row.items}
            thumbHeight={row.thumbHeight}
            gate={gate}
            priority={rowIndex < 3}
            onPhotoOpen={openLightbox}
            selectedTagSet={selectedTagSet}
            onToggleTag={onToggleTag}
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
          onEquipmentOpen={openEquipment}
        />
      ) : null}
      {equipmentModal && equipmentDetail ? (
        <EquipmentDetailModal
          camera={equipmentDetail.camera}
          lens={equipmentDetail.lens}
          onClose={closeEquipment}
        />
      ) : null}
    </>
  )
}
