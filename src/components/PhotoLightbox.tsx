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
import { useImageExif } from '../hooks/useImageExif'
import { galleryImageDescription, formatCaptureDate } from '../lib/galleryLabels'
import { mergeGalleryLensIntoExifCameraModel } from '../lib/exifDisplay'
import { lockBodyScroll } from '../lib/bodyScrollLock'
import {
  AMBIENT_INTENSITY_MAX,
  AMBIENT_INTENSITY_MIN,
  ambientSizeFromIntensity,
  ambientStrengthFromIntensity,
  getStoredAmbientIntensity,
  getStoredLightboxAmbient,
  prefersAmbientOffByDefault,
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
import { LightboxEquipmentValue } from './LightboxEquipmentValue'
import { useViewportAnchoredPopover } from '../lib/anchorPopover'
import { useFocusTrap } from '../lib/focusTrap'
import {
  DetailCollectionPeers,
  DetailExifLoading,
  DetailField,
  DetailTagChips,
} from './lightbox/LightboxDetailsFields'
import {
  IconClose,
  IconDownload,
  IconFullscreen,
  IconInfo,
  IconShare,
} from './lightbox/LightboxIcons'

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

type FsDocument = Document & {
  webkitFullscreenElement?: Element | null
  webkitExitFullscreen?: () => Promise<void>
  mozFullScreenElement?: Element | null
  mozCancelFullScreen?: () => Promise<void>
  msFullscreenElement?: Element | null
  msExitFullscreen?: () => Promise<void>
}

type FsElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void
  mozRequestFullScreen?: () => Promise<void> | void
  msRequestFullscreen?: () => Promise<void> | void
}

function getFullscreenElement(): Element | null {
  const d = document as FsDocument
  return (
    document.fullscreenElement ??
    d.webkitFullscreenElement ??
    d.mozFullScreenElement ??
    d.msFullscreenElement ??
    null
  )
}

function exitFullscreenDocument(): void {
  const d = document as FsDocument
  const p =
    document.exitFullscreen?.() ??
    d.webkitExitFullscreen?.() ??
    d.mozCancelFullScreen?.() ??
    d.msExitFullscreen?.()
  void p?.catch(() => {})
}

/** Must run synchronously inside a click/key handler — no await before this. */
function enterFullscreenElement(el: HTMLElement): void {
  const node = el as FsElement
  const p =
    node.requestFullscreen?.() ??
    node.webkitRequestFullscreen?.() ??
    node.mozRequestFullScreen?.() ??
    node.msRequestFullscreen?.()
  if (p && typeof (p as Promise<void>).catch === 'function') {
    void (p as Promise<void>).catch(() => {})
  }
}

type Pan = { x: number; y: number }

const MIN_SCALE = 1
const MAX_SCALE = 8

function clampScale(s: number): number {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, s))
}

function applyZoomToward(
  v: { scale: number; pan: Pan },
  ox: number,
  oy: number,
  targetScale: number,
): { scale: number; pan: Pan } {
  const s = clampScale(targetScale)
  if (s <= MIN_SCALE) return { scale: MIN_SCALE, pan: { x: 0, y: 0 } }
  const ratio = s / v.scale
  return {
    scale: s,
    pan: {
      x: ox - (ox - v.pan.x) * ratio,
      y: oy - (oy - v.pan.y) * ratio,
    },
  }
}

function absoluteAssetUrl(path: string): string {
  if (typeof window === 'undefined') return path
  try {
    return new URL(path, window.location.origin).href
  } catch {
    return path
  }
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
  const exifState = useImageExif(detailsOpen ? photo.url : null)

  useViewportAnchoredPopover(shareBtnRef, sharePanelRef, shareOpen)
  useViewportAnchoredPopover(settingsTriggerRef, settingsPanelRef, settingsOpen)

  useEffect(() => {
    const details = settingsDetailsRef.current
    if (!details) return
    const onToggle = () => setSettingsOpen(details.open)
    details.addEventListener('toggle', onToggle)
    return () => details.removeEventListener('toggle', onToggle)
  }, [])

  useEffect(() => {
    setImageLoaded(false)
    setAmbientColors(null)
    const img = imageRef.current
    if (img?.complete && img.naturalWidth > 0) {
      setImageLoaded(true)
    }
  }, [photo.url])

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
    photo.url,
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
  }, [imageLoaded, photo.url, syncAmbient])

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

  const exifRows = useMemo(() => {
    if (exifState.status !== 'ok') return []
    return mergeGalleryLensIntoExifCameraModel(exifState.rows, photo.lensLabel)
  }, [exifState, photo.lensLabel])

  const resetView = useCallback(() => {
    setView({ scale: MIN_SCALE, pan: { x: 0, y: 0 } })
  }, [])

  useEffect(() => {
    resetView()
    setShareOpen(false)
  }, [photo.url, resetView])

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

  const filenameDateLong =
    photo.capturedAt != null
      ? formatCaptureDate(
          photo.capturedAt,
          photo.capturedAtIsDateOnly,
          'detailsLong',
        )
      : null

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
        <header className="lightbox-toolbar">
          <div className="lightbox-toolbar-cluster lightbox-toolbar-start">
            <button
              ref={closeBtnRef}
              type="button"
              className="lightbox-tool-icon"
              onClick={handleClose}
              aria-label="Close"
            >
              <span aria-hidden="true">×</span>
            </button>
            <div className="lightbox-title-stack">
              <p id="lightbox-title" className="lightbox-title lightbox-title-primary">
                {photo.displayTitle ?? photo.file}
              </p>
              {metaParts.length > 0 ? (
                <p className="lightbox-title-meta" aria-label="Photo details">
                  {metaParts.join(' · ')}
                </p>
              ) : null}
            </div>
            <span className="lightbox-zoom-readout" aria-live="polite">
              {zoomPercent}%
            </span>
          </div>

          <div
            className="lightbox-toolbar-cluster lightbox-toolbar-zoom"
            role="group"
            aria-label="Zoom"
          >
            <button
              type="button"
              className="lightbox-tool-icon"
              aria-label="Zoom out"
              onClick={() => zoomAtCenter(1 / 1.18)}
            >
              −
            </button>
            <button type="button" className="lightbox-tool-quiet" onClick={resetView}>
              Fit
            </button>
            <button
              type="button"
              className="lightbox-tool-icon"
              aria-label="Zoom in"
              onClick={() => zoomAtCenter(1.18)}
            >
              +
            </button>
          </div>

          <div className="lightbox-toolbar-cluster lightbox-toolbar-end">
            <a
              className="lightbox-tool-icon lightbox-tool-save"
              href={photo.url}
              download={photo.file}
              aria-label="Save image"
              title="Save"
            >
              <IconDownload className="lightbox-tool-icon-svg" />
            </a>
            <div className="lightbox-share-anchor">
              <button
                ref={shareBtnRef}
                type="button"
                className={
                  shareOpen
                    ? 'lightbox-tool-icon lightbox-tool-quiet-active'
                    : 'lightbox-tool-icon'
                }
                aria-label="Share"
                title="Share"
                aria-expanded={shareOpen}
                aria-haspopup="dialog"
                onClick={() => setShareOpen((o) => !o)}
              >
                <IconShare className="lightbox-tool-icon-svg" />
              </button>
            {shareOpen ? (
              <div
                ref={sharePanelRef}
                className="lightbox-share-panel"
                role="dialog"
                aria-label="Share options"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  className="lightbox-menu-item"
                  onClick={() => void handleShareOnSocials()}
                >
                  Share on socials
                </button>
                <button
                  type="button"
                  className="lightbox-menu-item"
                  onClick={copyImageLink}
                >
                  Copy image link
                </button>
                <button
                  type="button"
                  className="lightbox-menu-item"
                  onClick={copyPageLink}
                >
                  Copy page link
                </button>
                {collectionLinkUrl ? (
                  <button
                    type="button"
                    className="lightbox-menu-item"
                    onClick={copyCollectionLink}
                  >
                    Copy collection link
                  </button>
                ) : null}
              </div>
            ) : null}
            </div>
            <button
              type="button"
              className="lightbox-tool-icon"
              onClick={toggleFullscreen}
              aria-label="Fullscreen"
              title="Fullscreen"
            >
              <IconFullscreen className="lightbox-tool-icon-svg" />
            </button>
            <button
              type="button"
              className={
                detailsOpen
                  ? 'lightbox-tool-icon lightbox-tool-quiet-active'
                  : 'lightbox-tool-icon'
              }
              aria-label="Photo details"
              title="Details"
              aria-expanded={detailsOpen}
              aria-controls="lightbox-details-panel"
              onClick={() => setDetailsOpen((o) => !o)}
            >
              <IconInfo className="lightbox-tool-icon-svg" />
            </button>
            <details ref={settingsDetailsRef} className="lightbox-settings">
              <summary
                ref={settingsTriggerRef}
                className="lightbox-tool-icon lightbox-settings-trigger"
                aria-label="Viewer settings"
                title="Viewer settings"
              >
                <span className="lightbox-settings-icon" aria-hidden="true">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                  </svg>
                </span>
              </summary>
              <div
                ref={settingsPanelRef}
                className="lightbox-settings-panel"
                onClick={(e) => e.stopPropagation()}
              >
                <label className="lightbox-settings-toggle">
                  <span className="lightbox-settings-label">Ambient glow</span>
                  <input
                    type="checkbox"
                    className="lightbox-settings-checkbox"
                    checked={ambientOn}
                    onChange={(e) => setAmbientEnabled(e.target.checked)}
                  />
                </label>
                {prefersAmbientOffByDefault() ? (
                  <p className="lightbox-settings-hint">
                    Off by default on this device for smoother performance. You can
                    turn it on here.
                  </p>
                ) : null}
                <div className="lightbox-settings-slider-row">
                  <label
                    className="lightbox-settings-label"
                    htmlFor="lightbox-ambient-intensity"
                  >
                    Intensity
                  </label>
                  <input
                    id="lightbox-ambient-intensity"
                    type="range"
                    className="lightbox-settings-range"
                    min={AMBIENT_INTENSITY_MIN}
                    max={AMBIENT_INTENSITY_MAX}
                    step={1}
                    value={ambientIntensity}
                    disabled={!ambientOn}
                    aria-valuemin={AMBIENT_INTENSITY_MIN}
                    aria-valuemax={AMBIENT_INTENSITY_MAX}
                    aria-valuenow={ambientIntensity}
                    aria-valuetext={`${ambientIntensity} percent`}
                    onChange={(e) =>
                      onAmbientIntensityChange(Number(e.target.value))
                    }
                  />
                  <span className="lightbox-settings-value" aria-hidden="true">
                    {ambientIntensity}
                  </span>
                </div>
              </div>
            </details>
          </div>
        </header>

        <div ref={stageRef} className="lightbox-stage">
          <div
            ref={viewportRef}
            className={
              view.scale > MIN_SCALE
                ? 'lightbox-viewport lightbox-viewport-pannable'
                : 'lightbox-viewport'
            }
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onLostPointerCapture={onPointerUp}
            onDoubleClick={onDoubleClick}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
            onTouchCancel={onTouchEnd}
          >
            {(() => {
              const stripTags = photo.tags.filter(
                (t) => t !== photo.locationDisplay,
              )
              return stripTags.length > 0 ? (
                <div
                  className="lightbox-tags-strip"
                  aria-label="Tags for this photo"
                >
                  <span className="lightbox-tags-strip-label">Tags</span>
                  <ul className="lightbox-tags-strip-list">
                    {[...stripTags]
                      .sort((a, b) => a.localeCompare(b))
                      .map((tag) => {
                        const active = selectedTagSet.has(tag)
                        return (
                          <li key={tag}>
                            <button
                              type="button"
                              className={
                                active
                                  ? 'lightbox-tag-pill lightbox-tag-pill-active'
                                  : 'lightbox-tag-pill'
                              }
                              aria-pressed={active}
                              aria-label={
                                active
                                  ? `Remove tag filter: ${tag}`
                                  : `Filter by tag: ${tag}`
                              }
                              onClick={(e) => {
                                e.stopPropagation()
                                onToggleTag?.(tag)
                              }}
                            >
                              {tag}
                            </button>
                          </li>
                        )
                      })}
                  </ul>
                </div>
              ) : null
            })()}
            {ambientOn ? (
              <div
                className={
                  ambientInteracting
                    ? 'lightbox-ambient-host'
                    : 'lightbox-ambient-host lightbox-ambient-host--smooth'
                }
                style={ambientHostStyle}
              >
                <div
                  className={[
                    'lightbox-ambient',
                    ambientColors ? 'lightbox-ambient-visible' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  aria-hidden
                >
                  <span className="lightbox-ambient-corner lightbox-ambient-corner--tl" />
                  <span className="lightbox-ambient-corner lightbox-ambient-corner--tr" />
                  <span className="lightbox-ambient-corner lightbox-ambient-corner--bl" />
                  <span className="lightbox-ambient-corner lightbox-ambient-corner--br" />
                </div>
              </div>
            ) : null}
            {photo.locationDisplay ? (
              <div className="lightbox-location-badge" aria-label="Location">
                <span className="lightbox-location-kicker">Location</span>
                <span className="lightbox-location-name">
                  {photo.locationDisplay}
                </span>
              </div>
            ) : null}
            <div
              className="lightbox-zoom-layer"
              style={{
                transform: `translate(${view.pan.x}px, ${view.pan.y}px) scale(${view.scale})`,
              }}
            >
              <div
                className="lightbox-image-shell"
                style={
                  {
                    '--lightbox-aspect': String(photo.thumbAspect),
                  } as CSSProperties
                }
                aria-busy={!imageLoaded}
              >
                {!imageLoaded && previewUrl ? (
                  <img
                    src={previewUrl}
                    alt=""
                    aria-hidden
                    decoding="async"
                    draggable={false}
                    className="lightbox-image-preview"
                    onLoad={handlePreviewLoad}
                  />
                ) : null}
                {!imageLoaded && !previewUrl ? (
                  <div className="lightbox-image-wireframe" aria-hidden>
                    <div className="lightbox-image-wireframe-shimmer" />
                  </div>
                ) : null}
                <img
                  ref={imageRef}
                  src={photo.url}
                  alt={imageDescription}
                  decoding="async"
                  fetchPriority="high"
                  draggable={false}
                  className={
                    imageLoaded
                      ? 'lightbox-image lightbox-image-loaded'
                      : 'lightbox-image'
                  }
                  onLoad={handleMainImageLoad}
                  onError={() => setImageLoaded(true)}
                />
              </div>
            </div>
          </div>
        </div>

        {shareNotice ? (
          <p className="lightbox-share-notice" role="status" aria-live="polite">
            {shareNotice}
          </p>
        ) : null}

        {helpOpen ? (
          <div
            className="lightbox-help-panel"
            role="dialog"
            aria-label="Keyboard shortcuts"
          >
            <button
              type="button"
              className="lightbox-help-close"
              aria-label="Close shortcuts"
              onClick={() => setHelpOpen(false)}
            >
              ×
            </button>
            <h2 className="lightbox-help-title">Keyboard shortcuts</h2>
            <ul className="lightbox-help-list">
              <li>
                <kbd>Esc</kbd> Close viewer
                {detailsOpen ? ' / details' : ''}
              </li>
              {onAdjacent ? (
                <li>
                  <kbd>←</kbd> <kbd>→</kbd> Previous / next photo
                </li>
              ) : null}
              <li>
                <kbd>+</kbd> <kbd>−</kbd> Zoom in / out
              </li>
              <li>
                <kbd>0</kbd> Reset zoom
              </li>
              <li>
                <kbd>?</kbd> Toggle this help
              </li>
            </ul>
          </div>
        ) : null}

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
          <>
            <button
              type="button"
              className="lightbox-details-scrim"
              aria-label="Close details panel"
              onClick={() => setDetailsOpen(false)}
            />
            <aside
              id="lightbox-details-panel"
              className="lightbox-details-panel"
              role="complementary"
              aria-labelledby="lightbox-details-heading"
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <div className="lightbox-details-panel-header">
                <h2 id="lightbox-details-heading" className="lightbox-details-heading">
                  Photo details
                </h2>
                <button
                  type="button"
                  className="lightbox-details-close"
                  onClick={() => setDetailsOpen(false)}
                  aria-label="Close details"
                >
                  <IconClose className="lightbox-tool-icon-svg" />
                </button>
              </div>
              <div className="lightbox-details-body">
                {(() => {
                  const detailTags = photo.tags.filter(
                    (t) => t !== photo.locationDisplay,
                  )
                  return (
                    <section
                      className="lightbox-details-section lightbox-details-section-card"
                      aria-labelledby="lightbox-details-meta"
                    >
                      <h3
                        id="lightbox-details-meta"
                        className="lightbox-details-section-title"
                      >
                        Gallery metadata
                      </h3>
                      <div className="lightbox-details-fields">
                        <DetailField label="Title" wide>
                          {photo.displayTitle}
                        </DetailField>
                        {photo.description?.trim() ? (
                          <DetailField label="Description" wide>
                            {photo.description}
                          </DetailField>
                        ) : null}
                        <DetailField label="Tags" wide>
                          <DetailTagChips
                            tags={detailTags}
                            selectedTags={selectedTagSet}
                            onToggleTag={onToggleTag}
                          />
                        </DetailField>
                        <DetailField label="Location">
                          {photo.locationDisplay}
                        </DetailField>
                        <DetailField
                          label={
                            photo.capturedAtIsDateOnly ? 'Date' : 'Date & time'
                          }
                        >
                          {filenameDateLong}
                        </DetailField>
                        <DetailField label="Camera">
                          <LightboxEquipmentValue
                            cameraRef={photo.cameraRef}
                            lensRef={photo.lensRef}
                            onOpen={onEquipmentOpen}
                          />
                        </DetailField>
                        <DetailField label="Collection">
                          {photo.eventLabel}
                        </DetailField>
                        {photo.alt ? (
                          <DetailField label="Alt text" wide>
                            {photo.alt}
                          </DetailField>
                        ) : null}
                        {photo.copyright ? (
                          <DetailField label="Copyright" wide>
                            {photo.copyright}
                          </DetailField>
                        ) : null}
                      </div>
                    </section>
                  )
                })()}

                {collectionPeers.length > 0 && onOpenCollectionPeer ? (
                  <DetailCollectionPeers
                    peers={collectionPeers}
                    onSelect={onOpenCollectionPeer}
                  />
                ) : null}

                <section
                  className="lightbox-details-section lightbox-details-section-card"
                  aria-labelledby="lightbox-details-exif"
                >
                  <h3 id="lightbox-details-exif" className="lightbox-details-section-title">
                    From image file
                  </h3>
                  {exifState.status === 'idle' ||
                  exifState.status === 'loading' ? (
                    <DetailExifLoading />
                  ) : null}
                  {exifState.status === 'error' ? (
                    <p className="lightbox-details-note" role="status">
                      {exifState.message}
                    </p>
                  ) : null}
                  {exifState.status === 'ok' && exifRows.length === 0 ? (
                    <p className="lightbox-details-muted">
                      No EXIF / IPTC / XMP blocks found in this file (common for exported or web-saved
                      JPEGs).
                    </p>
                  ) : null}
                  {exifState.status === 'ok' && exifRows.length > 0 ? (
                    <div className="lightbox-details-exif-grid">
                      {exifRows.map((row, i) => (
                        <div
                          key={`${row.label}-${i}`}
                          className="lightbox-details-exif-item"
                        >
                          <span className="lightbox-details-exif-label">
                            {row.label}
                          </span>
                          <span className="lightbox-details-exif-value">
                            {row.value}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </section>
              </div>
            </aside>
          </>
        ) : null}
      </div>
    </div>
  )

  return createPortal(node, document.body)
}
