#!/usr/bin/env node
/**
 * Backfill `contentHash` (SHA-256 hex of gallery original bytes) into sidecar JSON.
 * Run from repo root: npm run backfill-content-hash
 */
import { createHash } from 'node:crypto'
import { readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const GALLERY_DIR = path.join('public', 'gallery')
const META_DIR = path.join(GALLERY_DIR, 'meta')
const IMAGE_ID_RE = /^[a-f0-9]{32}$/i
const IMAGE_EXT_RE = /\.(jpe?g|png|webp|avif|gif)$/i

async function main() {
  const entries = await readdir(GALLERY_DIR, { withFileTypes: true })
  let updated = 0
  let skipped = 0
  let missingMeta = 0

  for (const entry of entries) {
    if (!entry.isFile()) continue
    const filename = entry.name
    const stem = filename.replace(/\.[^.]+$/i, '')
    if (!IMAGE_ID_RE.test(stem)) continue
    if (!IMAGE_EXT_RE.test(filename)) continue

    const id = stem.toLowerCase()
    const imagePath = path.join(GALLERY_DIR, filename)
    const metaPath = path.join(META_DIR, `${id}.json`)

    let metaRaw
    try {
      metaRaw = await readFile(metaPath, 'utf8')
    } catch {
      missingMeta++
      console.warn(`[backfill-content-hash] missing meta for ${filename}`)
      continue
    }

    const imageBytes = await readFile(imagePath)
    const hash = createHash('sha256').update(imageBytes).digest('hex')

    const meta = JSON.parse(metaRaw)
    if (meta.contentHash === hash) {
      skipped++
      continue
    }

    meta.contentHash = hash
    await writeFile(metaPath, `${JSON.stringify(meta, null, 2)}\n`, 'utf8')
    updated++
    console.log(`[backfill-content-hash] ${id}.json`)
  }

  console.log(
    `[backfill-content-hash] Done. Updated ${updated}, already set ${skipped}, missing meta ${missingMeta}.`,
  )
}

main().catch((err) => {
  console.error('[backfill-content-hash]', err)
  process.exit(1)
})
