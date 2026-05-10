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
  const [selectedTag, setSelectedTag] = useState<string | null>(null)

  const annotated: GalleryEntry[] = useMemo(
    () =>
      entries.map((e) => {
        const meta = parseFilenameMeta(e.file)
        return {
          ...e,
          tags: meta.tags,
          locationDisplay: meta.locationDisplay,
        }
      }),
    [entries],
  )

  const allTags = useMemo(() => {
    const set = new Set<string>()
    for (const item of annotated) {
      for (const t of item.tags) set.add(t)
    }
    return [...set].sort((a, b) => a.localeCompare(b))
  }, [annotated])

  const filtered = useMemo(() => {
    if (!selectedTag) return annotated
    return annotated.filter((item) => item.tags.includes(selectedTag))
  }, [annotated, selectedTag])

  const collectionsLabel = site.collectionsLabel ?? 'Series'

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
        label={collectionsLabel}
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
