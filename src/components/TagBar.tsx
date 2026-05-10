type TagBarCommon = {
  /** Section heading */
  label: string
  /** Unique prefix for heading/nav ids (e.g. `locations`, `tags`) */
  idPrefix: string
  /** Accessible name for the filter control group */
  navAriaLabel: string
  /** Label for the control that clears this dimension (e.g. “All locations”) */
  resetLabel: string
  tags: string[]
  /** `nav-only`: skip outer section + heading (for collapsible panels). Default `full`. */
  variant?: 'full' | 'nav-only'
}

type TagBarSingleProps = TagBarCommon & {
  selectionMode?: 'single'
  selected: string | null
  onSelect: (tag: string | null) => void
}

type TagBarMultiProps = TagBarCommon & {
  selectionMode: 'multi'
  selectedTags: string[]
  onToggleTag: (tag: string) => void
  onClearTags: () => void
}

export type TagBarProps = TagBarSingleProps | TagBarMultiProps

export function TagBar(props: TagBarProps) {
  const {
    label,
    idPrefix,
    navAriaLabel,
    resetLabel,
    tags,
    variant = 'full',
  } = props

  if (tags.length === 0) return null

  const headingId = `${idPrefix}-heading`
  const multi = props.selectionMode === 'multi'

  const nav = (
    <nav className="tag-bar" aria-label={navAriaLabel}>
        {multi ? (
          <>
            <button
              type="button"
              className={`tag-link${props.selectedTags.length === 0 ? ' tag-link-active' : ''}`}
              onClick={() => props.onClearTags()}
            >
              {resetLabel}
            </button>
            {tags.map((tag) => {
              const on = props.selectedTags.includes(tag)
              return (
                <button
                  key={tag}
                  type="button"
                  className={`tag-link${on ? ' tag-link-active' : ''}`}
                  aria-pressed={on}
                  onClick={() => props.onToggleTag(tag)}
                >
                  {tag}
                </button>
              )
            })}
          </>
        ) : (
          <>
            <button
              type="button"
              className={`tag-link${props.selected === null ? ' tag-link-active' : ''}`}
              onClick={() => props.onSelect(null)}
            >
              {resetLabel}
            </button>
            {tags.map((tag) => (
              <button
                key={tag}
                type="button"
                className={`tag-link${props.selected === tag ? ' tag-link-active' : ''}`}
                onClick={() =>
                  props.onSelect(props.selected === tag ? null : tag)
                }
              >
                {tag}
              </button>
            ))}
          </>
        )}
      </nav>
  )

  if (variant === 'nav-only') return nav

  return (
    <section className="filter-section" aria-labelledby={headingId}>
      <h2 id={headingId} className="filter-section-heading">
        {label}
      </h2>
      {nav}
    </section>
  )
}
