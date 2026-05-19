import type { ReactNode } from 'react'
import type { GalleryEntry } from '../../hooks/useGalleryManifest'

export function DetailField({
  label,
  children,
  wide = false,
}: {
  label: string
  children: ReactNode
  wide?: boolean
}) {
  const empty =
    children == null ||
    children === false ||
    (typeof children === 'string' && children.trim() === '')

  return (
    <div
      className={
        wide
          ? 'lightbox-details-field lightbox-details-field--wide'
          : 'lightbox-details-field'
      }
    >
      <span className="lightbox-details-field-label">{label}</span>
      <div className="lightbox-details-field-value">
        {empty ? <span className="lightbox-details-empty">—</span> : children}
      </div>
    </div>
  )
}

export function DetailTagChips({
  tags,
  selectedTags,
  onToggleTag,
}: {
  tags: string[]
  selectedTags?: ReadonlySet<string>
  onToggleTag?: (tag: string) => void
}) {
  if (tags.length === 0) {
    return <span className="lightbox-details-empty">—</span>
  }

  const interactive = Boolean(onToggleTag)

  return (
    <ul className="lightbox-details-chips" aria-label="Tags">
      {[...tags]
        .sort((a, b) => a.localeCompare(b))
        .map((tag) => {
          const active = selectedTags?.has(tag) ?? false
          if (!interactive) {
            return (
              <li key={tag}>
                <span className="lightbox-details-chip">{tag}</span>
              </li>
            )
          }
          return (
            <li key={tag}>
              <button
                type="button"
                className={
                  active
                    ? 'lightbox-details-chip lightbox-details-chip-active'
                    : 'lightbox-details-chip'
                }
                aria-pressed={active}
                aria-label={
                  active ? `Remove tag filter: ${tag}` : `Filter by tag: ${tag}`
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
  )
}

export function DetailCollectionPeers({
  peers,
  onSelect,
}: {
  peers: GalleryEntry[]
  onSelect: (entry: GalleryEntry) => void
}) {
  if (peers.length === 0) return null

  return (
    <section
      className="lightbox-details-section lightbox-details-section-card"
      aria-labelledby="lightbox-details-related"
    >
      <h3
        id="lightbox-details-related"
        className="lightbox-details-section-title"
      >
        More in this collection
      </h3>
      <ul className="lightbox-details-related">
        {peers.map((entry) => (
          <li key={entry.file}>
            <button
              type="button"
              className="lightbox-details-related-btn"
              onClick={() => onSelect(entry)}
            >
              <img
                src={entry.thumbUrl ?? entry.url}
                alt=""
                loading="lazy"
                decoding="async"
                draggable={false}
              />
              <span className="lightbox-details-related-title">
                {entry.displayTitle ?? entry.file}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}

export function DetailExifLoading() {
  return (
    <div className="lightbox-details-loading" role="status" aria-live="polite">
      <span className="lightbox-details-spinner" aria-hidden />
      <span className="lightbox-details-loading-text">
        Reading embedded metadata…
      </span>
    </div>
  )
}
