import fs from 'node:fs'
import path from 'node:path'
import type { Plugin } from 'vite'

const VIRTUAL_ID = 'virtual:gallery-manifest'
const RESOLVED_VIRTUAL_ID = '\0' + VIRTUAL_ID

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

/** JPEG thumb path under `gallery/` — same stem as source file */
function thumbRelativePath(galleryFile: string): string {
  const stem = path.basename(galleryFile, path.extname(galleryFile))
  return path.join('thumbs', `${stem}.jpg`).replace(/\\/g, '/')
}

function isInsideDir(file: string, dir: string): boolean {
  const rel = path.relative(dir, file)
  return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel)
}

export function galleryManifestPlugin(): Plugin {
  let root = ''

  return {
    name: 'galleree-gallery-manifest',

    configResolved(config) {
      root = config.root
    },

    resolveId(id) {
      if (id === VIRTUAL_ID) return RESOLVED_VIRTUAL_ID
    },

    load(id) {
      if (id !== RESOLVED_VIRTUAL_ID) return

      const galleryDir = path.join(root, 'public', 'gallery')
      const files = readGalleryFilenames(root)
      const manifest = {
        generatedAt: new Date().toISOString(),
        images: files.map((file) => {
          const thumb = thumbRelativePath(file)
          const thumbAbs = path.join(galleryDir, ...thumb.split('/'))
          const hasThumb = fs.existsSync(thumbAbs)
          return hasThumb ? { file, thumb } : { file }
        }),
      }

      return `export default ${JSON.stringify(manifest)}`
    },

    configureServer(server) {
      const galleryDir = path.resolve(server.config.root, 'public', 'gallery')
      const siteJsonPath = path.resolve(server.config.root, 'public', 'site.json')
      fs.mkdirSync(galleryDir, { recursive: true })
      server.watcher.add(galleryDir)
      server.watcher.add(siteJsonPath)

      const maybeReload = (filepath: string) => {
        const normFile = path.normalize(filepath)
        const inGallery = isInsideDir(normFile, path.normalize(galleryDir))
        const isSiteConfig =
          normFile === path.normalize(siteJsonPath) ||
          normFile.endsWith(`${path.sep}site.json`)
        if (!inGallery && !isSiteConfig) return
        server.ws.send({ type: 'full-reload', path: '*' })
      }

      server.watcher.on('add', maybeReload)
      server.watcher.on('unlink', maybeReload)
      server.watcher.on('change', maybeReload)
    },
  }
}
