import type { GalleryCollection } from '../lib/galleryCollections'

type Props = {
  label: string
  collections: GalleryCollection[]
  onSelect: (slug: string) => void
  onOpenAll: () => void
}

export function CollectionsStrip({
  label,
  collections,
  onSelect,
  onOpenAll,
}: Props) {
  if (collections.length === 0) return null

  return (
    <section className="collections-strip" aria-label={`Recent ${label.toLowerCase()}`}>
      <div className="collections-strip-head">
        <h2 className="collections-strip-title">{label}</h2>
        <button type="button" className="collections-strip-all" onClick={onOpenAll}>
          View all
        </button>
      </div>
      <ul className="collections-strip-list">
        {collections.map((collection) => (
          <li key={collection.slug}>
            <button
              type="button"
              className="collections-strip-card"
              title={collection.title}
              onClick={() => onSelect(collection.slug)}
            >
              <span className="collections-strip-cover-wrap">
                {collection.coverThumbUrl ? (
                  <img
                    src={collection.coverThumbUrl}
                    alt=""
                    className="collections-strip-cover"
                    decoding="async"
                    loading="lazy"
                  />
                ) : (
                  <span
                    className="collections-strip-cover collections-strip-cover-placeholder"
                    aria-hidden
                  />
                )}
                <span className="collections-strip-card-text">
                  <span className="collections-strip-card-title">{collection.title}</span>
                  <span className="collections-strip-card-count">
                    {collection.imageCount}{' '}
                    {collection.imageCount === 1 ? 'photo' : 'photos'}
                  </span>
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
