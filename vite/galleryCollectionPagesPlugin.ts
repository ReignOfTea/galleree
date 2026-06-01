import fs from 'node:fs'
import path from 'node:path'
import type { Plugin } from 'vite'
import { parseGalleryCollectionMetaFile } from '../src/lib/galleryCollectionMeta'
import { isValidGalleryImageId } from '../src/lib/galleryMeta'
import { loadSiteForShare } from './galleryShareHtml'
import { renderGalleryCollectionPageHtml } from './galleryCollectionHtml'

function coverImageRel(galleryDir: string, coverImageId: string | null): string | null {
  if (!coverImageId || !isValidGalleryImageId(coverImageId)) return null
  const thumb = `gallery/thumbs/${coverImageId}.jpg`
  const thumbAbs = path.join(galleryDir, 'thumbs', `${coverImageId}.jpg`)
  if (fs.existsSync(thumbAbs)) return thumb
  return null
}

export type GalleryCollectionPagesPluginOptions = {
  base: string
}

export function galleryCollectionPagesPlugin(
  options: GalleryCollectionPagesPluginOptions,
): Plugin {
  const viteBase = options.base ?? '/'
  let root = ''

  return {
    name: 'galleree-gallery-collection-pages',

    configResolved(config) {
      root = config.root
    },

    configureServer(server) {
      const basePath = viteBase.replace(/\/$/, '') || ''
      server.middlewares.use((req, res, next) => {
        if (!req.url) return next()
        try {
          const pathname = new URL(req.url, 'http://local').pathname
          let rel = pathname
          if (basePath && rel.startsWith(basePath)) {
            rel = rel.slice(basePath.length) || '/'
          }
          const m = rel.match(/^\/share\/c\/([a-z0-9]+(?:-[a-z0-9]+)*)\.html$/)
          if (!m) return next()
          const slug = m[1]
          const colPath = path.join(
            root,
            'public',
            'gallery',
            'meta',
            'collections',
            `${slug}.json`,
          )
          if (!fs.existsSync(colPath)) return next()
          const site = loadSiteForShare(root)
          if (!site.siteUrl) return next()
          const raw = JSON.parse(fs.readFileSync(colPath, 'utf8')) as unknown
          const doc = parseGalleryCollectionMetaFile(raw)
          if (!doc) return next()
          const galleryDir = path.join(root, 'public', 'gallery')
          const html = renderGalleryCollectionPageHtml({
            slug: doc.slug,
            title: doc.title,
            description: doc.description,
            siteUrl: site.siteUrl,
            viteBase,
            siteTitle: site.siteTitle,
            siteDescription: site.description,
            htmlLang: site.htmlLang,
            coverImageRel: coverImageRel(galleryDir, doc.coverImageId),
          })
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

      const colDir = path.join(root, 'public', 'gallery', 'meta', 'collections')
      if (!fs.existsSync(colDir)) return

      const shareDir = path.join(outDir, 'share', 'c')
      fs.mkdirSync(shareDir, { recursive: true })
      const galleryDir = path.join(root, 'public', 'gallery')

      for (const ent of fs.readdirSync(colDir, { withFileTypes: true })) {
        if (!ent.isFile() || !ent.name.endsWith('.json')) continue
        try {
          const raw = JSON.parse(
            fs.readFileSync(path.join(colDir, ent.name), 'utf8'),
          ) as unknown
          const doc = parseGalleryCollectionMetaFile(raw)
          if (!doc) continue
          const html = renderGalleryCollectionPageHtml({
            slug: doc.slug,
            title: doc.title,
            description: doc.description,
            siteUrl: site.siteUrl,
            viteBase,
            siteTitle: site.siteTitle,
            siteDescription: site.description,
            htmlLang: site.htmlLang,
            coverImageRel: coverImageRel(galleryDir, doc.coverImageId),
          })
          fs.writeFileSync(path.join(shareDir, `${doc.slug}.html`), html, 'utf8')
        } catch {
          /* skip */
        }
      }
    },
  }
}
