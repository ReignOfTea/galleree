import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import type { GalleryCollection } from '../lib/galleryCollections'

type Props = {
  label: string
  collections: GalleryCollection[]
  onSelect: (slug: string) => void
  onClose: () => void
}

export function CollectionsModal({
  label,
  collections,
  onSelect,
  onClose,
}: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    document.body.classList.add('collections-modal-open')
    return () => document.body.classList.remove('collections-modal-open')
  }, [])

  return createPortal(
    <div
      className="collections-modal-root"
      role="dialog"
      aria-modal="true"
      aria-labelledby="collections-modal-title"
    >
      <button
        type="button"
        className="collections-modal-backdrop"
        aria-label={`Close ${label.toLowerCase()}`}
        onClick={onClose}
      />
      <div
        className="collections-modal-panel"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="collections-modal-header">
          <div className="collections-modal-heading">
            <h2 id="collections-modal-title" className="collections-modal-title">
              {label}
            </h2>
            <p className="collections-modal-subtitle">
              {collections.length}{' '}
              {collections.length === 1 ? 'collection' : 'collections'}
            </p>
          </div>
          <button
            type="button"
            className="collections-modal-close"
            aria-label="Close"
            onClick={onClose}
          >
            ×
          </button>
        </header>
        <ul className="collections-modal-grid">
          {collections.map((collection) => (
            <li key={collection.slug}>
              <button
                type="button"
                className="collections-modal-card"
                onClick={() => onSelect(collection.slug)}
              >
                <span className="collections-modal-cover-wrap">
                  {collection.coverThumbUrl ? (
                    <img
                      src={collection.coverThumbUrl}
                      alt=""
                      className="collections-modal-cover"
                      decoding="async"
                      loading="eager"
                      fetchPriority="high"
                    />
                  ) : (
                    <span
                      className="collections-modal-cover collections-modal-cover-placeholder"
                      aria-hidden
                    />
                  )}
                </span>
                <span className="collections-modal-card-title">
                  {collection.title}
                </span>
                {collection.imageCount > 0 ? (
                  <span className="collections-modal-card-count">
                    {collection.imageCount}{' '}
                    {collection.imageCount === 1 ? 'photo' : 'photos'}
                  </span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>,
    document.body,
  )
}
