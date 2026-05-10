type Props = {
  /** Section heading — from site.json “collectionsLabel”, default “Series”. */
  label: string
  tags: string[]
  selected: string | null
  onSelect: (tag: string | null) => void
}

export function TagBar({ label, tags, selected, onSelect }: Props) {
  if (tags.length === 0) return null

  return (
    <section className="collections" aria-labelledby="collections-heading">
      <h2 id="collections-heading" className="collections-heading">
        {label}
      </h2>
      <nav className="tag-bar" aria-label="Filter photographs">
        <button
          type="button"
          className={`tag-link${selected === null ? ' tag-link-active' : ''}`}
          onClick={() => onSelect(null)}
        >
          All work
        </button>
        {tags.map((tag) => (
          <button
            key={tag}
            type="button"
            className={`tag-link${selected === tag ? ' tag-link-active' : ''}`}
            onClick={() => onSelect(selected === tag ? null : tag)}
          >
            {tag}
          </button>
        ))}
      </nav>
    </section>
  )
}
