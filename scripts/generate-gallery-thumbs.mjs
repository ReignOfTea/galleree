/**
 * Writes JPEG thumbnails under public/gallery/thumbs/{id}.jpg for each
 * public/gallery/meta/{id}.json sidecar.
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { blurHashFromImagePath } from '../vite/blurHashEncode.ts'

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

async function writeBlurHashToMeta(metaPath, imagePath) {
  try {
    const hash = await blurHashFromImagePath(imagePath)
    if (!hash) return false
    const raw = JSON.parse(fs.readFileSync(metaPath, 'utf8'))
    if (!raw || typeof raw !== 'object' || raw.blurHash === hash) return false
    raw.blurHash = hash
    fs.writeFileSync(metaPath, `${JSON.stringify(raw, null, 2)}\n`, 'utf8')
    return true
  } catch {
    return false
  }
}

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
  let blurUpdated = 0

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
    const metaPath = path.join(metaDir, `${id}.json`)

    try {
      const stSrc = fs.statSync(src)
      if (fs.existsSync(dest) && process.env.SKIP_THUMB_FORCE !== '1') {
        const stDest = fs.statSync(dest)
        if (stDest.mtimeMs >= stSrc.mtimeMs) {
          if (await writeBlurHashToMeta(metaPath, dest)) blurUpdated += 1
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

    if (await writeBlurHashToMeta(metaPath, dest)) blurUpdated += 1

    wrote += 1
  }

  console.log(
    `[gallery-thumbs] Done. Wrote ${wrote}, skipped up-to-date ${skipped}, blurHash updated ${blurUpdated}, max width ${MAX_WIDTH}px → ${path.relative(root, thumbsDir)}`,
  )
}

main().catch((err) => {
  console.error('[gallery-thumbs]', err)
  process.exit(1)
})
