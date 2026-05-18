import {
  type GallerySortOrder,
  GALLERY_SORT_OPTIONS,
} from '../lib/gallerySort'

type Props = {
  label: string
  idPrefix: string
  navAriaLabel: string
  value: GallerySortOrder
  onChange: (value: GallerySortOrder) => void
  /** `toolbar`: compact row for the gallery controls bar. Default `section`. */
  variant?: 'section' | 'toolbar'
  /** Toolbar only: hide visible label, keep for screen readers. */
  hideLabel?: boolean
}

export function SortOrderBar({
  label,
  idPrefix,
  navAriaLabel,
  value,
  onChange,
  variant = 'section',
  hideLabel = false,
}: Props) {
  const headingId = `${idPrefix}-heading`

  const nav = (
    <nav
      className="tag-bar sort-order-nav"
      {...(variant === 'toolbar'
        ? { 'aria-labelledby': headingId }
        : { 'aria-label': navAriaLabel })}
    >
      {GALLERY_SORT_OPTIONS.map(({ value: optionValue, label: optionLabel }) => (
        <button
          key={optionValue}
          type="button"
          className={`tag-link${value === optionValue ? ' tag-link-active' : ''}`}
          aria-pressed={value === optionValue}
          onClick={() => onChange(optionValue)}
        >
          {optionLabel}
        </button>
      ))}
    </nav>
  )

  if (variant === 'toolbar') {
    return (
      <div className="sort-order-toolbar">
        <span
          id={headingId}
          className={
            hideLabel ? 'visually-hidden' : 'sort-order-toolbar-label'
          }
        >
          {label}
        </span>
        {nav}
      </div>
    )
  }

  return (
    <section className="filter-section" aria-labelledby={headingId}>
      <h2 id={headingId} className="filter-section-heading">
        {label}
      </h2>
      {nav}
    </section>
  )
}
