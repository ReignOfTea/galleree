import { useEffect, useRef, useState } from 'react'
import type { LoadGate } from '../lib/loadGate'
import { preloadImage } from '../lib/preloadImage'
import type { GalleryEntry } from '../hooks/useGalleryManifest'
import {
  galleryCaptionMetaParts,
  galleryImageDescription,
} from '../lib/galleryLabels'

type Props = {
  row: GalleryEntry[]
  columns: number
  gate: LoadGate
  onPhotoOpen?: (item: GalleryEntry) => void
}

export function GalleryRow({ row, columns, gate, onPhotoOpen }: Props) {
  const rootRef = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
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
      { rootMargin: '35%', threshold: 0.01 },
    )

    io.observe(el)
    return () => io.disconnect()
  }, [])

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
          await gate.run(() => preloadImage(gridUrl))
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
      style={{
        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
      }}
    >
      {row.map((item, i) => {
        const captionTitle = item.displayTitle ?? item.file
        const metaLine = galleryCaptionMetaParts(item)
        const captionTags = item.tags.filter((t) => t !== item.locationDisplay)

        return (
          <figure key={item.file} className="gallery-cell">
            <button
              type="button"
              className="gallery-thumb"
              aria-label={`Open ${captionTitle} fullscreen`}
              disabled={!sources[i]}
              onClick={() => sources[i] && onPhotoOpen?.(item)}
            >
              <div className="gallery-aspect">
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
              {metaLine.length > 0 ? (
                <span className="gallery-caption-meta">{metaLine.join(' · ')}</span>
              ) : null}
              {captionTags.length > 0 ? (
                <ul className="gallery-caption-tags" aria-label="Tags">
                  {captionTags.map((tag) => (
                    <li key={tag}>
                      <span className="gallery-caption-tag">{tag}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </figcaption>
          </figure>
        )
      })}
    </div>
  )
}
