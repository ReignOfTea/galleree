/**
 * Ensures generate-assets output matches what is committed and that derivatives exist.
 * Run after `npm run generate-assets` (or let this script run it unless --skip-generate).
 */

import { execSync, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const galleryDir = path.join(root, 'public', 'gallery')
const metaDir = path.join(galleryDir, 'meta')
const thumbsDir = path.join(galleryDir, 'thumbs')
const displayDir = path.join(galleryDir, 'display')

const ID_RE = /^[a-f0-9]{32}$/i
const skipGenerate = process.argv.includes('--skip-generate')

function loadThumbWidths() {
  try {
    const spec = JSON.parse(
      fs.readFileSync(
        path.join(root, 'schemas', 'gallery-asset-spec.json'),
        'utf8',
      ),
    )
    return spec?.siteThumbs?.widths ?? [400, 720, 1080]
  } catch {
    return [400, 720, 1080]
  }
}

const THUMB_WIDTHS = loadThumbWidths()

function runGenerateAssets() {
  const r = spawnSync(
    process.execPath,
    [path.join(__dirname, 'generate-gallery-assets.mjs')],
    { cwd: root, stdio: 'inherit' },
  )
  if (r.status !== 0) process.exit(r.status ?? 1)
}

function checkMetaGitClean() {
  try {
    execSync('git diff --exit-code -- public/gallery/meta/', {
      cwd: root,
      stdio: 'pipe',
    })
  } catch {
    let diff = ''
    try {
      diff = execSync('git diff -- public/gallery/meta/', {
        cwd: root,
        encoding: 'utf8',
      })
    } catch {
      /* ignore */
    }
    console.error(
      '[check-gallery-assets] Photo sidecars under public/gallery/meta/ differ after generate-assets.',
    )
    console.error(
      'Run `npm run generate-assets`, commit any blurHash/exifDisplay updates, and push again.',
    )
    if (diff.trim()) console.error(diff)
    process.exit(1)
  }
}

function thumbPaths(id) {
  return THUMB_WIDTHS.map((w) =>
    path.join(thumbsDir, w === 720 ? `${id}.jpg` : `${id}-${w}.jpg`),
  )
}

function checkDerivatives() {
  if (!fs.existsSync(metaDir)) return

  const missing = []
  for (const ent of fs.readdirSync(metaDir, { withFileTypes: true })) {
    if (!ent.isFile() || !ent.name.endsWith('.json')) continue
    const id = ent.name.replace(/\.json$/i, '')
    if (!ID_RE.test(id)) continue
    const hasOriginal = ['.jpg', '.jpeg', '.png', '.webp', '.avif', '.gif'].some(
      (ext) => fs.existsSync(path.join(galleryDir, `${id}${ext}`)),
    )
    if (!hasOriginal) continue
    for (const p of thumbPaths(id)) {
      if (!fs.existsSync(p)) missing.push(path.relative(root, p))
    }
    const display = path.join(displayDir, `${id}.webp`)
    if (!fs.existsSync(display)) missing.push(path.relative(root, display))
  }

  if (missing.length > 0) {
    console.error(
      '[check-gallery-assets] Missing thumb/display files after generate-assets:',
    )
    for (const m of missing.slice(0, 20)) console.error(`  ${m}`)
    if (missing.length > 20) {
      console.error(`  … and ${missing.length - 20} more`)
    }
    process.exit(1)
  }
}

function main() {
  if (!skipGenerate) runGenerateAssets()
  checkMetaGitClean()
  checkDerivatives()
  console.log('[check-gallery-assets] Meta and derivatives are in sync.')
}

main()
