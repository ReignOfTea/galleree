import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { galleryCacheHeadersPlugin } from './vite/galleryCacheHeadersPlugin'
import { galleryManifestPlugin } from './vite/galleryManifestPlugin'
import { gallerySharePagesPlugin } from './vite/gallerySharePagesPlugin'
import { siteHtmlMetaPlugin } from './vite/siteHtmlMetaPlugin'

// Base URL: default /. Use VITE_BASE=/galleree/ only for reignoftea.github.io/galleree; use / for gallery.reignoftea.com.
// Empty string from CI clears env fallback — treat as default '/'.
function viteBase(): string {
  const raw = process.env.VITE_BASE?.trim()
  if (!raw) return '/'
  const leader = raw.startsWith('/') ? raw : `/${raw}`
  return leader.endsWith('/') ? leader : `${leader}/`
}
const base = viteBase()

export default defineConfig({
  plugins: [
    react(),
    galleryCacheHeadersPlugin(),
    galleryManifestPlugin(),
    gallerySharePagesPlugin({ base }),
    siteHtmlMetaPlugin({ base }),
  ],
  base,
})
