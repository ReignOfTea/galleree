#!/usr/bin/env node
/**
 * Commit and push local gallery assets + site config to origin/master (or GALLERY_SYNC_*).
 * Uses git add -f for public/gallery (gitignored paths) like the desktop uploader.
 */

import fs from 'node:fs'
import path from 'node:path'
import {
  BRANCH,
  REMOTE,
  ROOT,
  currentBranch,
  die,
  ensureGitRepo,
  existingSyncPublicFiles,
  fetchRemote,
  log,
  runGit,
  warn,
} from './gallery-sync-lib.mjs'

const DRY = process.env.GALLERY_SYNC_DRY === '1'
const SKIP_PULL = process.env.GALLERY_SYNC_SKIP_PULL === '1'
const ALLOW_ANY_BRANCH = process.env.GALLERY_SYNC_ALLOW_ANY_BRANCH === '1'
const COMMIT_MESSAGE =
  process.env.GALLERY_SYNC_COMMIT_MESSAGE?.trim() ||
  'Sync gallery assets and site config from local'

function assertBranch() {
  const branch = currentBranch()
  if (branch !== BRANCH && !ALLOW_ANY_BRANCH) {
    die(
      `Current branch is “${branch}”; switch to ${BRANCH} or set GALLERY_SYNC_ALLOW_ANY_BRANCH=1.`,
    )
  }
}

function pullRebase() {
  log(`Rebasing onto ${REMOTE}/${BRANCH}…`)
  const r = runGit(['pull', '--rebase', REMOTE, BRANCH], { allowFailure: true })
  if (r.status !== 0) {
    die(
      `git pull --rebase failed. Resolve conflicts, then re-run.\n${r.text}`,
    )
  }
}

function stageSyncPaths() {
  if (!fs.existsSync(path.join(ROOT, 'public', 'gallery'))) {
    die('public/gallery/ does not exist — nothing to push.')
  }

  runGit(['add', '-f', '--', 'public/gallery'])

  const configFiles = existingSyncPublicFiles()
  if (configFiles.length > 0) {
    runGit(['add', '--', ...configFiles])
  }

  return runGit(['diff', '--cached', '--name-only']).stdout
}

function main() {
  ensureGitRepo()
  assertBranch()

  log(`Pushing gallery to ${REMOTE}/${BRANCH} from branch “${currentBranch()}”`)

  if (DRY) {
    warn('GALLERY_SYNC_DRY=1 — would fetch, pull, add, commit, and push only.')
    return
  }

  fetchRemote()
  if (!SKIP_PULL) pullRebase()

  const staged = stageSyncPaths()
  if (!staged) {
    log('Nothing to commit — local gallery and config already match the index.')
    return
  }

  log(`Staged:\n${staged.split('\n').map((l) => `  ${l}`).join('\n')}`)

  runGit(['commit', '-m', COMMIT_MESSAGE])

  const head = currentBranch()
  if (head === BRANCH) {
    log(`Pushing to ${REMOTE}/${BRANCH}…`)
    runGit(['push', REMOTE, BRANCH])
  } else {
    log(`Pushing HEAD to ${REMOTE}/${BRANCH}…`)
    runGit(['push', REMOTE, `HEAD:${BRANCH}`])
  }

  log('Done.')
}

main()
