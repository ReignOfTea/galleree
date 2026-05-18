import type { GalleryImageMetaFile } from './galleryMeta'

/** Serialized equipment registry entry (paths relative to `gallery/`) */
export type ManifestEquipmentEntry = {
  slug: string
  name: string
  make: string | null
  model: string | null
  description: string | null
  image: string | null
  lensSlug?: string | null
}

export type ManifestImage = {
  file: string
  /** Parsed from `meta/{id}.json` at build time */
  meta: GalleryImageMetaFile
  /** Relative to `gallery/` when generated, e.g. `thumbs/vacation.jpg` */
  thumb?: string
  /** Thumbnail pixel size (from thumb file, or full image when no thumb). */
  thumbWidth?: number
  thumbHeight?: number
  /** Crawler-friendly share page — `share/p/<id>.html` — requires `siteUrl` in site.json */
  shareStub?: string
  /** Full `https://…` share page URL (set at build time when `siteUrl` + `shareStub` exist) */
  sharePageUrl?: string
}

/** Registry entry from `meta/collections/{slug}.json` */
export type ManifestCollection = {
  slug: string
  title: string
  description: string | null
  coverImageId: string | null
}

export type GalleryManifest = {
  generatedAt: string
  /** Collection slug → registry entry (from `meta/collections/*.json`) */
  collections?: Record<string, ManifestCollection>
  equipment?: {
    cameras: Record<string, ManifestEquipmentEntry>
    lenses: Record<string, ManifestEquipmentEntry>
  }
  images: ManifestImage[]
}
