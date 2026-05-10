export type ManifestImage = {
  file: string
  /** Relative to `gallery/` when generated, e.g. `thumbs/vacation.jpg` */
  thumb?: string
  /** Crawler-friendly share page — `share/p/<id>.html` — requires `siteUrl` in site.json */
  shareStub?: string
  /** Full `https://…` share page URL (set at build time when `siteUrl` + `shareStub` exist) */
  sharePageUrl?: string
}

export type GalleryManifest = {
  generatedAt: string
  images: ManifestImage[]
}
