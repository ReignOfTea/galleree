type Props = {
  /** Section heading */
  label: string
  /** Unique prefix for heading/nav ids (e.g. `locations`, `tags`) */
  idPrefix: string
  /** Accessible name for the filter control group */
  navAriaLabel: string
  /** Label for the control that clears this dimension (e.g. “All locations”) */
  resetLabel: string
  tags: string[]
  selected: string | null
  onSelect: (tag: string | null) => void
}

export function TagBar({
  label,
  idPrefix,
  navAriaLabel,
  resetLabel,
  tags,
  selected,
  onSelect,
}: Props) {
  if (tags.length === 0) return null

  const headingId = `${idPrefix}-heading`

  return (
    <section className="filter-section" aria-labelledby={headingId}>
      <h2 id={headingId} className="filter-section-heading">
        {label}
      </h2>
      <nav className="tag-bar" aria-label={navAriaLabel}>
        <button
          type="button"
          className={`tag-link${selected === null ? ' tag-link-active' : ''}`}
          onClick={() => onSelect(null)}
        >
          {resetLabel}
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
