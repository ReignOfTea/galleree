import type { CSSProperties, Ref, RefObject } from 'react'
import type { GalleryEntry } from '../../hooks/useGalleryManifest'
import type { AmbientColors } from '../../lib/lightboxAmbient'
import { MIN_SCALE, type Pan } from './lightboxZoom'

type ViewportHandlers = {
  onPointerDown: (e: React.PointerEvent) => void
  onPointerMove: (e: React.PointerEvent) => void
  onPointerUp: (e: React.PointerEvent) => void
  onDoubleClick: (e: React.MouseEvent) => void
  onTouchStart: (e: React.TouchEvent) => void
  onTouchMove: (e: React.TouchEvent) => void
  onTouchEnd: (e: React.TouchEvent) => void
}

type Props = {
  photo: GalleryEntry
  imageDescription: string
  view: { scale: number; pan: Pan }
  imageLoaded: boolean
  previewUrl: string | null
  ambientOn: boolean
  ambientInteracting: boolean
  ambientHostStyle: CSSProperties | undefined
  ambientColors: AmbientColors | null
  selectedTagSet: ReadonlySet<string>
  stageRef: RefObject<HTMLDivElement | null>
  viewportRef: RefObject<HTMLDivElement | null>
  imageRef: Ref<HTMLImageElement | null>
  handlers: ViewportHandlers
  onMainImageLoad: () => void
  onPreviewLoad: () => void
  onToggleTag?: (tag: string) => void
}

export function LightboxStage({
  photo,
  imageDescription,
  view,
  imageLoaded,
  previewUrl,
  ambientOn,
  ambientInteracting,
  ambientHostStyle,
  ambientColors,
  selectedTagSet,
  stageRef,
  viewportRef,
  imageRef,
  handlers,
  onMainImageLoad,
  onPreviewLoad,
  onToggleTag,
}: Props) {
  const stripTags = photo.tags.filter((t) => t !== photo.locationDisplay)

  return (
    <div ref={stageRef} className="lightbox-stage">
      <div
        ref={viewportRef}
        className={
          view.scale > MIN_SCALE
            ? 'lightbox-viewport lightbox-viewport-pannable'
            : 'lightbox-viewport'
        }
        onPointerDown={handlers.onPointerDown}
        onPointerMove={handlers.onPointerMove}
        onPointerUp={handlers.onPointerUp}
        onPointerCancel={handlers.onPointerUp}
        onLostPointerCapture={handlers.onPointerUp}
        onDoubleClick={handlers.onDoubleClick}
        onTouchStart={handlers.onTouchStart}
        onTouchMove={handlers.onTouchMove}
        onTouchEnd={handlers.onTouchEnd}
        onTouchCancel={handlers.onTouchEnd}
      >
        {stripTags.length > 0 ? (
          <div className="lightbox-tags-strip" aria-label="Tags for this photo">
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
        ) : null}
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
            <span className="lightbox-location-name">{photo.locationDisplay}</span>
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
                onLoad={onPreviewLoad}
              />
            ) : null}
            {!imageLoaded && !previewUrl ? (
              <div className="lightbox-image-wireframe" aria-hidden>
                <div className="lightbox-image-wireframe-shimmer" />
              </div>
            ) : null}
            <img
              ref={imageRef}
              src={photo.viewUrl}
              alt={imageDescription}
              decoding="async"
              fetchPriority="high"
              draggable={false}
              className={
                imageLoaded
                  ? 'lightbox-image lightbox-image-loaded'
                  : 'lightbox-image'
              }
              onLoad={onMainImageLoad}
              onError={onMainImageLoad}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
