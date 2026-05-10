export type ManifestImage = {
  file: string
  /** Relative to `gallery/` when generated, e.g. `thumbs/vacation.jpg` */
  thumb?: string
}

export type GalleryManifest = {
  generatedAt: string
  images: ManifestImage[]
}
