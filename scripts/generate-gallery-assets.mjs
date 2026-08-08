/**
 * Generates gallery derivatives: thumb JPEGs (400/720/1080), display WebP,
 * blurHash + sanitized exifDisplay in sidecars.
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import exifr from 'exifr'
import { blurHashFromImagePath } from '../vite/blurHashEncode.ts'
import {
  exifToDisplayRowsForPublish,
  sanitizeExifRowsForPublish,
} from '../src/lib/exifDisplay.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const galleryDir = path.join(root, 'public', 'gallery')
const metaDir = path.join(galleryDir, 'meta')
const thumbsDir = path.join(galleryDir, 'thumbs')
const displayDir = path.join(galleryDir, 'display')

const specPath = path.join(root, 'schemas', 'gallery-asset-spec.json')
const assetSpec = (() => {
  try {
    if (fs.existsSync(specPath)) {
      return JSON.parse(fs.readFileSync(specPath, 'utf8'))
    }
  } catch {
    /* use defaults below */
  }
  return null
})()

const THUMB_WIDTHS = assetSpec?.siteThumbs?.widths ?? [400, 720, 1080]
const JPEG_QUALITY = Number(
  process.env.GALLERY_THUMB_JPEG_QUALITY ??
    assetSpec?.siteThumbs?.jpegQuality ??
    82,
)
const DISPLAY_MAX_WIDTH = Number(
  process.env.GALLERY_DISPLAY_MAX_WIDTH ?? assetSpec?.display?.maxWidth ?? 2400,
)
const DISPLAY_WEBP_QUALITY = Number(
  process.env.GALLERY_DISPLAY_WEBP_QUALITY ??
    assetSpec?.display?.webpQuality ??
    82,
)
const ENABLE_AVIF = process.env.GALLERY_AVIF === '1'
const AVIF_QUALITY = Number(
  process.env.GALLERY_AVIF_QUALITY ?? assetSpec?.avif?.quality ?? 55,
)

const IMAGE_EXT = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.avif',
  '.gif',
])

const ID_RE = /^[a-f0-9]{32}$/i

function findSourceImage(id) {
  for (const ext of IMAGE_EXT) {
    const candidate = path.join(galleryDir, `${id}${ext}`)
    if (fs.existsSync(candidate)) return candidate
  }
  return null
}

function isUpToDate(outputs, srcMtimeMs) {
  try {
    return outputs.every((p) => {
      if (!fs.existsSync(p)) return false
      return fs.statSync(p).mtimeMs >= srcMtimeMs
    })
  } catch {
    return false
  }
}

async function writeThumb(src, dest, width) {
  await sharp(src)
    .rotate()
    .resize({ width, withoutEnlargement: true })
    .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
    .toFile(dest)
}

async function writeDisplay(src, dest) {
  await sharp(src)
    .rotate()
    .resize({ width: DISPLAY_MAX_WIDTH, withoutEnlargement: true })
    .webp({ quality: DISPLAY_WEBP_QUALITY })
    .toFile(dest)
}

async function writeAvif(src, dest, width) {
  await sharp(src)
    .rotate()
    .resize({ width, withoutEnlargement: true })
    .avif({ quality: AVIF_QUALITY })
    .toFile(dest)
}

async function writeBlurHashToMeta(metaPath, imagePath) {
  try {
    const raw = JSON.parse(fs.readFileSync(metaPath, 'utf8'))
    if (!raw || typeof raw !== 'object') return false
    // Keep uploader-written hashes. Android and sharp resize paths differ slightly
    // (original vs 720 thumb → 32×32), so overwriting always churns sidecars in CI.
    if (typeof raw.blurHash === 'string' && raw.blurHash.length >= 6) {
      return false
    }
    const hash = await blurHashFromImagePath(imagePath)
    if (!hash) return false
    raw.blurHash = hash
    fs.writeFileSync(metaPath, `${JSON.stringify(raw, null, 2)}\n`, 'utf8')
    return true
  } catch {
    return false
  }
}

async function writeExifDisplayToMeta(metaPath, srcPath) {
  try {
    const metaStat = fs.statSync(metaPath)
    const srcStat = fs.statSync(srcPath)
    const raw = JSON.parse(fs.readFileSync(metaPath, 'utf8'))
    if (!raw || typeof raw !== 'object') return false
    if (
      Array.isArray(raw.exifDisplay) &&
      raw.exifDisplay.length > 0 &&
      raw.exifDisplay.length <= 40 &&
      metaStat.mtimeMs >= srcStat.mtimeMs
    ) {
      return false
    }
    const parsed = await exifr.parse(srcPath, {
      iptc: false,
      xmp: false,
      jfif: true,
      mergeOutput: true,
      reviveValues: true,
    })
    if (!parsed || typeof parsed !== 'object') return false
    const rows = sanitizeExifRowsForPublish(
      exifToDisplayRowsForPublish(parsed),
    )
    raw.exifDisplay = rows.length > 0 ? rows : undefined
    if (!raw.exifDisplay) delete raw.exifDisplay
    fs.writeFileSync(metaPath, `${JSON.stringify(raw, null, 2)}\n`, 'utf8')
    return true
  } catch {
    return false
  }
}

async function main() {
  if (process.env.SKIP_GALLERY_ASSETS === '1') {
    console.warn('[gallery-assets] SKIP_GALLERY_ASSETS=1 — skipping.')
    return
  }

  if (!fs.existsSync(metaDir)) {
    console.warn('[gallery-assets] No public/gallery/meta folder; nothing to do.')
    return
  }

  fs.mkdirSync(thumbsDir, { recursive: true })
  fs.mkdirSync(displayDir, { recursive: true })

  let thumbsWrote = 0
  let thumbsSkipped = 0
  let displayWrote = 0
  let blurUpdated = 0
  let exifUpdated = 0

  for (const ent of fs.readdirSync(metaDir, { withFileTypes: true })) {
    if (!ent.isFile() || !ent.name.endsWith('.json')) continue
    const id = ent.name.replace(/\.json$/i, '')
    if (!ID_RE.test(id)) continue

    const src = findSourceImage(id)
    if (!src) continue

    const metaPath = path.join(metaDir, `${id}.json`)
    const stSrc = fs.statSync(src)
    const thumbOutputs = THUMB_WIDTHS.map((w) =>
      path.join(
        thumbsDir,
        w === 720 ? `${id}.jpg` : `${id}-${w}.jpg`,
      ),
    )
    const thumbAvifOutputs = ENABLE_AVIF
      ? THUMB_WIDTHS.map((w) =>
          path.join(
            thumbsDir,
            w === 720 ? `${id}.avif` : `${id}-${w}.avif`,
          ),
        )
      : []
    const displayOut = path.join(displayDir, `${id}.webp`)
    const displayAvifOut = ENABLE_AVIF
      ? path.join(displayDir, `${id}.avif`)
      : null
    const allOutputs = [
      ...thumbOutputs,
      ...thumbAvifOutputs,
      displayOut,
      ...(displayAvifOut ? [displayAvifOut] : []),
    ]
    const force = process.env.SKIP_THUMB_FORCE === '1'

      if (!force && isUpToDate(allOutputs, stSrc.mtimeMs)) {
      thumbsSkipped += 1
      if (await writeBlurHashToMeta(metaPath, thumbOutputs[1])) blurUpdated += 1
      if (await writeExifDisplayToMeta(metaPath, src)) exifUpdated += 1
      continue
    }

    for (let i = 0; i < THUMB_WIDTHS.length; i++) {
      await writeThumb(src, thumbOutputs[i], THUMB_WIDTHS[i])
      if (ENABLE_AVIF) {
        await writeAvif(src, thumbAvifOutputs[i], THUMB_WIDTHS[i])
      }
    }
    await writeDisplay(src, displayOut)
    if (displayAvifOut) {
      await writeAvif(src, displayAvifOut, DISPLAY_MAX_WIDTH)
    }

    if (await writeBlurHashToMeta(metaPath, thumbOutputs[1])) blurUpdated += 1
    if (await writeExifDisplayToMeta(metaPath, src)) exifUpdated += 1

    thumbsWrote += 1
    displayWrote += 1
  }

  console.log(
    `[gallery-assets] Thumbs wrote ${thumbsWrote}, skipped ${thumbsSkipped}, display wrote ${displayWrote}, blurHash ${blurUpdated}, exifDisplay ${exifUpdated}${ENABLE_AVIF ? ', avif on' : ''}.`,
  )
}

main().catch((err) => {
  console.error('[gallery-assets]', err)
  process.exit(1)
})
