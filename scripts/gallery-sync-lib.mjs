/**
 * Shared helpers for gallery pull/push scripts (sync with origin/master).
 */

import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
export const ROOT = path.resolve(__dirname, '..')
export const GALLERY_DIR = path.join(ROOT, 'public', 'gallery')
export const META_DIR = path.join(GALLERY_DIR, 'meta')
export const THUMBS_DIR = path.join(GALLERY_DIR, 'thumbs')

export const REMOTE = process.env.GALLERY_SYNC_REMOTE ?? 'origin'
export const BRANCH = process.env.GALLERY_SYNC_BRANCH ?? 'master'
export const REMOTE_REF = `${REMOTE}/${BRANCH}`

/** Paths checked out on pull and staged on push (besides force-added gallery). */
export const SYNC_PUBLIC_FILES = [
  'public/site.json',
  'public/logo.svg',
  'public/CNAME',
]

export const IMAGE_EXT = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.avif',
  '.gif',
])

export const PHOTO_ID_RE = /^[a-f0-9]{32}$/i

export function log(msg) {
  console.log(`[gallery-sync] ${msg}`)
}

export function warn(msg) {
  console.warn(`[gallery-sync] ${msg}`)
}

export function die(msg, code = 1) {
  console.error(`[gallery-sync] ${msg}`)
  process.exit(code)
}

export function runGit(args, { allowFailure = false } = {}) {
  const r = spawnSync('git', args, {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  })
  const out = `${r.stdout ?? ''}${r.stderr ?? ''}`.trim()
  if (r.status !== 0 && !allowFailure) {
    die(`git ${args.join(' ')} failed${out ? `:\n${out}` : ''}`)
  }
  return { status: r.status ?? 1, stdout: (r.stdout ?? '').trim(), stderr: (r.stderr ?? '').trim(), text: out }
}

export function currentBranch() {
  return runGit(['rev-parse', '--abbrev-ref', 'HEAD']).stdout
}

export function ensureGitRepo() {
  const r = runGit(['rev-parse', '--git-dir'], { allowFailure: true })
  if (r.status !== 0) die('Not a git repository.')
}

export function fetchRemote() {
  log(`Fetching ${REMOTE} ${BRANCH}…`)
  runGit(['fetch', REMOTE, BRANCH])
}

function removeEntry(dir, name, { keepGitkeep = false } = {}) {
  if (keepGitkeep && name === '.gitkeep') return
  fs.rmSync(path.join(dir, name), { recursive: true, force: true })
}

/** Remove local gallery images, photo sidecars, thumbs, and registry files before pull. */
export function cleanLocalGalleryAssets() {
  if (!fs.existsSync(GALLERY_DIR)) {
    fs.mkdirSync(GALLERY_DIR, { recursive: true })
    return
  }

  let removed = 0

  for (const name of fs.readdirSync(GALLERY_DIR)) {
    const full = path.join(GALLERY_DIR, name)
    if (!fs.statSync(full).isFile()) continue
    const ext = path.extname(name).toLowerCase()
    if (IMAGE_EXT.has(ext)) {
      fs.rmSync(full, { force: true })
      removed += 1
    }
  }

  if (fs.existsSync(THUMBS_DIR)) {
    for (const name of fs.readdirSync(THUMBS_DIR)) {
      removeEntry(THUMBS_DIR, name)
      removed += 1
    }
  } else {
    fs.mkdirSync(THUMBS_DIR, { recursive: true })
  }

  if (fs.existsSync(META_DIR)) {
    for (const name of fs.readdirSync(META_DIR)) {
      const full = path.join(META_DIR, name)
      if (!fs.statSync(full).isFile() || !name.endsWith('.json')) continue
      const stem = name.replace(/\.json$/i, '')
      if (PHOTO_ID_RE.test(stem)) {
        fs.rmSync(full, { force: true })
        removed += 1
      }
    }

    for (const sub of ['collections', 'cameras', 'lenses']) {
      const dir = path.join(META_DIR, sub)
      if (!fs.existsSync(dir)) continue
      for (const name of fs.readdirSync(dir)) {
        removeEntry(dir, name, { keepGitkeep: true })
        removed += 1
      }
    }
  }

  log(`Removed ${removed} local gallery file(s) before checkout.`)
}

export function checkoutFromRemote() {
  const toCheckout = ['public/gallery']
  for (const rel of SYNC_PUBLIC_FILES) {
    const r = runGit(['cat-file', '-e', `${REMOTE_REF}:${rel}`], { allowFailure: true })
    if (r.status === 0) toCheckout.push(rel)
  }

  log(`Checking out ${toCheckout.join(', ')} from ${REMOTE_REF}…`)
  runGit(['checkout', REMOTE_REF, '--', ...toCheckout])
}

export function existingSyncPublicFiles() {
  return SYNC_PUBLIC_FILES.filter((rel) => fs.existsSync(path.join(ROOT, rel)))
}
