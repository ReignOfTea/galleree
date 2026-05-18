import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CollectionViewBar } from './components/CollectionViewBar'
import { CollectionsModal } from './components/CollectionsModal'
import { Gallery } from './components/Gallery'
import { GalleryFiltersPanel } from './components/GalleryFiltersPanel'
import { GalleryToolbar } from './components/GalleryToolbar'
import { PortfolioFooter } from './components/PortfolioFooter'
import { PortfolioIntro } from './components/PortfolioIntro'
import { ThemeToggle } from './components/ThemeToggle'
import { useCollectionCoverPreload } from './hooks/useCollectionCoverPreload'
import { useGalleryManifest } from './hooks/useGalleryManifest'
import { useSiteConfig } from './hooks/useSiteConfig'
import { preloadCollectionCovers } from './lib/assetCache'
import { maxConcurrentImageLoads } from './lib/config'
import { createLoadGate } from './lib/loadGate'
import { resolveEmptyMessages } from './lib/siteConfig'
import type { GalleryEntry } from './hooks/useGalleryManifest'
import {
  compareGalleryEntries,
  DEFAULT_GALLERY_SORT_ORDER,
  type GallerySortOrder,
} from './lib/gallerySort'
import {
  collectionPageUrl,
  parseCollectionSlugFromLocation,
  setCollectionSlugInLocation,
} from './lib/collectionDeepLink'
import { entryMatchesCollectionSlug } from './lib/galleryCollections'
import { galleryEntryMatchesQuery } from './lib/gallerySearch'
import './App.css'

export default function App() {
  const site = useSiteConfig()
  const { entries: entriesWithMeta, collections } = useGalleryManifest()
  const locationsLabel = site.locationsLabel ?? 'Locations'
  const tagsLabel = site.tagsLabel ?? 'Tags'
  const collectionsLabel = site.eventsLabel ?? 'Collections'
  const [activeCollectionSlug, setActiveCollectionSlug] = useState<string | null>(
    null,
  )
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null)
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [sortOrder, setSortOrder] =
    useState<GallerySortOrder>(DEFAULT_GALLERY_SORT_ORDER)
  const [searchQuery, setSearchQuery] = useState('')
  const [locationsOpen, setLocationsOpen] = useState(false)
  const [tagsOpen, setTagsOpen] = useState(false)
  const [collectionLinkCopied, setCollectionLinkCopied] = useState(false)
  const [filtersPanelOpen, setFiltersPanelOpen] = useState(false)
  const [collectionsModalOpen, setCollectionsModalOpen] = useState(false)

  const preloadGate = useMemo(
    () => createLoadGate(maxConcurrentImageLoads),
    [],
  )
  useCollectionCoverPreload(collections, preloadGate)

  const collectionsWarmedRef = useRef(false)
  const warmupCollectionCovers = useCallback(() => {
    if (collectionsWarmedRef.current || collections.length === 0) return
    collectionsWarmedRef.current = true
    preloadCollectionCovers(collections, preloadGate)
  }, [collections, preloadGate])

  const titleBySlug = useMemo(
    () => new Map(collections.map((c) => [c.slug, c.title])),
    [collections],
  )

  const activeCollection = useMemo(
    () =>
      activeCollectionSlug
        ? (collections.find((c) => c.slug === activeCollectionSlug) ?? null)
        : null,
    [activeCollectionSlug, collections],
  )

  const setLocationsOpenExclusive = useCallback((open: boolean) => {
    setLocationsOpen(open)
    if (open) setTagsOpen(false)
  }, [])

  const setTagsOpenExclusive = useCallback((open: boolean) => {
    setTagsOpen(open)
    if (open) setLocationsOpen(false)
  }, [])

  const closeFiltersPanel = useCallback(() => {
    setFiltersPanelOpen(false)
    setLocationsOpen(false)
    setTagsOpen(false)
  }, [])

  const openCollection = useCallback((slug: string | null) => {
    const normalized = slug?.trim().toLowerCase() ?? null
    setActiveCollectionSlug(normalized)
    setCollectionSlugInLocation(normalized)
    setCollectionsModalOpen(false)
  }, [])

  const exitCollection = useCallback(() => {
    openCollection(null)
  }, [openCollection])

  const clearFacetFilters = useCallback(() => {
    setSelectedLocation(null)
    setSelectedTags([])
  }, [])

  const clearAllFilters = useCallback(() => {
    clearFacetFilters()
    setSearchQuery('')
    exitCollection()
    closeFiltersPanel()
  }, [clearFacetFilters, closeFiltersPanel, exitCollection])

  useEffect(() => {
    const syncFromLocation = () => {
      const slug = parseCollectionSlugFromLocation()
      if (!slug) {
        setActiveCollectionSlug(null)
        return
      }
      const valid = collections.some((c) => c.slug === slug)
      setActiveCollectionSlug(valid ? slug : null)
      if (!valid) setCollectionSlugInLocation(null)
    }
    syncFromLocation()
    window.addEventListener('popstate', syncFromLocation)
    window.addEventListener('hashchange', syncFromLocation)
    return () => {
      window.removeEventListener('popstate', syncFromLocation)
      window.removeEventListener('hashchange', syncFromLocation)
    }
  }, [collections])

  const scopeEntries = useMemo(() => {
    if (!activeCollectionSlug) return entriesWithMeta
    return entriesWithMeta.filter((item) =>
      entryMatchesCollectionSlug(item, activeCollectionSlug, titleBySlug),
    )
  }, [entriesWithMeta, activeCollectionSlug, titleBySlug])

  const annotated: GalleryEntry[] = useMemo(() => {
    const copy = [...scopeEntries]
    copy.sort((a, b) => compareGalleryEntries(a, b, sortOrder))
    return copy
  }, [scopeEntries, sortOrder])

  const poolForFacets = useMemo(() => {
    return scopeEntries.filter((item) => {
      if (
        selectedLocation != null &&
        item.locationDisplay !== selectedLocation
      ) {
        return false
      }
      return true
    })
  }, [scopeEntries, selectedLocation])

  const allLocations = useMemo(() => {
    const set = new Set<string>()
    for (const item of poolForFacets) {
      if (item.locationDisplay) set.add(item.locationDisplay)
    }
    return [...set].sort((a, b) => a.localeCompare(b))
  }, [poolForFacets])

  const availableTags = useMemo(() => {
    const set = new Set<string>()
    for (const item of poolForFacets) {
      for (const t of item.tags) {
        if (item.locationDisplay && t === item.locationDisplay) continue
        set.add(t)
      }
    }
    return [...set].sort((a, b) => a.localeCompare(b))
  }, [poolForFacets])

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

  const emptyMessages = useMemo(() => resolveEmptyMessages(site), [site])

  const galleryEmptyHint =
    filtered.length === 0 && facetFiltered.length > 0
      ? searchQuery.trim()
        ? 'search'
        : 'filters'
      : undefined

  const locationSummary =
    selectedLocation ?? `All ${locationsLabel.toLowerCase()}`

  const tagsSummary = useMemo(() => {
    if (effectiveSelectedTags.length === 0) {
      return `All ${tagsLabel.toLowerCase()}`
    }
    const joined = effectiveSelectedTags.join(', ')
    return joined.length > 72 ? `${joined.slice(0, 71)}…` : joined
  }, [effectiveSelectedTags, tagsLabel])

  const copyCollectionLink = useCallback(async () => {
    if (!activeCollectionSlug) return
    const url = collectionPageUrl(activeCollectionSlug)
    try {
      await navigator.clipboard.writeText(url)
      setCollectionLinkCopied(true)
      window.setTimeout(() => setCollectionLinkCopied(false), 2200)
    } catch {
      /* clipboard unavailable */
    }
  }, [activeCollectionSlug])

  const showFilters = allLocations.length > 0 || availableTags.length > 0

  const filtersFacetActive =
    selectedLocation != null || effectiveSelectedTags.length > 0

  const showClearFilters =
    filtersFacetActive ||
    searchQuery.trim().length > 0 ||
    activeCollectionSlug != null

  const filtersPanelProps = {
    locationsLabel,
    tagsLabel,
    allLocations,
    availableTags,
    selectedLocation,
    onSelectLocation: setSelectedLocation,
    effectiveSelectedTags,
    onToggleTag: toggleTag,
    onClearTags: clearTags,
    locationSummary,
    tagsSummary,
    locationsOpen,
    onLocationsOpenChange: setLocationsOpenExclusive,
    tagsOpen,
    onTagsOpenChange: setTagsOpenExclusive,
    showClear: filtersFacetActive,
    onClearFilters: clearFacetFilters,
    sortOrder,
    onSortOrderChange: setSortOrder,
  }

  useEffect(() => {
    if (!filtersPanelOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeFiltersPanel()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [filtersPanelOpen, closeFiltersPanel])

  useEffect(() => {
    document.body.classList.toggle('gallery-filters-panel-open', filtersPanelOpen)
    return () => document.body.classList.remove('gallery-filters-panel-open')
  }, [filtersPanelOpen])

  return (
    <div className="portfolio">
      <a href="#gallery-main" className="skip-link">
        Skip to gallery
      </a>
      {entriesWithMeta.length === 0 ? (
        <div className="portfolio-head-tools">
          <ThemeToggle />
        </div>
      ) : null}

      <div className="portfolio-hero">
        <PortfolioIntro config={site} />
        {entriesWithMeta.length > 0 ? (
          <section
            className="gallery-toolbar-section"
            aria-label="Gallery search and filters"
          >
            <GalleryToolbar
              searchQuery={searchQuery}
              onSearchQueryChange={setSearchQuery}
              sortOrder={sortOrder}
              onSortOrderChange={setSortOrder}
              filtersOpen={filtersPanelOpen}
              onFiltersToggle={() => setFiltersPanelOpen((open) => !open)}
              filtersActive={filtersFacetActive}
              showFiltersButton={showFilters}
              collectionsLabel={collectionsLabel}
              showCollectionsButton={collections.length > 0}
              collectionViewActive={activeCollectionSlug != null}
              onCollectionsOpen={() => {
                warmupCollectionCovers()
                setCollectionsModalOpen(true)
              }}
              onCollectionsWarmup={warmupCollectionCovers}
              showExitCollection={activeCollectionSlug != null}
              onExitCollection={exitCollection}
              showClear={showClearFilters}
              onClearAll={clearAllFilters}
              onFiltersClose={closeFiltersPanel}
              filtersPanel={
                showFilters ? (
                  <GalleryFiltersPanel {...filtersPanelProps} />
                ) : undefined
              }
            />
          </section>
        ) : null}
      </div>

      <main id="gallery-main" className="portfolio-main" tabIndex={-1}>
        {activeCollection ? (
          <CollectionViewBar
            title={activeCollection.title}
            description={activeCollection.description}
            linkCopied={collectionLinkCopied}
            onCopyLink={() => void copyCollectionLink()}
          />
        ) : null}
        {entriesWithMeta.length === 0 && (
          <p className="gallery-empty">{emptyMessages.noImages}</p>
        )}
        {entriesWithMeta.length > 0 && (
          <Gallery
            items={filtered}
            allItems={annotated}
            siteTitle={site.title}
            emptyHint={galleryEmptyHint}
            emptyMessages={emptyMessages}
            selectedTags={effectiveSelectedTags}
            onToggleTag={toggleTag}
          />
        )}
      </main>

      <PortfolioFooter config={site} />

      {collectionsModalOpen && collections.length > 0 ? (
        <CollectionsModal
          label={collectionsLabel}
          collections={collections}
          onSelect={openCollection}
          onClose={() => setCollectionsModalOpen(false)}
        />
      ) : null}
    </div>
  )
}
