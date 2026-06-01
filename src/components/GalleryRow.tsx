import {
  Fragment,
  memo,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from 'react'
import type { LoadGate } from '../lib/loadGate'
import { preloadCachedImage } from '../lib/assetCache'
import type { GalleryEntry } from '../hooks/useGalleryManifest'
import {
  galleryCaptionMetaParts,
  galleryImageDescription,
} from '../lib/galleryLabels'
import { GalleryBlurPlaceholder } from './GalleryBlurPlaceholder'

type Props = {
  row: GalleryEntry[]
  thumbHeight: number
  gate: LoadGate
  /** Load thumbnails immediately (first rows above the fold). */
  priority?: boolean
  onPhotoOpen?: (item: GalleryEntry) => void
  /** Hover / focus / touch — start loading the full image before click. */
  onPhotoWarm?: (item: GalleryEntry) => void
  selectedTagSet: ReadonlySet<string>
  onToggleTag: (tag: string) => void
}

const GRID_TAG_PREVIEW = 2

const GRID_IMG_SIZES = '(max-width: 640px) 92vw, (max-width: 1024px) 46vw, 30vw'

function GalleryRowComponent({
  row,
  thumbHeight,
  gate,
  priority = false,
  onPhotoOpen,
  onPhotoWarm,
  selectedTagSet,
  onToggleTag,
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(priority)
  const [sources, setSources] = useState<(string | null)[]>(() =>
    row.map(() => null),
  )
  const [expandedTagFiles, setExpandedTagFiles] = useState<Set<string>>(
    () => new Set(),
  )

  const toggleTagsExpanded = (file: string) => {
    setExpandedTagFiles((prev) => {
      const next = new Set(prev)
      if (next.has(file)) next.delete(file)
      else next.add(file)
      return next
    })
  }

  useEffect(() => {
    const el = rootRef.current
    if (!el) return

    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) setVisible(true)
      },
      { rootMargin: priority ? '120%' : '35%', threshold: 0.01 },
    )

    io.observe(el)
    return () => io.disconnect()
  }, [priority])

  useEffect(() => {
    if (!visible) return

    let cancelled = false

    ;(async () => {
      for (let i = 0; i < row.length; i++) {
        if (cancelled) break
        const item = row[i]
        if (!item) continue
        const gridUrl = item.thumbUrl ?? item.url

        try {
          await gate.run(() => preloadCachedImage(gridUrl))
        } catch {
          continue
        }

        if (!cancelled) {
          setSources((prev) => {
            const next = [...prev]
            next[i] = gridUrl
            return next
          })
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [visible, row, gate])

  return (
    <div
      ref={rootRef}
      className="gallery-row"
      style={
        {
          '--gallery-row-thumb-height': `${thumbHeight}px`,
        } as CSSProperties
      }
    >
      {row.map((item, i) => {
        const captionTitle = item.displayTitle ?? item.file
        const captionDescription = item.description?.trim() ?? ''
        const metaParts = galleryCaptionMetaParts(item)
        const captionTags = item.tags.filter((t) => t !== item.locationDisplay)
        const tagsExpanded = expandedTagFiles.has(item.file)
        const hiddenTagCount = Math.max(0, captionTags.length - GRID_TAG_PREVIEW)
        const visibleTags = tagsExpanded
          ? captionTags
          : captionTags.slice(0, GRID_TAG_PREVIEW)
        const showMetaLine = metaParts.length > 0

        return (
          <figure
            key={item.file}
            className="gallery-cell"
            style={
              {
                '--gallery-cell-flex': String(item.thumbAspect),
              } as CSSProperties
            }
          >
            <div className="gallery-cell-inner">
              <button
                type="button"
                className="gallery-thumb"
                aria-label={`Open ${captionTitle} fullscreen`}
                onPointerEnter={() => onPhotoWarm?.(item)}
                onFocus={() => onPhotoWarm?.(item)}
                onTouchStart={() => onPhotoWarm?.(item)}
                onClick={() => onPhotoOpen?.(item)}
              >
                <div
                  className="gallery-aspect"
                  style={
                    {
                      '--gallery-thumb-aspect': String(item.thumbAspect),
                    } as CSSProperties
                  }
                >
                  {sources[i] ? (
                    item.thumbSrcSetAvif ? (
                      <picture>
                        <source
                          type="image/avif"
                          srcSet={item.thumbSrcSetAvif}
                          sizes={GRID_IMG_SIZES}
                        />
                        <img
                          src={sources[i]!}
                          srcSet={item.thumbSrcSet ?? undefined}
                          sizes={GRID_IMG_SIZES}
                          alt={galleryImageDescription(item)}
                          decoding="async"
                          fetchPriority="low"
                        />
                      </picture>
                    ) : (
                      <img
                        src={sources[i]!}
                        srcSet={item.thumbSrcSet ?? undefined}
                        sizes={GRID_IMG_SIZES}
                        alt={galleryImageDescription(item)}
                        decoding="async"
                        fetchPriority="low"
                      />
                    )
                  ) : (
                    <GalleryBlurPlaceholder blurHash={item.blurHash} />
                  )}
                </div>
              </button>
              <figcaption className="gallery-caption">
                <span className="gallery-caption-title">{captionTitle}</span>
                {captionDescription ? (
                  <span className="gallery-caption-desc">{captionDescription}</span>
                ) : null}
                {showMetaLine ? (
                  <span className="gallery-caption-meta">
                    {metaParts.map((part, i) => (
                      <Fragment key={`m-${i}`}>
                        {i > 0 ? (
                          <span className="gallery-caption-sep"> · </span>
                        ) : null}
                        {part}
                      </Fragment>
                    ))}
                  </span>
                ) : null}
                {captionTags.length > 0 ? (
                  <ul className="gallery-caption-tags" aria-label="Tags">
                    {visibleTags.map((tag) => {
                      const active = selectedTagSet.has(tag)
                      return (
                        <li key={tag}>
                          <button
                            type="button"
                            className={`gallery-caption-tag${active ? ' gallery-caption-tag-active' : ''}`}
                            aria-pressed={active}
                            aria-label={
                              active ? `Remove tag filter: ${tag}` : `Filter by tag: ${tag}`
                            }
                            onClick={() => onToggleTag(tag)}
                          >
                            {tag}
                          </button>
                        </li>
                      )
                    })}
                    {hiddenTagCount > 0 ? (
                      <li>
                        <button
                          type="button"
                          className="gallery-caption-tag gallery-caption-tag-more"
                          aria-expanded={tagsExpanded}
                          aria-label={
                            tagsExpanded
                              ? 'Show fewer tags'
                              : `Show ${hiddenTagCount} more tags`
                          }
                          onClick={() => toggleTagsExpanded(item.file)}
                        >
                          {tagsExpanded ? 'Less' : `+${hiddenTagCount}`}
                        </button>
                      </li>
                    ) : null}
                  </ul>
                ) : null}
              </figcaption>
            </div>
          </figure>
        )
      })}
    </div>
  )
}

export const GalleryRow = memo(GalleryRowComponent)
