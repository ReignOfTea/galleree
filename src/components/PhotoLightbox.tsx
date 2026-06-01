import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react'
import { createPortal } from 'react-dom'
import type { GalleryEntry } from '../hooks/useGalleryManifest'
import { galleryImageDescription, formatCaptureDate } from '../lib/galleryLabels'
import { mergeGalleryLensIntoExifCameraModel } from '../lib/exifDisplay'
import { lockBodyScroll } from '../lib/bodyScrollLock'
import {
  ambientSizeFromIntensity,
  ambientStrengthFromIntensity,
  getStoredAmbientIntensity,
  getStoredLightboxAmbient,
  sampleAmbientFromImage,
  sampleAmbientFromVisibleImage,
  setStoredAmbientIntensity,
  setStoredLightboxAmbient,
  getVisibleImageLayout,
  type AmbientColors,
  type VisibleImageLayout,
} from '../lib/lightboxAmbient'
import { collectionPageUrl } from '../lib/collectionDeepLink'
import { shareGalleryPageOnSocials } from '../lib/shareGalleryPhoto'
import type { EquipmentOpenContext } from './EquipmentCaptionLink'
import { useViewportAnchoredPopover } from '../lib/anchorPopover'
import { useFocusTrap } from '../lib/focusTrap'
import { LightboxDetailsAside } from './lightbox/LightboxDetailsAside'
import { LightboxHelpPanel } from './lightbox/LightboxHelpPanel'
import { LightboxStage } from './lightbox/LightboxStage'
import { LightboxToolbar } from './lightbox/LightboxToolbar'
import {
  enterFullscreenElement,
  exitFullscreenDocument,
  getFullscreenElement,
} from './lightbox/lightboxFullscreen'
import {
  absoluteAssetUrl,
  applyZoomToward,
  clampScale,
  MIN_SCALE,
  type Pan,
} from './lightbox/lightboxZoom'

export type LightboxPhoto = GalleryEntry

type Props = {
  photo: LightboxPhoto
  siteTitle: string
  /** When viewing a filtered collection, enables “Copy collection link”. */
  collectionSlug?: string | null
  onClose: () => void
  /** Prev/next image in gallery order when multiple items (`items.length > 1`). */
  onAdjacent?: (direction: -1 | 1) => void
  onEquipmentOpen?: (ctx: EquipmentOpenContext) => void
  /** Other photos in the same collection (for details panel). */
  collectionPeers?: GalleryEntry[]
  onOpenCollectionPeer?: (entry: GalleryEntry) => void
  selectedTags?: readonly string[]
  onToggleTag?: (tag: string) => void
}

export function PhotoLightbox({
  photo,
  siteTitle,
  collectionSlug = null,
  onClose,
  onAdjacent,
  onEquipmentOpen,
  collectionPeers = [],
  onOpenCollectionPeer,
  selectedTags = [],
  onToggleTag,
}: Props) {
  const closeBtnRef = useRef<HTMLButtonElement>(null)
  const shellRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const viewportRef = useRef<HTMLDivElement>(null)

  useFocusTrap(shellRef, true, { initialFocus: 'first' })

  const [view, setView] = useState({ scale: MIN_SCALE, pan: { x: 0, y: 0 } as Pan })
  const [shareOpen, setShareOpen] = useState(false)
  const [shareNotice, setShareNotice] = useState<string | null>(null)
  const shareBtnRef = useRef<HTMLButtonElement>(null)
  const sharePanelRef = useRef<HTMLDivElement>(null)
  const settingsDetailsRef = useRef<HTMLDetailsElement>(null)
  const settingsTriggerRef = useRef<HTMLElement>(null)
  const settingsPanelRef = useRef<HTMLDivElement>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [imageLoaded, setImageLoaded] = useState(false)
  const [ambientOn, setAmbientOn] = useState(getStoredLightboxAmbient)
  const [ambientIntensity, setAmbientIntensity] = useState(getStoredAmbientIntensity)
  const [ambientColors, setAmbientColors] = useState<AmbientColors | null>(null)
  const [ambientBrightness, setAmbientBrightness] = useState(1)
  const [ambientLayout, setAmbientLayout] = useState<VisibleImageLayout | null>(
    null,
  )
  const [ambientInteracting, setAmbientInteracting] = useState(false)
  const imageRef = useRef<HTMLImageElement>(null)
  useViewportAnchoredPopover(shareBtnRef, sharePanelRef, shareOpen)
  useViewportAnchoredPopover(settingsTriggerRef, settingsPanelRef, settingsOpen)

  useEffect(() => {
    const details = settingsDetailsRef.current
    if (!details) return
    const onToggle = () => setSettingsOpen(details.open)
    details.addEventListener('toggle', onToggle)
    return () => details.removeEventListener('toggle', onToggle)
  }, [])

  const assignImageRef = useCallback((node: HTMLImageElement | null) => {
    imageRef.current = node
    if (node?.complete && node.naturalWidth > 0) {
      setImageLoaded(true)
    }
  }, [])

  const previewUrl = photo.thumbUrl ?? null

  const syncAmbient = useCallback(() => {
    const img = imageRef.current
    const vp = viewportRef.current
    if (!img?.naturalWidth || !vp) return

    const layout = getVisibleImageLayout(img, vp)
    if (layout) setAmbientLayout(layout)

    if (!ambientOn) return
    const sample =
      sampleAmbientFromVisibleImage(img, vp) ?? sampleAmbientFromImage(img)
    if (sample) {
      setAmbientColors(sample.colors)
      setAmbientBrightness(sample.brightness)
    }
  }, [ambientOn])

  useEffect(() => {
    if (!imageLoaded) return
    let cancelled = false
    const run = () => {
      if (cancelled) return
      syncAmbient()
    }
    const id = window.requestAnimationFrame(run)
    return () => {
      cancelled = true
      window.cancelAnimationFrame(id)
    }
  }, [
    imageLoaded,
    photo.viewUrl,
    view.pan.x,
    view.pan.y,
    view.scale,
    syncAmbient,
  ])

  useEffect(() => {
    const vp = viewportRef.current
    if (!vp || !imageLoaded) return
    const ro = new ResizeObserver(() => syncAmbient())
    ro.observe(vp)
    return () => ro.disconnect()
  }, [imageLoaded, photo.viewUrl, syncAmbient])

  const setAmbientEnabled = useCallback(
    (next: boolean) => {
      setAmbientOn(next)
      setStoredLightboxAmbient(next)
      if (!next) {
        setAmbientColors(null)
        setAmbientBrightness(1)
      } else {
        syncAmbient()
      }
    },
    [syncAmbient],
  )

  const onAmbientIntensityChange = useCallback((value: number) => {
    setAmbientIntensity(value)
    setStoredAmbientIntensity(value)
  }, [])

  const handleMainImageLoad = useCallback(() => {
    setImageLoaded(true)
    syncAmbient()
  }, [syncAmbient])

  const handlePreviewLoad = useCallback(() => {
    if (!imageLoaded) syncAmbient()
  }, [syncAmbient, imageLoaded])

  const exifRows = useMemo(
    () => mergeGalleryLensIntoExifCameraModel(photo.exifRows, photo.lensLabel),
    [photo.exifRows, photo.lensLabel],
  )

  const resetView = useCallback(() => {
    setView({ scale: MIN_SCALE, pan: { x: 0, y: 0 } })
  }, [])

  const showShareNotice = useCallback((message: string) => {
    setShareNotice(message)
    window.setTimeout(() => setShareNotice(null), 2800)
  }, [])

  useEffect(() => {
    if (!shareOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShareOpen(false)
    }
    const onPointerDown = (e: PointerEvent) => {
      const t = e.target as Node
      if (sharePanelRef.current?.contains(t)) return
      if (shareBtnRef.current?.contains(t)) return
      setShareOpen(false)
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('pointerdown', onPointerDown, true)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('pointerdown', onPointerDown, true)
    }
  }, [shareOpen])

  const pageUrl =
    typeof window !== 'undefined' ? window.location.href.split('#')[0] : ''

  /** Rich-preview URL for Discord etc.; `#photo=` is never seen by crawlers. */
  const shareLinkUrl = photo.sharePageUrl ?? pageUrl

  const dateLabel =
    photo.capturedAt != null
      ? formatCaptureDate(
          photo.capturedAt,
          photo.capturedAtIsDateOnly,
          'toolbar',
        )
      : null

  const metaParts = [
    dateLabel,
    photo.cameraLabel,
    photo.eventLabel,
  ].filter(Boolean) as string[]

  const shareText = [
    siteTitle,
    photo.displayTitle,
    photo.locationDisplay,
    photo.file,
  ]
    .filter(Boolean)
    .join(' — ')

  const imageDescription = galleryImageDescription(photo)

  const exitFullscreenIfNeeded = useCallback(() => {
    if (getFullscreenElement()) {
      exitFullscreenDocument()
    }
  }, [])

  const handleClose = useCallback(() => {
    exitFullscreenIfNeeded()
    onClose()
  }, [exitFullscreenIfNeeded, onClose])

  const setViewFromWheel = useCallback(
    (clientX: number, clientY: number, deltaY: number, ctrlKey: boolean) => {
      const stage = viewportRef.current
      if (!stage) return

      const rect = stage.getBoundingClientRect()
      const ox = clientX - rect.left - rect.width / 2
      const oy = clientY - rect.top - rect.height / 2

      const sensitivity = ctrlKey ? 0.035 : 0.0022
      const factor = Math.exp(-deltaY * sensitivity)

      setView((v) => {
        const newScale = clampScale(v.scale * factor)
        if (Math.abs(newScale - v.scale) < 1e-6) return v
        return applyZoomToward(v, ox, oy, newScale)
      })
    },
    [],
  )

  const ambientWheelEndRef = useRef<number | null>(null)

  const pulseAmbientInteracting = useCallback(() => {
    setAmbientInteracting(true)
    if (ambientWheelEndRef.current != null) {
      window.clearTimeout(ambientWheelEndRef.current)
    }
    ambientWheelEndRef.current = window.setTimeout(() => {
      setAmbientInteracting(false)
      ambientWheelEndRef.current = null
    }, 140)
  }, [])

  useEffect(() => {
    const el = viewportRef.current
    if (!el) return

    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      e.stopPropagation()
      pulseAmbientInteracting()
      setViewFromWheel(e.clientX, e.clientY, e.deltaY, e.ctrlKey)
    }

    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [setViewFromWheel, pulseAmbientInteracting, photo.file])

  const zoomAtCenter = useCallback((multiply: number) => {
    setView((v) =>
      applyZoomToward(v, 0, 0, clampScale(v.scale * multiply)),
    )
  }, [])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (helpOpen) {
          setHelpOpen(false)
          return
        }
        if (detailsOpen) {
          setDetailsOpen(false)
          return
        }
        handleClose()
        return
      }
      if (e.key === '?' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault()
        setHelpOpen((open) => !open)
        return
      }
      if (
        onAdjacent &&
        (e.key === 'ArrowLeft' || e.key === 'ArrowRight')
      ) {
        e.preventDefault()
        onAdjacent(e.key === 'ArrowLeft' ? -1 : 1)
        return
      }
      if (e.key === '+' || e.key === '=') {
        e.preventDefault()
        zoomAtCenter(1.18)
        return
      }
      if (e.key === '-' || e.key === '_') {
        e.preventDefault()
        zoomAtCenter(1 / 1.18)
        return
      }
      if (e.key === '0') {
        e.preventDefault()
        resetView()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    const unlockScroll = lockBodyScroll()
    queueMicrotask(() =>
      closeBtnRef.current?.focus({ preventScroll: true }),
    )

    return () => {
      window.removeEventListener('keydown', onKeyDown)
      unlockScroll()
      exitFullscreenIfNeeded()
    }
  }, [
    handleClose,
    exitFullscreenIfNeeded,
    onAdjacent,
    resetView,
    zoomAtCenter,
    detailsOpen,
    helpOpen,
  ])

  const pinchRef = useRef<{
    dist: number
    scale: number
    pan: Pan
    ox: number
    oy: number
  } | null>(null)

  const swipeRef = useRef<{ x: number; y: number } | null>(null)

  const selectedTagSet = useMemo(
    () => new Set(selectedTags),
    [selectedTags],
  )

  const dragRef = useRef<{
    pointerId: number
    lastX: number
    lastY: number
  } | null>(null)

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return
    if (view.scale <= MIN_SCALE) return
    setAmbientInteracting(true)
    dragRef.current = {
      pointerId: e.pointerId,
      lastX: e.clientX,
      lastY: e.clientY,
    }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current || dragRef.current.pointerId !== e.pointerId) return

    const dx = e.clientX - dragRef.current.lastX
    const dy = e.clientY - dragRef.current.lastY
    dragRef.current.lastX = e.clientX
    dragRef.current.lastY = e.clientY

    setView((v) => {
      if (v.scale <= MIN_SCALE) return v
      return {
        ...v,
        pan: { x: v.pan.x + dx, y: v.pan.y + dy },
      }
    })
  }

  const onPointerUp = (e: React.PointerEvent) => {
    if (!dragRef.current || dragRef.current.pointerId !== e.pointerId) return
    try {
      ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
    dragRef.current = null
    setAmbientInteracting(false)
  }

  const onDoubleClick = (e: React.MouseEvent) => {
    e.preventDefault()
    const stage = viewportRef.current
    if (!stage) return
    const rect = stage.getBoundingClientRect()
    const ox = e.clientX - rect.left - rect.width / 2
    const oy = e.clientY - rect.top - rect.height / 2

    setView((v) => {
      if (v.scale > MIN_SCALE + 0.08) {
        return { scale: MIN_SCALE, pan: { x: 0, y: 0 } }
      }
      const target = clampScale(Math.max(2, v.scale * 2))
      return applyZoomToward(v, ox, oy, target)
    })
  }

  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1 && view.scale <= MIN_SCALE + 0.02 && !pinchRef.current) {
      swipeRef.current = {
        x: e.touches[0]!.clientX,
        y: e.touches[0]!.clientY,
      }
    }
    if (e.touches.length !== 2) return
    swipeRef.current = null
    const stage = viewportRef.current
    if (!stage) return
    const rect = stage.getBoundingClientRect()
    const [t1, t2] = [e.touches[0], e.touches[1]]
    const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY)
    const cx =
      (t1.clientX + t2.clientX) / 2 - rect.left - rect.width / 2
    const cy =
      (t1.clientY + t2.clientY) / 2 - rect.top - rect.height / 2

    setAmbientInteracting(true)
    setView((v) => {
      pinchRef.current = {
        dist,
        scale: v.scale,
        pan: { ...v.pan },
        ox: cx,
        oy: cy,
      }
      return v
    })
  }

  const onTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) {
      swipeRef.current = null
    }
    const p = pinchRef.current
    if (!p || e.touches.length !== 2) return
    e.preventDefault()
    const [t1, t2] = [e.touches[0], e.touches[1]]
    const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY)
    const newScale = clampScale(p.scale * (dist / p.dist))
    if (newScale <= MIN_SCALE) {
      pinchRef.current = null
      resetView()
      return
    }
    const ratio = newScale / p.scale
    const next = {
      scale: newScale,
      pan: {
        x: p.ox - (p.ox - p.pan.x) * ratio,
        y: p.oy - (p.oy - p.pan.y) * ratio,
      },
    }
    setView(next)
  }

  const onTouchEnd = (e: React.TouchEvent) => {
    const swipeStart = swipeRef.current
    swipeRef.current = null

    if (
      swipeStart &&
      onAdjacent &&
      view.scale <= MIN_SCALE + 0.02 &&
      e.changedTouches.length === 1
    ) {
      const t = e.changedTouches[0]!
      const dx = t.clientX - swipeStart.x
      const dy = t.clientY - swipeStart.y
      const minSwipe = 52
      if (
        Math.abs(dx) >= minSwipe &&
        Math.abs(dx) > Math.abs(dy) * 1.35
      ) {
        onAdjacent(dx < 0 ? 1 : -1)
      }
    }

    if (e.touches.length < 2) {
      pinchRef.current = null
      setAmbientInteracting(false)
    }
  }

  const imageLinkUrl = useMemo(
    () => absoluteAssetUrl(photo.url),
    [photo.url],
  )

  const collectionLinkUrl = useMemo(() => {
    if (!collectionSlug || typeof window === 'undefined') return null
    return collectionPageUrl(collectionSlug)
  }, [collectionSlug])

  const copyText = useCallback(async (text: string, successMessage: string) => {
    try {
      await navigator.clipboard.writeText(text)
      showShareNotice(successMessage)
      setShareOpen(false)
    } catch {
      showShareNotice('Could not copy to clipboard.')
    }
  }, [showShareNotice])

  const handleShareOnSocials = useCallback(async () => {
    const r = await shareGalleryPageOnSocials({
      title: siteTitle,
      text: shareText,
      pageUrl: shareLinkUrl,
    })
    if (r.ok === false) {
      if (r.reason === 'abort') return
      showShareNotice(r.message ?? 'Could not share.')
      return
    }
    setShareOpen(false)
    if (r.mode === 'clipboard-url') {
      showShareNotice('Link copied…')
    }
  }, [siteTitle, shareText, shareLinkUrl, showShareNotice])

  const copyPageLink = useCallback(() => {
    void copyText(shareLinkUrl, 'Page link copied…')
  }, [copyText, shareLinkUrl])

  const copyImageLink = useCallback(() => {
    void copyText(imageLinkUrl, 'Image link copied…')
  }, [copyText, imageLinkUrl])

  const copyCollectionLink = useCallback(() => {
    if (!collectionLinkUrl) return
    void copyText(collectionLinkUrl, 'Collection link copied…')
  }, [copyText, collectionLinkUrl])

  const toggleFullscreen = useCallback(() => {
    const el = stageRef.current
    if (!el) return
    try {
      if (getFullscreenElement()) {
        exitFullscreenDocument()
      } else {
        enterFullscreenElement(el)
      }
    } catch {
      /* unsupported or denied */
    }
  }, [])

  const zoomPercent = Math.round(view.scale * 100)

  const ambientStrength = ambientStrengthFromIntensity(ambientIntensity)
  const ambientSize = ambientSizeFromIntensity(ambientIntensity)

  const ambientStyle: CSSProperties | undefined = ambientOn
    ? ({
        '--lightbox-ambient-strength': String(ambientStrength),
        '--lightbox-ambient-brightness': String(ambientBrightness),
        ...(ambientColors
          ? {
              '--lightbox-ambient-tl': ambientColors.tl,
              '--lightbox-ambient-tr': ambientColors.tr,
              '--lightbox-ambient-bl': ambientColors.bl,
              '--lightbox-ambient-br': ambientColors.br,
            }
          : {}),
      } as CSSProperties)
    : undefined

  const ambientHostStyle: CSSProperties | undefined = ambientOn
    ? {
        ...(ambientLayout
          ? {
              left: ambientLayout.centerX,
              top: ambientLayout.centerY,
              width: Math.max(ambientLayout.width * 1.18, 96),
              height: Math.max(ambientLayout.height * 1.18, 72),
            }
          : {}),
        transform: `translate(-50%, -50%) scale(${ambientSize})`,
        ...ambientStyle,
      }
    : undefined

  const node = (
    <div
      className={
        ambientOn
          ? 'lightbox-root lightbox-root--ambient'
          : 'lightbox-root'
      }
      role="dialog"
      aria-modal="true"
      aria-labelledby="lightbox-title"
    >
      <button
        type="button"
        className="lightbox-backdrop"
        aria-label="Close photo viewer"
        onClick={handleClose}
      />

      <div
        ref={shellRef}
        className="lightbox-shell"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <LightboxToolbar
          photo={photo}
          metaParts={metaParts}
          zoomPercent={zoomPercent}
          shareOpen={shareOpen}
          detailsOpen={detailsOpen}
          ambientOn={ambientOn}
          ambientIntensity={ambientIntensity}
          closeBtnRef={closeBtnRef}
          shareBtnRef={shareBtnRef}
          sharePanelRef={sharePanelRef}
          settingsDetailsRef={settingsDetailsRef}
          settingsTriggerRef={settingsTriggerRef}
          settingsPanelRef={settingsPanelRef}
          onClose={handleClose}
          onZoomOut={() => zoomAtCenter(1 / 1.18)}
          onZoomIn={() => zoomAtCenter(1.18)}
          onResetView={resetView}
          onShareToggle={() => setShareOpen((o) => !o)}
          onShareSocials={() => void handleShareOnSocials()}
          onCopyImageLink={copyImageLink}
          onCopyPageLink={copyPageLink}
          onCopyCollectionLink={copyCollectionLink}
          hasCollectionLink={Boolean(collectionLinkUrl)}
          onFullscreen={toggleFullscreen}
          onDetailsToggle={() => setDetailsOpen((o) => !o)}
          onAmbientChange={setAmbientEnabled}
          onAmbientIntensityChange={onAmbientIntensityChange}
        />

        <LightboxStage
          photo={photo}
          imageDescription={imageDescription}
          view={view}
          imageLoaded={imageLoaded}
          previewUrl={previewUrl}
          ambientOn={ambientOn}
          ambientInteracting={ambientInteracting}
          ambientHostStyle={ambientHostStyle}
          ambientColors={ambientColors}
          selectedTagSet={selectedTagSet}
          stageRef={stageRef}
          viewportRef={viewportRef}
          imageRef={assignImageRef}
          handlers={{
            onPointerDown,
            onPointerMove,
            onPointerUp,
            onDoubleClick,
            onTouchStart,
            onTouchMove,
            onTouchEnd,
          }}
          onMainImageLoad={handleMainImageLoad}
          onPreviewLoad={handlePreviewLoad}
          onToggleTag={onToggleTag}
        />

        {shareNotice ? (
          <p className="lightbox-share-notice" role="status" aria-live="polite">
            {shareNotice}
          </p>
        ) : null}

        <LightboxHelpPanel
          open={helpOpen}
          detailsOpen={detailsOpen}
          hasAdjacent={Boolean(onAdjacent)}
          onClose={() => setHelpOpen(false)}
        />

        <p className="lightbox-hint-float">
          Scroll to zoom · drag to pan · double-click ·{' '}
          <kbd>Esc</kbd> close · <kbd>?</kbd> help
          {detailsOpen ? (
            <>
              {' '}
              · <kbd>Esc</kbd> also closes details
            </>
          ) : null}
          {onAdjacent ? (
            <>
              {' '}
              · <kbd>←</kbd> <kbd>→</kbd> or swipe prev/next
            </>
          ) : null}
        </p>

        {detailsOpen ? (
          <LightboxDetailsAside
            photo={photo}
            exifRows={exifRows}
            selectedTagSet={selectedTagSet}
            collectionPeers={collectionPeers}
            onClose={() => setDetailsOpen(false)}
            onEquipmentOpen={onEquipmentOpen}
            onOpenCollectionPeer={onOpenCollectionPeer}
            onToggleTag={onToggleTag}
          />
        ) : null}
      </div>
    </div>
  )

  return createPortal(node, document.body)
}
