import { useCallback, useMemo, useState } from 'react'
import { CollapsibleFilterSection } from './components/CollapsibleFilterSection'
import { Gallery } from './components/Gallery'
import { PortfolioFooter } from './components/PortfolioFooter'
import { PortfolioHeader } from './components/PortfolioHeader'
import { SortOrderBar } from './components/SortOrderBar'
import { TagBar } from './components/TagBar'
import { ThemeToggle } from './components/ThemeToggle'
import { useGalleryManifest } from './hooks/useGalleryManifest'
import { useSiteConfig } from './hooks/useSiteConfig'
import type { GalleryEntry } from './hooks/useGalleryManifest'
import {
  compareGalleryEntries,
  DEFAULT_GALLERY_SORT_ORDER,
  type GallerySortOrder,
} from './lib/gallerySort'
import { galleryEntryMatchesQuery } from './lib/gallerySearch'
import { parseFilenameMeta } from './lib/tags'
import './App.css'

export default function App() {
  const site = useSiteConfig()
  const { entries } = useGalleryManifest()
  const locationsLabel = site.locationsLabel ?? 'Locations'
  const tagsLabel = site.tagsLabel ?? 'Tags'
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null)
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [sortOrder, setSortOrder] =
    useState<GallerySortOrder>(DEFAULT_GALLERY_SORT_ORDER)
  const [searchQuery, setSearchQuery] = useState('')
  const [locationsOpen, setLocationsOpen] = useState(false)
  const [tagsOpen, setTagsOpen] = useState(false)

  const entriesWithMeta: GalleryEntry[] = useMemo(
    () =>
      entries.map((e) => {
        const meta = parseFilenameMeta(e.file)
        return {
          ...e,
          ...meta,
        }
      }),
    [entries],
  )

  const annotated: GalleryEntry[] = useMemo(() => {
    const copy = [...entriesWithMeta]
    copy.sort((a, b) => compareGalleryEntries(a, b, sortOrder))
    return copy
  }, [entriesWithMeta, sortOrder])

  const allLocations = useMemo(() => {
    const set = new Set<string>()
    for (const item of entriesWithMeta) {
      if (item.locationDisplay) set.add(item.locationDisplay)
    }
    return [...set].sort((a, b) => a.localeCompare(b))
  }, [entriesWithMeta])

  const poolForTags = useMemo(() => {
    if (selectedLocation == null) return entriesWithMeta
    return entriesWithMeta.filter(
      (item) => item.locationDisplay === selectedLocation,
    )
  }, [entriesWithMeta, selectedLocation])

  const availableTags = useMemo(() => {
    const set = new Set<string>()
    for (const item of poolForTags) {
      for (const t of item.tags) {
        if (item.locationDisplay && t === item.locationDisplay) continue
        set.add(t)
      }
    }
    return [...set].sort((a, b) => a.localeCompare(b))
  }, [poolForTags])

  /** Tags that apply to the current location scope (drops stale picks when location changes). */
  const effectiveSelectedTags = useMemo(
    () => selectedTags.filter((t) => availableTags.includes(t)),
    [selectedTags, availableTags],
  )

  const toggleTag = useCallback((tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag)
        ? prev.filter((t) => t !== tag)
        : [...prev, tag].sort((a, b) => a.localeCompare(b)),
    )
  }, [])

  const clearTags = useCallback(() => setSelectedTags([]), [])

  const facetFiltered = useMemo(() => {
    return annotated.filter((item) => {
      if (
        selectedLocation != null &&
        item.locationDisplay !== selectedLocation
      ) {
        return false
      }
      for (const t of effectiveSelectedTags) {
        if (!item.tags.includes(t)) return false
      }
      return true
    })
  }, [annotated, selectedLocation, effectiveSelectedTags])

  const filtered = useMemo(() => {
    const q = searchQuery.trim()
    if (!q) return facetFiltered
    return facetFiltered.filter((item) => galleryEntryMatchesQuery(item, q))
  }, [facetFiltered, searchQuery])

  const galleryEmptyHint =
    filtered.length === 0 && facetFiltered.length > 0 && searchQuery.trim()
      ? 'search'
      : 'filters'

  const locationSummary =
    selectedLocation ?? `All ${locationsLabel.toLowerCase()}`

  const tagsSummary = useMemo(() => {
    if (effectiveSelectedTags.length === 0) {
      return `All ${tagsLabel.toLowerCase()}`
    }
    const joined = effectiveSelectedTags.join(', ')
    return joined.length > 72 ? `${joined.slice(0, 71)}…` : joined
  }, [effectiveSelectedTags, tagsLabel])

  return (
    <div className="portfolio">
      <a href="#gallery-main" className="skip-link">
        Skip to gallery
      </a>
      <div className="portfolio-head-tools">
        <ThemeToggle />
      </div>
      <PortfolioHeader config={site} />

      <div className="gallery-control-panel">
        <div className="gallery-controls-toolbar">
          <div className="gallery-search-wrap">
            <label htmlFor="gallery-search" className="visually-hidden">
              Search gallery
            </label>
            <input
              id="gallery-search"
              type="search"
              className="gallery-search-input"
              placeholder="Search title, tags, location, date…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoComplete="off"
              spellCheck={false}
            />
          </div>
          <SortOrderBar
            variant="toolbar"
            label="Sort"
            idPrefix="sort"
            navAriaLabel="Gallery sort order"
            value={sortOrder}
            onChange={setSortOrder}
          />
        </div>

        {allLocations.length > 0 || availableTags.length > 0 ? (
          <div className="gallery-filters-strip">
            {allLocations.length > 0 ? (
              <CollapsibleFilterSection
                idPrefix="locations"
                title={locationsLabel}
                summary={locationSummary}
                open={locationsOpen}
                onOpenChange={setLocationsOpen}
              >
                <TagBar
                  variant="nav-only"
                  label={locationsLabel}
                  idPrefix="locations"
                  navAriaLabel="Filter by location"
                  resetLabel="All locations"
                  tags={allLocations}
                  selected={selectedLocation}
                  onSelect={setSelectedLocation}
                />
              </CollapsibleFilterSection>
            ) : null}

            {availableTags.length > 0 ? (
              <CollapsibleFilterSection
                idPrefix="tags"
                title={tagsLabel}
                summary={tagsSummary}
                open={tagsOpen}
                onOpenChange={setTagsOpen}
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
                  onToggleTag={toggleTag}
                  onClearTags={clearTags}
                />
              </CollapsibleFilterSection>
            ) : null}
          </div>
        ) : null}
      </div>

      <main id="gallery-main" className="portfolio-main" tabIndex={-1}>
        {entries.length === 0 && (
          <p className="gallery-empty">
            Your portfolio is waiting for its first images. Add photographs to{' '}
            <span className="gallery-empty-path">public/gallery</span>, then save
            — they appear here after the dev server picks up the folder or your
            site rebuilds.
          </p>
        )}
        {entries.length > 0 && (
          <Gallery
            items={filtered}
            allItems={annotated}
            siteTitle={site.title}
            emptyHint={galleryEmptyHint}
          />
        )}
      </main>

      <PortfolioFooter config={site} />
    </div>
  )
}
