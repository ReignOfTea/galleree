import fs from 'node:fs'
import path from 'node:path'
import { parseGalleryCollectionMetaFile } from '../src/lib/galleryCollectionMeta'
import {
  isValidGalleryImageBasename,
  isValidGalleryImageId,
  parseGalleryMetaFile,
} from '../src/lib/galleryMeta'

const IMAGE_EXT = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.avif',
  '.gif',
])

const RASTER_EXT = IMAGE_EXT

function isRasterRel(rel: string): boolean {
  return RASTER_EXT.has(path.extname(rel).toLowerCase())
}

function findImageForId(galleryDir: string, id: string): string | null {
  for (const ext of IMAGE_EXT) {
    const candidate = `${id}${ext}`
    if (fs.existsSync(path.join(galleryDir, candidate))) return candidate
  }
  return null
}

function loadCollections(galleryDir: string) {
  const dir = path.join(galleryDir, 'meta', 'collections')
  const out: { coverImageId: string | null }[] = []
  if (!fs.existsSync(dir)) return out
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!ent.isFile() || !ent.name.endsWith('.json')) continue
    try {
      const raw = JSON.parse(
        fs.readFileSync(path.join(dir, ent.name), 'utf8'),
      ) as unknown
      const doc = parseGalleryCollectionMetaFile(raw)
      if (doc) out.push({ coverImageId: doc.coverImageId })
    } catch {
      /* skip */
    }
  }
  return out
}

function newestGalleryImage(galleryDir: string): string | null {
  const metaDir = path.join(galleryDir, 'meta')
  if (!fs.existsSync(metaDir)) return null

  let bestFile: string | null = null
  let bestTime = Number.NEGATIVE_INFINITY

  for (const ent of fs.readdirSync(metaDir, { withFileTypes: true })) {
    if (!ent.isFile() || !ent.name.endsWith('.json')) continue
    const id = ent.name.replace(/\.json$/i, '')
    if (!isValidGalleryImageId(id)) continue

    let raw: unknown
    try {
      raw = JSON.parse(fs.readFileSync(path.join(metaDir, ent.name), 'utf8'))
    } catch {
      continue
    }
    const meta = parseGalleryMetaFile(raw, { expectedId: id })
    if (!meta || meta.hidden) continue

    const file = findImageForId(galleryDir, id)
    if (!file) continue

    const t =
      (meta.capturedAt ? Date.parse(meta.capturedAt) : NaN) ||
      (meta.capturedOn
        ? Date.parse(`${meta.capturedOn}T12:00:00.000Z`)
        : NaN) ||
      (meta.uploadedAt ? Date.parse(meta.uploadedAt) : NaN)

    if (!Number.isFinite(t)) continue
    if (t >= bestTime) {
      bestTime = t
      bestFile = file
    }
  }

  return bestFile
}

/**
 * Pick a raster image under `public/` for Open Graph (prefers real photos over SVG logo).
 */
export function pickOgImageRel(
  root: string,
  site: Record<string, unknown>,
): string | null {
  const galleryDir = path.join(root, 'public', 'gallery')

  if (typeof site.ogImage === 'string' && site.ogImage.trim()) {
    const rel = site.ogImage.trim().replace(/^\/+/, '')
    if (isRasterRel(rel)) return rel
  }

  for (const col of loadCollections(galleryDir)) {
    if (!col.coverImageId) continue
    const file = findImageForId(galleryDir, col.coverImageId.toLowerCase())
    if (file) return `gallery/${file}`
  }

  const newest = newestGalleryImage(galleryDir)
  if (newest) return `gallery/${newest}`

  if (typeof site.logo === 'string' && site.logo.trim()) {
    const rel = site.logo.trim().replace(/^\/+/, '')
    if (isRasterRel(rel)) return rel
  }

  if (!fs.existsSync(galleryDir)) return null
  const names = fs
    .readdirSync(galleryDir)
    .filter((name) => isValidGalleryImageBasename(name))
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))

  return names[0] ? `gallery/${names[0]}` : null
}
