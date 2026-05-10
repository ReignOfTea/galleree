/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GALLERY_COLUMNS?: string
  readonly VITE_MAX_CONCURRENT_IMAGE_LOADS?: string
}

declare module 'virtual:gallery-manifest' {
  import type { GalleryManifest } from './lib/manifest'

  const manifest: GalleryManifest
  export default manifest
}
