import fs from 'node:fs'
import path from 'node:path'
import type { Plugin } from 'vite'
import {
  buildGalleryManifest,
  GALLERY_MANIFEST_FILENAME,
} from './buildGalleryManifest'

function isInsideDir(file: string, dir: string): boolean {
  const rel = path.relative(dir, file)
  return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel)
}

function manifestUrlPath(viteBase: string): string {
  const base = viteBase.endsWith('/') ? viteBase : `${viteBase}/`
  return `${base}${GALLERY_MANIFEST_FILENAME}`
}

export function galleryManifestPlugin(): Plugin {
  let root = ''
  let viteBase = '/'
  let cachedJson = '{"generatedAt":"","images":[]}'

  async function refreshManifest(): Promise<void> {
    const manifest = await buildGalleryManifest(root, viteBase)
    cachedJson = JSON.stringify(manifest)
  }

  return {
    name: 'galleree-gallery-manifest',

    configResolved(config) {
      root = config.root
      viteBase = config.base
    },

    async buildStart() {
      await refreshManifest()
    },

    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: GALLERY_MANIFEST_FILENAME,
        source: cachedJson,
      })
    },

    configureServer(server) {
      const galleryDir = path.resolve(server.config.root, 'public', 'gallery')
      const metaDir = path.join(galleryDir, 'meta')
      const siteJsonPath = path.resolve(server.config.root, 'public', 'site.json')
      fs.mkdirSync(galleryDir, { recursive: true })
      fs.mkdirSync(metaDir, { recursive: true })
      server.watcher.add(galleryDir)
      server.watcher.add(metaDir)
      server.watcher.add(siteJsonPath)

      const manifestPath = manifestUrlPath(server.config.base)

      void refreshManifest()

      server.middlewares.use((req, res, next) => {
        if (!req.url) return next()
        try {
          const pathname = new URL(req.url, 'http://local').pathname
          if (pathname === manifestPath || pathname.endsWith(`/${GALLERY_MANIFEST_FILENAME}`)) {
            res.setHeader('Content-Type', 'application/json; charset=utf-8')
            res.setHeader('Cache-Control', 'no-cache')
            res.end(cachedJson)
            return
          }
        } catch {
          /* fall through */
        }
        next()
      })

      const maybeReload = (filepath: string) => {
        const normFile = path.normalize(filepath)
        const inGallery = isInsideDir(normFile, path.normalize(galleryDir))
        const isSiteConfig =
          normFile === path.normalize(siteJsonPath) ||
          normFile.endsWith(`${path.sep}site.json`)
        if (!inGallery && !isSiteConfig) return
        void refreshManifest().then(() => {
          server.ws.send({ type: 'full-reload', path: '*' })
        })
      }

      server.watcher.on('add', maybeReload)
      server.watcher.on('unlink', maybeReload)
      server.watcher.on('change', maybeReload)
    },
  }
}
