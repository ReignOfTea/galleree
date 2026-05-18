import { Fragment, useEffect, useRef, useState, type CSSProperties } from 'react'
import type { LoadGate } from '../lib/loadGate'
import { preloadCachedImage } from '../lib/assetCache'
import type { GalleryEntry } from '../hooks/useGalleryManifest'
import {
  galleryCaptionMetaParts,
  galleryImageDescription,
} from '../lib/galleryLabels'

type Props = {
  row: GalleryEntry[]
  thumbHeight: number
  gate: LoadGate
  /** Load thumbnails immediately (first rows above the fold). */
  priority?: boolean
  onPhotoOpen?: (item: GalleryEntry) => void
  selectedTagSet: ReadonlySet<string>
  onToggleTag: (tag: string) => void
}

export function GalleryRow({
  row,
  thumbHeight,
  gate,
  priority = false,
  onPhotoOpen,
  selectedTagSet,
  onToggleTag,
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(priority)
  const [sources, setSources] = useState<(string | null)[]>(() =>
    row.map(() => null),
  )

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
                disabled={!sources[i]}
                onClick={() => sources[i] && onPhotoOpen?.(item)}
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
                    <img
                      src={sources[i]!}
                      alt={galleryImageDescription(item)}
                      decoding="async"
                      fetchPriority="low"
                    />
                  ) : (
                    <div className="gallery-skeleton" aria-hidden />
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
                    {captionTags.map((tag) => {
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
