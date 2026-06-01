#!/usr/bin/env node
/**
 * Replace local gallery assets with the versions on origin/master (or GALLERY_SYNC_*).
 *
 * 1. Fetch remote branch
 * 2. Delete local images, photo meta JSON, thumbs, and registry JSON/assets
 * 3. git checkout remote branch for public/gallery and site config files
 */

import {
  BRANCH,
  REMOTE_REF,
  cleanLocalGalleryAssets,
  checkoutFromRemote,
  currentBranch,
  die,
  ensureGitRepo,
  fetchRemote,
  log,
  runGit,
  warn,
} from './gallery-sync-lib.mjs'

const DRY = process.env.GALLERY_SYNC_DRY === '1'

function main() {
  ensureGitRepo()
  log(`Pulling gallery from ${REMOTE_REF} (current branch: ${currentBranch()})`)

  if (DRY) {
    warn('GALLERY_SYNC_DRY=1 — would fetch, clean, and checkout only.')
    return
  }

  fetchRemote()

  if (runGit(['rev-parse', REMOTE_REF], { allowFailure: true }).status !== 0) {
    die(`Remote ref ${REMOTE_REF} not found after fetch.`)
  }

  cleanLocalGalleryAssets()
  checkoutFromRemote()

  log(`Done. Local public/gallery matches remote ${BRANCH}.`)
  log('Run npm run generate-assets if thumbs or display/ are missing locally.')
}

main()
