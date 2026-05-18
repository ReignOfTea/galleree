import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { GalleryEntry } from '../hooks/useGalleryManifest'
import { useImageExif } from '../hooks/useImageExif'
import { galleryImageDescription, formatCaptureDate } from '../lib/galleryLabels'
import { mergeGalleryLensIntoExifCameraModel } from '../lib/exifDisplay'
import { shareGalleryPhoto } from '../lib/shareGalleryPhoto'
import type { EquipmentOpenContext } from './EquipmentCaptionLink'
import { LightboxEquipmentValue } from './LightboxEquipmentValue'

export type LightboxPhoto = GalleryEntry

type Props = {
  photo: LightboxPhoto
  siteTitle: string
  onClose: () => void
  /** Prev/next image in gallery order when multiple items (`items.length > 1`). */
  onAdjacent?: (direction: -1 | 1) => void
  onEquipmentOpen?: (ctx: EquipmentOpenContext) => void
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

function shareUrlFacebook(pageUrl: string): string {
  return `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(pageUrl)}`
}

function shareUrlTwitter(pageUrl: string, text: string): string {
  const params = new URLSearchParams({
    url: pageUrl,
    text,
  })
  return `https://twitter.com/intent/tweet?${params}`
}

function shareUrlLinkedIn(pageUrl: string): string {
  return `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(pageUrl)}`
}

export function PhotoLightbox({
  photo,
  siteTitle,
  onClose,
  onAdjacent,
  onEquipmentOpen,
}: Props) {
  const closeBtnRef = useRef<HTMLButtonElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const viewportRef = useRef<HTMLDivElement>(null)

  const [view, setView] = useState({ scale: MIN_SCALE, pan: { x: 0, y: 0 } as Pan })
  const [copiedPage, setCopiedPage] = useState(false)
  const [copiedImage, setCopiedImage] = useState(false)
  const [shareNotice, setShareNotice] = useState<string | null>(null)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const exifState = useImageExif(detailsOpen ? photo.url : null)

  const exifRows = useMemo(() => {
    if (exifState.status !== 'ok') return []
    return mergeGalleryLensIntoExifCameraModel(exifState.rows, photo.lensLabel)
  }, [exifState, photo.lensLabel])

  const resetView = useCallback(() => {
    setView({ scale: MIN_SCALE, pan: { x: 0, y: 0 } })
  }, [])

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

  useEffect(() => {
    const el = viewportRef.current
    if (!el) return

    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setViewFromWheel(e.clientX, e.clientY, e.deltaY, e.ctrlKey)
    }

    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [setViewFromWheel, photo.file])

  const zoomAtCenter = useCallback((multiply: number) => {
    setView((v) =>
      applyZoomToward(v, 0, 0, clampScale(v.scale * multiply)),
    )
  }, [])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (detailsOpen) {
          setDetailsOpen(false)
          return
        }
        handleClose()
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
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    queueMicrotask(() => closeBtnRef.current?.focus())

    return () => {
      window.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = prevOverflow
      exitFullscreenIfNeeded()
    }
  }, [
    handleClose,
    exitFullscreenIfNeeded,
    onAdjacent,
    resetView,
    zoomAtCenter,
    detailsOpen,
  ])

  const pinchRef = useRef<{
    dist: number
    scale: number
    pan: Pan
    ox: number
    oy: number
  } | null>(null)

  const dragRef = useRef<{
    pointerId: number
    lastX: number
    lastY: number
  } | null>(null)

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return
    if (view.scale <= MIN_SCALE) return
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
    if (e.touches.length !== 2) return
    const stage = viewportRef.current
    if (!stage) return
    const rect = stage.getBoundingClientRect()
    const [t1, t2] = [e.touches[0], e.touches[1]]
    const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY)
    const cx =
      (t1.clientX + t2.clientX) / 2 - rect.left - rect.width / 2
    const cy =
      (t1.clientY + t2.clientY) / 2 - rect.top - rect.height / 2

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
    if (e.touches.length < 2) pinchRef.current = null
  }

  const sharePhotoPayload = useCallback(() => {
    return {
      imageUrl: photo.url,
      imageFilename: photo.file,
      title: siteTitle,
      text: shareText,
      pageUrl: shareLinkUrl,
    }
  }, [photo.url, photo.file, siteTitle, shareText, shareLinkUrl])

  const handleSharePhoto = useCallback(async () => {
    setShareNotice(null)
    const r = await shareGalleryPhoto(sharePhotoPayload())
    if (r.ok === false) {
      if (r.reason !== 'abort') {
        setShareNotice(r.message ?? 'Could not share this photo.')
        window.setTimeout(() => setShareNotice(null), 6000)
      }
      return
    }
    if (r.mode === 'clipboard-image') {
      setShareNotice('Image copied — paste it into your post.')
      window.setTimeout(() => setShareNotice(null), 6000)
    } else if (r.mode === 'clipboard-url') {
      setShareNotice('Link copied — paste it where you want to share.')
      window.setTimeout(() => setShareNotice(null), 6000)
    }
  }, [sharePhotoPayload])

  const handleSocialIntent = useCallback(
    async (intentUrl: string) => {
      setShareNotice(null)
      const r = await shareGalleryPhoto(sharePhotoPayload())
      if (r.ok === false) {
        if (r.reason === 'abort') return
        window.open(intentUrl, '_blank', 'noopener,noreferrer')
        return
      }
      if (r.mode === 'clipboard-image') {
        setShareNotice('Image copied — paste into your post.')
        window.setTimeout(() => setShareNotice(null), 7000)
      } else if (r.mode === 'clipboard-url') {
        setShareNotice('Link copied — paste it where you want to share.')
        window.setTimeout(() => setShareNotice(null), 7000)
      }
    },
    [sharePhotoPayload],
  )

  const copyPageLink = async () => {
    try {
      await navigator.clipboard.writeText(shareLinkUrl)
      setCopiedPage(true)
      window.setTimeout(() => setCopiedPage(false), 2000)
    } catch {
      /* ignore */
    }
  }

  const copyImageLink = async () => {
    try {
      await navigator.clipboard.writeText(photo.url)
      setCopiedImage(true)
      window.setTimeout(() => setCopiedImage(false), 2000)
    } catch {
      /* ignore */
    }
  }

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

  const node = (
    <div
      className="lightbox-root"
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

      <div className="lightbox-shell" onClick={(e) => e.stopPropagation()}>
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
              className="lightbox-tool-quiet lightbox-tool-save"
              href={photo.url}
              download={photo.file}
            >
              Save
            </a>
            <button
              type="button"
              className="lightbox-tool-quiet"
              onClick={() => void handleSharePhoto()}
            >
              Share
            </button>
            <button
              type="button"
              className="lightbox-tool-quiet"
              onClick={toggleFullscreen}
            >
              Fullscreen
            </button>
            <button
              type="button"
              className={
                detailsOpen ? 'lightbox-tool-quiet lightbox-tool-quiet-active' : 'lightbox-tool-quiet'
              }
              aria-expanded={detailsOpen}
              aria-controls="lightbox-details-panel"
              onClick={() => setDetailsOpen((o) => !o)}
            >
              Details
            </button>
            <details className="lightbox-overflow">
              <summary className="lightbox-overflow-trigger">More</summary>
              <div className="lightbox-overflow-panel">
                <button type="button" className="lightbox-menu-item" onClick={() => void copyPageLink()}>
                  {copiedPage ? 'Link copied' : 'Copy page link'}
                </button>
                <button type="button" className="lightbox-menu-item" onClick={() => void copyImageLink()}>
                  {copiedImage ? 'Link copied' : 'Copy image link'}
                </button>
                <button
                  type="button"
                  className="lightbox-menu-item"
                  onClick={() =>
                    void handleSocialIntent(shareUrlTwitter(shareLinkUrl, shareText))
                  }
                >
                  Post on X
                </button>
                <button
                  type="button"
                  className="lightbox-menu-item"
                  onClick={() => void handleSocialIntent(shareUrlFacebook(shareLinkUrl))}
                >
                  Facebook
                </button>
                <button
                  type="button"
                  className="lightbox-menu-item"
                  onClick={() =>
                    void handleSocialIntent(shareUrlLinkedIn(shareLinkUrl))
                  }
                >
                  LinkedIn
                </button>
              </div>
            </details>
          </div>
        </header>

        {(() => {
          const stripTags = photo.tags.filter(
            (t) => t !== photo.locationDisplay,
          )
          return stripTags.length > 0 ? (
            <div className="lightbox-tags-strip" aria-label="Tags for this photo">
              <span className="lightbox-tags-strip-label">Tags</span>
              <ul className="lightbox-tags-strip-list">
                {[...stripTags]
                  .sort((a, b) => a.localeCompare(b))
                  .map((tag) => (
                    <li key={tag}>
                      <span className="lightbox-tag-pill">{tag}</span>
                    </li>
                  ))}
              </ul>
            </div>
          ) : null
        })()}

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
            onDoubleClick={onDoubleClick}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
            onTouchCancel={onTouchEnd}
          >
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
              <img
                src={photo.url}
                alt={imageDescription}
                decoding="async"
                draggable={false}
                className="lightbox-image"
              />
            </div>
          </div>
        </div>

        {shareNotice ? (
          <p className="lightbox-share-notice" role="status" aria-live="polite">
            {shareNotice}
          </p>
        ) : null}

        <p className="lightbox-hint-float">
          Scroll to zoom · drag to pan · double-click ·{' '}
          <kbd>Esc</kbd> close
          {detailsOpen ? (
            <>
              {' '}
              · <kbd>Esc</kbd> also closes details
            </>
          ) : null}
          {onAdjacent ? (
            <>
              {' '}
              · <kbd>←</kbd> <kbd>→</kbd> prev/next
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
                  ×
                </button>
              </div>
              <div className="lightbox-details-body">
                <section className="lightbox-details-section" aria-labelledby="lightbox-details-meta">
                  <h3 id="lightbox-details-meta" className="lightbox-details-section-title">
                    Gallery metadata
                  </h3>
                  <dl className="lightbox-details-dl">
                    <dt>Title</dt>
                    <dd>{photo.displayTitle ?? '—'}</dd>
                    <dt>Description</dt>
                    <dd>{photo.description ?? '—'}</dd>
                    <dt>Tags</dt>
                    <dd>
                      {(() => {
                        const detailTags = photo.tags.filter(
                          (t) => t !== photo.locationDisplay,
                        )
                        return detailTags.length > 0 ? (
                          <ul className="lightbox-details-taglist">
                            {[...detailTags]
                              .sort((a, b) => a.localeCompare(b))
                              .map((t) => (
                                <li key={t}>{t}</li>
                              ))}
                          </ul>
                        ) : (
                          '—'
                        )
                      })()}
                    </dd>
                    <dt>Location</dt>
                    <dd>{photo.locationDisplay ?? '—'}</dd>
                    <dt>{photo.capturedAtIsDateOnly ? 'Date' : 'Date & time'}</dt>
                    <dd>{filenameDateLong ?? '—'}</dd>
                    <dt>Camera</dt>
                    <dd>
                      <LightboxEquipmentValue
                        cameraRef={photo.cameraRef}
                        lensRef={photo.lensRef}
                        onOpen={onEquipmentOpen}
                      />
                    </dd>
                    <dt>Collection</dt>
                    <dd>{photo.eventLabel ?? '—'}</dd>
                    {photo.alt ? (
                      <>
                        <dt>Alt text</dt>
                        <dd>{photo.alt}</dd>
                      </>
                    ) : null}
                    {photo.copyright ? (
                      <>
                        <dt>Copyright</dt>
                        <dd>{photo.copyright}</dd>
                      </>
                    ) : null}
                  </dl>
                </section>

                <section className="lightbox-details-section" aria-labelledby="lightbox-details-exif">
                  <h3 id="lightbox-details-exif" className="lightbox-details-section-title">
                    From image file
                  </h3>
                  {exifState.status === 'idle' || exifState.status === 'loading' ? (
                    <p className="lightbox-details-muted">Reading embedded metadata…</p>
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
                    <dl className="lightbox-details-dl">
                      {exifRows.map((row, i) => (
                        <div key={`${row.label}-${i}`} className="lightbox-details-pair">
                          <dt>{row.label}</dt>
                          <dd>{row.value}</dd>
                        </div>
                      ))}
                    </dl>
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
