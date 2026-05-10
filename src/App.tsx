import { useMemo, useState } from 'react'
import { Gallery } from './components/Gallery'
import { PortfolioFooter } from './components/PortfolioFooter'
import { PortfolioHeader } from './components/PortfolioHeader'
import { TagBar } from './components/TagBar'
import { ThemeToggle } from './components/ThemeToggle'
import { useGalleryManifest } from './hooks/useGalleryManifest'
import { useSiteConfig } from './hooks/useSiteConfig'
import type { GalleryEntry } from './hooks/useGalleryManifest'
import { parseFilenameMeta } from './lib/tags'
import './App.css'

export default function App() {
  const site = useSiteConfig()
  const { entries } = useGalleryManifest()
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null)
  const [selectedTag, setSelectedTag] = useState<string | null>(null)

  const annotated: GalleryEntry[] = useMemo(
    () =>
      entries
        .map((e) => {
          const meta = parseFilenameMeta(e.file)
          return {
            ...e,
            ...meta,
          }
        })
        .sort((a, b) => {
          const ta = a.capturedAt ?? Number.NEGATIVE_INFINITY
          const tb = b.capturedAt ?? Number.NEGATIVE_INFINITY
          if (tb !== ta) return tb - ta
          const sa = a.sequence ?? Number.NEGATIVE_INFINITY
          const sb = b.sequence ?? Number.NEGATIVE_INFINITY
          if (sb !== sa) return sb - sa
          return a.file.localeCompare(b.file)
        }),
    [entries],
  )

  const allLocations = useMemo(() => {
    const set = new Set<string>()
    for (const item of annotated) {
      if (item.locationDisplay) set.add(item.locationDisplay)
    }
    return [...set].sort((a, b) => a.localeCompare(b))
  }, [annotated])

  const allTags = useMemo(() => {
    const set = new Set<string>()
    for (const item of annotated) {
      for (const t of item.tags) {
        if (item.locationDisplay && t === item.locationDisplay) continue
        set.add(t)
      }
    }
    return [...set].sort((a, b) => a.localeCompare(b))
  }, [annotated])

  const filtered = useMemo(() => {
    return annotated.filter((item) => {
      if (
        selectedLocation != null &&
        item.locationDisplay !== selectedLocation
      ) {
        return false
      }
      if (selectedTag != null && !item.tags.includes(selectedTag)) {
        return false
      }
      return true
    })
  }, [annotated, selectedLocation, selectedTag])

  const locationsLabel = site.locationsLabel ?? 'Locations'
  const tagsLabel = site.tagsLabel ?? 'Tags'

  return (
    <div className="portfolio">
      <a href="#gallery-main" className="skip-link">
        Skip to gallery
      </a>
      <div className="portfolio-head-tools">
        <ThemeToggle />
      </div>
      <PortfolioHeader config={site} />

      <TagBar
        label={locationsLabel}
        idPrefix="locations"
        navAriaLabel="Filter by location"
        resetLabel="All locations"
        tags={allLocations}
        selected={selectedLocation}
        onSelect={setSelectedLocation}
      />
      <TagBar
        label={tagsLabel}
        idPrefix="tags"
        navAriaLabel="Filter by tag"
        resetLabel="All tags"
        tags={allTags}
        selected={selectedTag}
        onSelect={setSelectedTag}
      />

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
          />
        )}
      </main>

      <PortfolioFooter config={site} />
    </div>
  )
}
