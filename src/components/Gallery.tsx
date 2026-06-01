import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import {
  galleryColumns,
  galleryVirtualizeBatch,
  galleryVirtualizeInitial,
  galleryVirtualizeThreshold,
  maxConcurrentImageLoads,
} from '../lib/config'
import { GALLERY_HOME_NAV_EVENT } from '../lib/galleryHomeNav'
import type { GalleryEquipmentRegistry } from '../lib/galleryEquipmentMeta'
import {
  clearPhotoFromLocation,
  parsePhotoFromLocation,
  photoIsInLocation,
  setPhotoInLocation,
} from '../lib/photoDeepLink'
import { createLoadGate } from '../lib/loadGate'
import {
  preloadLightboxImage,
  scheduleLightboxNeighborsPreload,
} from '../lib/lightboxPreload'
import { packJustifiedGalleryRows } from '../lib/galleryJustifiedLayout'
import type { GalleryEntry } from '../hooks/useGalleryManifest'
import type { ResolvedEmptyMessages } from '../lib/siteConfig'
import { resolveCameraEquipmentDetail } from '../lib/galleryEquipmentMeta'
import type { EquipmentOpenContext } from './EquipmentCaptionLink'
import { EquipmentDetailModal } from './EquipmentDetailModal'
import { GalleryRow } from './GalleryRow'

const PhotoLightbox = lazy(() =>
  import('./PhotoLightbox').then((m) => ({ default: m.PhotoLightbox })),
)

export type { LightboxPhoto } from './PhotoLightbox'

function toLightboxPhoto(entry: GalleryEntry) {
  return entry
}

type Props = {
  items: GalleryEntry[]
  allItems: GalleryEntry[]
  equipment: GalleryEquipmentRegistry
  siteTitle: string
  collectionSlug?: string | null
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
  equipment,
  siteTitle,
  collectionSlug = null,
  emptyHint,
  emptyMessages,
  selectedTags,
  onToggleTag,
}: Props) {
  const [lightbox, setLightbox] = useState<GalleryEntry | null>(null)
  const returnFocusRef = useRef<HTMLElement | null>(null)
  const [equipmentModal, setEquipmentModal] =
    useState<EquipmentOpenContext | null>(null)
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

  useEffect(() => {
    const onHome = () => {
      setLightbox(null)
      setEquipmentModal(null)
      clearPhotoFromLocation()
    }
    window.addEventListener(GALLERY_HOME_NAV_EVENT, onHome)
    return () => window.removeEventListener(GALLERY_HOME_NAV_EVENT, onHome)
  }, [])

  const openLightbox = useCallback((item: GalleryEntry) => {
    returnFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null
    preloadLightboxImage(item.viewUrl)
    setLightbox(toLightboxPhoto(item))
  }, [])

  const warmLightboxImage = useCallback((item: GalleryEntry) => {
    preloadLightboxImage(item.viewUrl)
  }, [])

  useEffect(() => {
    if (!lightbox) return
    preloadLightboxImage(lightbox.viewUrl)
    scheduleLightboxNeighborsPreload(items, lightbox.file)
  }, [lightbox, items])

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

  const openCollectionPeer = useCallback((entry: GalleryEntry) => {
    preloadLightboxImage(entry.viewUrl)
    setLightbox(toLightboxPhoto(entry))
  }, [])

  const collectionPeersFor = useCallback(
    (photo: GalleryEntry) => {
      const slug = photo.collectionSlug
      if (!slug) return []
      return allItems
        .filter(
          (e) => e.collectionSlug === slug && e.file !== photo.file,
        )
        .slice(0, 4)
    },
    [allItems],
  )

  const closeLightbox = useCallback(() => {
    setLightbox(null)
    if (photoIsInLocation()) {
      clearPhotoFromLocation()
    }
    const el = returnFocusRef.current
    returnFocusRef.current = null
    queueMicrotask(() => el?.focus({ preventScroll: true }))
  }, [])

  useEffect(() => {
    if (!lightbox) return
    const prev = document.title
    const label = lightbox.displayTitle ?? lightbox.file
    document.title = `${label} — ${siteTitle}`
    return () => {
      document.title = prev
    }
  }, [lightbox, siteTitle])

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
  const useProgressive = items.length > galleryVirtualizeThreshold
  const loadMoreRef = useRef<HTMLDivElement>(null)
  const [progressiveVisible, setProgressiveVisible] = useState(() =>
    Math.min(items.length, galleryVirtualizeInitial),
  )
  const [progressiveCtx, setProgressiveCtx] = useState({
    length: items.length,
    enabled: useProgressive,
  })
  if (
    progressiveCtx.length !== items.length ||
    progressiveCtx.enabled !== useProgressive
  ) {
    setProgressiveCtx({ length: items.length, enabled: useProgressive })
    if (useProgressive) {
      setProgressiveVisible(
        Math.min(items.length, galleryVirtualizeInitial),
      )
    }
  }
  const visibleCount = useProgressive ? progressiveVisible : items.length

  const windowedItems = useMemo(
    () => (useProgressive ? items.slice(0, visibleCount) : items),
    [items, useProgressive, visibleCount],
  )

  useEffect(() => {
    if (!useProgressive || visibleCount >= items.length) return
    const el = loadMoreRef.current
    if (!el) return
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return
        setProgressiveVisible((c) =>
          Math.min(items.length, c + galleryVirtualizeBatch),
        )
      },
      { rootMargin: '480px 0px', threshold: 0 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [useProgressive, visibleCount, items.length])

  const layoutRows = useMemo(() => {
    if (gridMetrics.width <= 0) {
      const fallback: { items: GalleryEntry[]; thumbHeight: number }[] = []
      for (let i = 0; i < windowedItems.length; i += columns) {
        fallback.push({
          items: windowedItems.slice(i, i + columns),
          thumbHeight: 280,
        })
      }
      return fallback
    }
    return packJustifiedGalleryRows(windowedItems, {
      maxCols: columns,
      containerWidth: gridMetrics.width,
      gap: gridMetrics.gap,
    })
  }, [windowedItems, columns, gridMetrics])

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
            onPhotoWarm={warmLightboxImage}
            selectedTagSet={selectedTagSet}
            onToggleTag={onToggleTag}
          />
        ))}
        {useProgressive && visibleCount < items.length ? (
          <div
            ref={loadMoreRef}
            className="gallery-load-more-sentinel"
            aria-hidden
          />
        ) : null}
      </div>
      {lightbox ? (
        <Suspense fallback={null}>
          <PhotoLightbox
            key={lightbox.file}
            photo={lightbox}
            siteTitle={siteTitle}
            collectionSlug={collectionSlug}
            onClose={closeLightbox}
            onAdjacent={items.length > 1 ? goAdjacent : undefined}
            onEquipmentOpen={openEquipment}
            collectionPeers={collectionPeersFor(lightbox)}
            onOpenCollectionPeer={openCollectionPeer}
            selectedTags={selectedTags}
            onToggleTag={onToggleTag}
          />
        </Suspense>
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
