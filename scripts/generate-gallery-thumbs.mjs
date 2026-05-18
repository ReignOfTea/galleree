/**
 * Writes JPEG thumbnails under public/gallery/thumbs/{id}.jpg for each
 * public/gallery/meta/{id}.json sidecar.
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const galleryDir = path.join(root, 'public', 'gallery')
const metaDir = path.join(galleryDir, 'meta')
const thumbsDir = path.join(galleryDir, 'thumbs')

const MAX_WIDTH = Number(process.env.GALLERY_THUMB_MAX_WIDTH ?? 720)
const JPEG_QUALITY = Number(process.env.GALLERY_THUMB_JPEG_QUALITY ?? 82)

const IMAGE_EXT = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.avif',
  '.gif',
])

const ID_RE = /^[a-f0-9]{32}$/i

async function main() {
  if (process.env.SKIP_THUMBS === '1') {
    console.warn('[gallery-thumbs] SKIP_THUMBS=1 — skipping thumbnail generation.')
    return
  }

  if (!fs.existsSync(metaDir)) {
    console.warn('[gallery-thumbs] No public/gallery/meta folder; nothing to do.')
    return
  }

  fs.mkdirSync(thumbsDir, { recursive: true })

  let wrote = 0
  let skipped = 0

  for (const ent of fs.readdirSync(metaDir, { withFileTypes: true })) {
    if (!ent.isFile() || !ent.name.endsWith('.json')) continue
    const id = ent.name.replace(/\.json$/i, '')
    if (!ID_RE.test(id)) continue

    let src = null
    for (const ext of IMAGE_EXT) {
      const candidate = path.join(galleryDir, `${id}${ext}`)
      if (fs.existsSync(candidate)) {
        src = candidate
        break
      }
    }
    if (!src) continue

    const dest = path.join(thumbsDir, `${id}.jpg`)

    try {
      const stSrc = fs.statSync(src)
      if (fs.existsSync(dest) && process.env.SKIP_THUMB_FORCE !== '1') {
        const stDest = fs.statSync(dest)
        if (stDest.mtimeMs >= stSrc.mtimeMs) {
          skipped += 1
          continue
        }
      }
    } catch {
      /* regenerate */
    }

    await sharp(src)
      .rotate()
      .resize({
        width: MAX_WIDTH,
        withoutEnlargement: true,
      })
      .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
      .toFile(dest)

    wrote += 1
  }

  console.log(
    `[gallery-thumbs] Done. Wrote ${wrote}, skipped up-to-date ${skipped}, max width ${MAX_WIDTH}px → ${path.relative(root, thumbsDir)}`,
  )
}

main().catch((err) => {
  console.error('[gallery-thumbs]', err)
  process.exit(1)
})
