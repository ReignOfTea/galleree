import type { ReactNode } from 'react'
import { ThemeToggle } from './ThemeToggle'
import { SortOrderBar } from './SortOrderBar'
import type { GallerySortOrder } from '../lib/gallerySort'

type Props = {
  searchQuery: string
  onSearchQueryChange: (value: string) => void
  sortOrder: GallerySortOrder
  onSortOrderChange: (value: GallerySortOrder) => void
  filtersOpen: boolean
  onFiltersToggle: () => void
  filtersActive: boolean
  showFiltersButton: boolean
  showExitCollection: boolean
  onExitCollection: () => void
  showClear: boolean
  onClearAll: () => void
  filtersPanel?: ReactNode
  onFiltersClose: () => void
}

export function GalleryToolbar({
  searchQuery,
  onSearchQueryChange,
  sortOrder,
  onSortOrderChange,
  filtersOpen,
  onFiltersToggle,
  filtersActive,
  showFiltersButton,
  showExitCollection,
  onExitCollection,
  showClear,
  onClearAll,
  filtersPanel,
  onFiltersClose,
}: Props) {
  const sortIdPrefix = showFiltersButton ? 'sort' : 'sort-mobile'
  const showMenu = showExitCollection || showClear

  const filtersControl = showFiltersButton ? (
    <div className="gallery-toolbar-filters-anchor">
      <button
        type="button"
        className={`gallery-toolbar-btn${filtersOpen || filtersActive ? ' gallery-toolbar-btn-active' : ''}`}
        aria-expanded={filtersOpen}
        aria-controls="gallery-filters-panel"
        onClick={onFiltersToggle}
      >
        Filters
        {filtersActive ? <span className="gallery-toolbar-btn-dot" aria-hidden /> : null}
      </button>
      {filtersPanel ? (
        <div
          className={`gallery-filters-root${filtersOpen ? ' gallery-filters-root-open' : ''}`}
        >
          <button
            type="button"
            className="gallery-filters-backdrop"
            aria-label="Close filters"
            tabIndex={filtersOpen ? 0 : -1}
            onClick={onFiltersClose}
          />
          {filtersOpen ? filtersPanel : null}
        </div>
      ) : null}
    </div>
  ) : null

  return (
    <nav className="gallery-toolbar" aria-label="Gallery controls">
      <div className="gallery-toolbar-search">
        <label htmlFor="gallery-search" className="visually-hidden">
          Search gallery
        </label>
        <input
          id="gallery-search"
          type="search"
          className="gallery-search-input"
          placeholder="Search photos…"
          value={searchQuery}
          onChange={(e) => onSearchQueryChange(e.target.value)}
          autoComplete="off"
          spellCheck={false}
        />
      </div>

      <div
        className={[
          'gallery-toolbar-sort',
          'gallery-toolbar-sort-desktop',
          showFiltersButton ? 'gallery-toolbar-sort-has-filters' : 'gallery-toolbar-sort-fallback',
        ].join(' ')}
      >
        <SortOrderBar
          variant="toolbar"
          hideLabel
          label="Sort"
          idPrefix={sortIdPrefix}
          navAriaLabel="Gallery sort order"
          value={sortOrder}
          onChange={onSortOrderChange}
        />
        {filtersControl}
      </div>

      {showMenu ? (
        <div className="gallery-toolbar-menu">
          {showExitCollection ? (
            <button
              type="button"
              className="gallery-toolbar-btn"
              onClick={onExitCollection}
            >
              All photos
            </button>
          ) : null}
          {showClear ? (
            <button
              type="button"
              className="gallery-toolbar-btn gallery-toolbar-btn-muted"
              onClick={onClearAll}
            >
              Clear
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="gallery-toolbar-theme">
        <ThemeToggle compact />
      </div>
    </nav>
  )
}
