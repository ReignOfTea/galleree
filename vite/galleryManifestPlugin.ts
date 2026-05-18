import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'
import type { Plugin } from 'vite'
import { parseGalleryCollectionMetaFile } from '../src/lib/galleryCollectionMeta'
import { parseGalleryEquipmentMetaFile } from '../src/lib/galleryEquipmentMeta'
import type {
  ManifestCollection,
  ManifestEquipmentEntry,
} from '../src/lib/manifest'
import {
  galleryIdFromBasename,
  isValidGalleryImageBasename,
  isValidGalleryImageId,
  parseGalleryMetaFile,
  thumbRelativePathForId,
  type GalleryImageMetaFile,
} from '../src/lib/galleryMeta'
import { absolutePublicUrl, loadSiteForShare } from './galleryShareHtml'
import { galleryShareStubId } from './sharePageHash'

const VIRTUAL_ID = 'virtual:gallery-manifest'
const RESOLVED_VIRTUAL_ID = '\0' + VIRTUAL_ID

const IMAGE_EXT = ['.jpg', '.jpeg', '.png', '.webp', '.avif', '.gif']

function isInsideDir(file: string, dir: string): boolean {
  const rel = path.relative(dir, file)
  return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel)
}

function findImageForMetaId(galleryDir: string, id: string): string | null {
  for (const ext of IMAGE_EXT) {
    const candidate = `${id}${ext}`
    if (fs.existsSync(path.join(galleryDir, candidate))) return candidate
  }
  return null
}

function loadCollections(
  galleryDir: string,
): Record<string, ManifestCollection> {
  const dir = path.join(galleryDir, 'meta', 'collections')
  const out: Record<string, ManifestCollection> = {}
  if (!fs.existsSync(dir)) return out
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!ent.isFile() || !ent.name.endsWith('.json')) continue
    try {
      const raw = JSON.parse(
        fs.readFileSync(path.join(dir, ent.name), 'utf8'),
      ) as unknown
      const doc = parseGalleryCollectionMetaFile(raw)
      if (doc) {
        out[doc.slug] = {
          slug: doc.slug,
          title: doc.title,
          description: doc.description,
          coverImageId: doc.coverImageId,
        }
      }
    } catch {
      /* skip */
    }
  }
  return out
}

function loadEquipmentRegistry(
  galleryDir: string,
  kind: 'cameras' | 'lenses',
): Record<string, ManifestEquipmentEntry> {
  const dir = path.join(galleryDir, 'meta', kind)
  const out: Record<string, ManifestEquipmentEntry> = {}
  if (!fs.existsSync(dir)) return out
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!ent.isFile() || !ent.name.endsWith('.json')) continue
    const expectedSlug = ent.name.replace(/\.json$/i, '').toLowerCase()
    try {
      const raw = JSON.parse(
        fs.readFileSync(path.join(dir, ent.name), 'utf8'),
      ) as unknown
      const doc = parseGalleryEquipmentMetaFile(raw, { expectedSlug })
      if (!doc) continue
      out[doc.slug] = {
        slug: doc.slug,
        name: doc.name,
        make: doc.make,
        model: doc.model,
        description: doc.description,
        image: doc.image,
        ...(doc.lensSlug ? { lensSlug: doc.lensSlug } : {}),
      }
    } catch {
      /* skip */
    }
  }
  return out
}

async function imagePixelSize(
  filePath: string,
): Promise<{ width: number; height: number } | null> {
  try {
    const { width, height } = await sharp(filePath).metadata()
    if (width && height) return { width, height }
  } catch {
    /* skip */
  }
  return null
}

async function readManifestImages(
  galleryDir: string,
  siteUrl: string | undefined,
  viteBase: string,
): Promise<{
  file: string
  meta: GalleryImageMetaFile
  thumb?: string
  thumbWidth?: number
  thumbHeight?: number
  shareStub?: string
  sharePageUrl?: string
}[]> {
  const metaDir = path.join(galleryDir, 'meta')
  if (!fs.existsSync(metaDir)) return []

  const images: {
    file: string
    meta: GalleryImageMetaFile
    thumb?: string
    thumbWidth?: number
    thumbHeight?: number
    shareStub?: string
    sharePageUrl?: string
  }[] = []

  for (const ent of fs.readdirSync(metaDir, { withFileTypes: true })) {
    if (!ent.isFile() || !ent.name.endsWith('.json')) continue

    const id = ent.name.replace(/\.json$/i, '')
    if (!isValidGalleryImageId(id)) continue

    const metaPath = path.join(metaDir, ent.name)

    let raw: unknown
    try {
      raw = JSON.parse(fs.readFileSync(metaPath, 'utf8'))
    } catch {
      continue
    }

    const meta = parseGalleryMetaFile(raw, { expectedId: id })
    if (!meta || meta.id !== id) continue
    if (meta.hidden) continue

    const galleryFile = findImageForMetaId(galleryDir, id)
    if (!galleryFile || !isValidGalleryImageBasename(galleryFile)) continue
    if (galleryIdFromBasename(galleryFile) !== id) continue

    const thumb = thumbRelativePathForId(id)
    const thumbAbs = path.join(galleryDir, ...thumb.split('/'))
    const entry: {
      file: string
      meta: GalleryImageMetaFile
      thumb?: string
      thumbWidth?: number
      thumbHeight?: number
      shareStub?: string
      sharePageUrl?: string
    } = { file: galleryFile, meta }
    if (fs.existsSync(thumbAbs)) {
      entry.thumb = thumb
      const size = await imagePixelSize(thumbAbs)
      if (size) {
        entry.thumbWidth = size.width
        entry.thumbHeight = size.height
      }
    } else {
      const srcAbs = path.join(galleryDir, galleryFile)
      const size = await imagePixelSize(srcAbs)
      if (size) {
        entry.thumbWidth = size.width
        entry.thumbHeight = size.height
      }
    }

    if (siteUrl) {
      const stubPath = `share/p/${galleryShareStubId(galleryFile)}.html`
      entry.shareStub = stubPath
      entry.sharePageUrl = absolutePublicUrl(siteUrl, viteBase, stubPath)
    }

    images.push(entry)
  }

  return images.sort((a, b) =>
    a.file.localeCompare(b.file, undefined, { sensitivity: 'base' }),
  )
}

export function galleryManifestPlugin(): Plugin {
  let root = ''
  let viteBase = '/'

  return {
    name: 'galleree-gallery-manifest',

    configResolved(config) {
      root = config.root
      viteBase = config.base
    },

    resolveId(id) {
      if (id === VIRTUAL_ID) return RESOLVED_VIRTUAL_ID
    },

    async load(id) {
      if (id !== RESOLVED_VIRTUAL_ID) return

      const galleryDir = path.join(root, 'public', 'gallery')
      const site = loadSiteForShare(root)
      const manifest = {
        generatedAt: new Date().toISOString(),
        collections: loadCollections(galleryDir),
        equipment: {
          cameras: loadEquipmentRegistry(galleryDir, 'cameras'),
          lenses: loadEquipmentRegistry(galleryDir, 'lenses'),
        },
        images: await readManifestImages(
          galleryDir,
          site.siteUrl ?? undefined,
          viteBase,
        ),
      }

      return `export default ${JSON.stringify(manifest)}`
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
