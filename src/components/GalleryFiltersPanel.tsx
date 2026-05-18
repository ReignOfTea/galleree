import { CollapsibleFilterSection } from './CollapsibleFilterSection'
import { SortOrderBar } from './SortOrderBar'
import { TagBar } from './TagBar'
import type { GallerySortOrder } from '../lib/gallerySort'

export type GalleryFiltersPanelProps = {
  locationsLabel: string
  tagsLabel: string
  allLocations: string[]
  availableTags: string[]
  selectedLocation: string | null
  onSelectLocation: (label: string | null) => void
  effectiveSelectedTags: string[]
  onToggleTag: (tag: string) => void
  onClearTags: () => void
  locationSummary: string
  tagsSummary: string
  locationsOpen: boolean
  onLocationsOpenChange: (open: boolean) => void
  tagsOpen: boolean
  onTagsOpenChange: (open: boolean) => void
  showClear: boolean
  onClearFilters: () => void
  sortOrder: GallerySortOrder
  onSortOrderChange: (value: GallerySortOrder) => void
}

export function GalleryFiltersPanel({
  locationsLabel,
  tagsLabel,
  allLocations,
  availableTags,
  selectedLocation,
  onSelectLocation,
  effectiveSelectedTags,
  onToggleTag,
  onClearTags,
  locationSummary,
  tagsSummary,
  locationsOpen,
  onLocationsOpenChange,
  tagsOpen,
  onTagsOpenChange,
  showClear,
  onClearFilters,
  sortOrder,
  onSortOrderChange,
}: GalleryFiltersPanelProps) {
  return (
    <div id="gallery-filters-panel" className="gallery-filters-panel" role="dialog" aria-label="Gallery filters">
      <div className="gallery-filters-panel-inner">
        <div className="gallery-filters-panel-sort gallery-toolbar-sort-mobile">
          <SortOrderBar
            variant="toolbar"
            hideLabel
            label="Sort"
            idPrefix="sort-mobile"
            navAriaLabel="Gallery sort order"
            value={sortOrder}
            onChange={onSortOrderChange}
          />
        </div>
        {allLocations.length > 0 ? (
          <CollapsibleFilterSection
            idPrefix="locations"
            title={locationsLabel}
            summary={locationSummary}
            open={locationsOpen}
            onOpenChange={onLocationsOpenChange}
          >
            <TagBar
              variant="nav-only"
              label={locationsLabel}
              idPrefix="locations"
              navAriaLabel="Filter by location"
              resetLabel="All locations"
              tags={allLocations}
              selected={selectedLocation}
              onSelect={onSelectLocation}
            />
          </CollapsibleFilterSection>
        ) : null}

        {availableTags.length > 0 ? (
          <CollapsibleFilterSection
            idPrefix="tags"
            title={tagsLabel}
            summary={tagsSummary}
            open={tagsOpen}
            onOpenChange={onTagsOpenChange}
          >
            <TagBar
              variant="nav-only"
              selectionMode="multi"
              label={tagsLabel}
              idPrefix="tags"
              navAriaLabel="Filter photos by tag (choose any combination)"
              resetLabel="All tags"
              tags={availableTags}
              selectedTags={effectiveSelectedTags}
              onToggleTag={onToggleTag}
              onClearTags={onClearTags}
            />
          </CollapsibleFilterSection>
        ) : null}
        {showClear ? (
          <div className="gallery-filters-panel-footer">
            <button
              type="button"
              className="gallery-clear-btn"
              onClick={onClearFilters}
            >
              Clear filters
            </button>
          </div>
        ) : null}
      </div>
    </div>
  )
}

