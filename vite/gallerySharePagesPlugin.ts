import fs from 'node:fs'
import path from 'node:path'
import type { Plugin } from 'vite'
import {
  loadSiteForShare,
  renderGallerySharePageHtml,
} from './galleryShareHtml'
import { galleryShareStubId } from './sharePageHash'

const IMAGE_EXT = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.avif',
  '.gif',
])

function readGalleryFilenames(root: string): string[] {
  const galleryDir = path.join(root, 'public', 'gallery')
  if (!fs.existsSync(galleryDir)) return []

  return fs
    .readdirSync(galleryDir, { withFileTypes: true })
    .filter(
      (e) =>
        e.isFile() && IMAGE_EXT.has(path.extname(e.name).toLowerCase()),
    )
    .map((e) => e.name)
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
}

export type GallerySharePagesPluginOptions = {
  base: string
}

export function gallerySharePagesPlugin(
  options: GallerySharePagesPluginOptions,
): Plugin {
  const viteBase = options.base ?? '/'
  let root = ''

  function htmlForFile(file: string): string | null {
    const site = loadSiteForShare(root)
    if (!site.siteUrl) return null
    const stubId = galleryShareStubId(file)
    return renderGallerySharePageHtml({
      file,
      stubId,
      siteUrl: site.siteUrl,
      viteBase,
      siteTitle: site.siteTitle,
      description: site.description,
      htmlLang: site.htmlLang,
    })
  }

  return {
    name: 'galleree-gallery-share-pages',

    configResolved(config) {
      root = config.root
    },

    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url) return next()
        try {
          const pathname = new URL(req.url, 'http://local').pathname
          const basePath = viteBase.replace(/\/$/, '') || ''
          let rel = pathname
          if (basePath && rel.startsWith(basePath)) {
            rel = rel.slice(basePath.length) || '/'
          }
          const m = rel.match(/^\/share\/p\/([a-f0-9]{20})\.html$/)
          if (!m) return next()
          const id = m[1]
          const files = readGalleryFilenames(root)
          const file = files.find((f) => galleryShareStubId(f) === id)
          if (!file) return next()
          const html = htmlForFile(file)
          if (!html) return next()
          res.statusCode = 200
          res.setHeader('Content-Type', 'text/html; charset=utf-8')
          res.end(html)
        } catch {
          next()
        }
      })
    },

    writeBundle(bundleOptions) {
      const outDir = bundleOptions.dir
      if (!outDir || !root) return

      const site = loadSiteForShare(root)
      if (!site.siteUrl) return

      const shareDir = path.join(outDir, 'share', 'p')
      fs.mkdirSync(shareDir, { recursive: true })

      for (const file of readGalleryFilenames(root)) {
        const stubId = galleryShareStubId(file)
        const html = renderGallerySharePageHtml({
          file,
          stubId,
          siteUrl: site.siteUrl,
          viteBase,
          siteTitle: site.siteTitle,
          description: site.description,
          htmlLang: site.htmlLang,
        })
        fs.writeFileSync(path.join(shareDir, `${stubId}.html`), html, 'utf8')
      }
    },
  }
}
