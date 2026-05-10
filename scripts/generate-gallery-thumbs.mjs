/**
 * Writes JPEG thumbnails under public/gallery/thumbs/{stem}.jpg for each image at
 * public/gallery/{stem}.{ext} so the grid can load smaller files; lightbox still uses originals.
 *
 * Skips a file when the thumb exists and is newer than the source (unless SKIP_THUMB_FORCE=1).
 * Set SKIP_THUMBS=1 to no-op (e.g. quick CI iteration).
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const galleryDir = path.join(root, 'public', 'gallery')
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

async function main() {
  if (process.env.SKIP_THUMBS === '1') {
    console.warn('[gallery-thumbs] SKIP_THUMBS=1 — skipping thumbnail generation.')
    return
  }

  if (!fs.existsSync(galleryDir)) {
    console.warn('[gallery-thumbs] No public/gallery folder; nothing to do.')
    return
  }

  fs.mkdirSync(thumbsDir, { recursive: true })

  const entries = fs.readdirSync(galleryDir, { withFileTypes: true })
  let wrote = 0
  let skipped = 0

  for (const ent of entries) {
    if (!ent.isFile()) continue
    const file = ent.name
    const ext = path.extname(file).toLowerCase()
    if (!IMAGE_EXT.has(ext)) continue

    const src = path.join(galleryDir, file)
    const stem = path.basename(file, ext)
    const dest = path.join(thumbsDir, `${stem}.jpg`)

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
