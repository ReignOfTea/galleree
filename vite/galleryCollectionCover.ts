import fs from 'node:fs'
import path from 'node:path'
import {
  isValidGalleryImageId,
  parseGalleryMetaFile,
} from '../src/lib/galleryMeta'

const IMAGE_EXT = ['.jpg', '.jpeg', '.png', '.webp', '.avif', '.gif'] as const

function findImageForId(galleryDir: string, id: string): string | null {
  for (const ext of IMAGE_EXT) {
    const candidate = `${id}${ext}`
    if (fs.existsSync(path.join(galleryDir, candidate))) return candidate
  }
  return null
}

function imageRelForId(galleryDir: string, id: string): string | null {
  if (!isValidGalleryImageId(id)) return null
  const thumb = `gallery/thumbs/${id}.jpg`
  if (fs.existsSync(path.join(galleryDir, 'thumbs', `${id}.jpg`))) return thumb
  const file = findImageForId(galleryDir, id)
  return file ? `gallery/${file}` : null
}

/** Member image ids for a collection, sorted for stable OG picks. */
function collectionMemberIds(galleryDir: string, slug: string): string[] {
  const metaDir = path.join(galleryDir, 'meta')
  if (!fs.existsSync(metaDir)) return []
  const normalized = slug.trim().toLowerCase()
  const ids: string[] = []

  for (const ent of fs.readdirSync(metaDir, { withFileTypes: true })) {
    if (!ent.isFile() || !ent.name.endsWith('.json')) continue
    const id = ent.name.replace(/\.json$/i, '').toLowerCase()
    if (!isValidGalleryImageId(id)) continue
    let raw: unknown
    try {
      raw = JSON.parse(fs.readFileSync(path.join(metaDir, ent.name), 'utf8'))
    } catch {
      continue
    }
    const meta = parseGalleryMetaFile(raw, { expectedId: id })
    if (!meta || meta.hidden) continue
    if (meta.collectionSlug?.toLowerCase() !== normalized) continue
    ids.push(id)
  }

  return ids.sort((a, b) => a.localeCompare(b))
}

/**
 * Public-relative path for a collection's Open Graph image:
 * cover thumb → cover full → first member thumb/full.
 */
export function collectionCoverImageRel(
  galleryDir: string,
  slug: string,
  coverImageId: string | null,
): string | null {
  if (coverImageId) {
    const fromCover = imageRelForId(galleryDir, coverImageId.toLowerCase())
    if (fromCover) return fromCover
  }

  for (const id of collectionMemberIds(galleryDir, slug)) {
    const rel = imageRelForId(galleryDir, id)
    if (rel) return rel
  }

  return null
}
