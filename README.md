# Galleree

A static portfolio gallery built with React, TypeScript, and Vite. Images and JSON metadata live under `public/gallery/`; the site builds a manifest at compile time and deploys to GitHub Pages (or any static host).

## Quick start

```bash
npm install
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`). Add photos under `public/gallery/` (see layout below), then refresh—the dev server reloads when gallery files change.

Production build (regenerates thumbs/display from originals, then Vite):

```bash
npm run build
npm run preview
```

After `git clone` or `git pull`, run `npm run generate-assets` (or `npm run build`) once so `thumbs/` and `display/` exist locally.

| Script | Purpose |
|--------|---------|
| `npm run dev` | Dev server with hot reload |
| `npm run build` | `generate-assets` + validate + TypeScript + bundle → `dist/` |
| `npm run generate-assets` | Thumbs, display WebP, blurHash, `exifDisplay` in sidecars |
| `npm run check-gallery-assets` | Re-run generate (unless `--skip-generate`), fail if meta differs from git or derivatives missing |
| `npm run generate-thumbs` | Alias for `generate-assets` |
| `npm run preview` | Serve `dist/` locally |
| `npm run lint` | ESLint |

Set `VITE_BASE` when building for a project site (e.g. `VITE_BASE=/galleree/` for `https://user.github.io/galleree/`). Use `/` or leave unset for a custom domain at the repo root.

## Site config

`public/site.json` drives the header, tagline, social links, and filter labels. See `src/lib/siteConfig.ts` for supported fields. Important keys:

- `title`, `tagline`, `about`
- `siteUrl` — canonical URL for share pages and Open Graph (e.g. `https://gallery.example.com`)
- `logo`, `header` (`title` \| `logo` \| `both`)
- `locationsLabel`, `tagsLabel`, `eventsLabel` (collections filter label)

## Gallery layout

Each published photo needs:

1. **Image** — `public/gallery/{id}.{ext}` (`jpg`, `png`, `webp`, `avif`, or `gif`)
2. **Sidecar** — `public/gallery/meta/{id}.json` (same 32-char hex `id`)
3. **Derivatives** (local + CI only, not in git) — `thumbs/` (grid JPEGs) and `display/` (~2400px WebP for lightbox), from `npm run generate-assets` / `npm run build`

```
public/gallery/
  {id}.jpg                 # tracked in git
  meta/
    {id}.json              # per-image metadata (tracked)
    collections/ …         # registry (tracked)
    cameras/ …
    lenses/ …
  thumbs/                  # generated; .gitkeep only in repo
    {id}.jpg
  display/                 # generated
    {id}.webp
```

### Image metadata (`meta/{id}.json`)

Schema: `schemas/gallery-image-meta.schema.json`. Current version: **1**.

Required: `version`, `id`, `title`, `tags`.

Common optional fields:

| Field | Description |
|-------|-------------|
| `description` | Longer caption text |
| `location` | Shown in filters and captions (not duplicated in `tags`) |
| `capturedOn` | `YYYY-MM-DD` |
| `capturedAt` | ISO 8601 date-time |
| `camera` | Camera slug or label (resolved against `meta/cameras/`) |
| `lens` | Lens slug or label (resolved against `meta/lenses/`; used in camera modal & EXIF fallback) |
| `collectionSlug` | Slug matching `meta/collections/{slug}.json` |
| `alt`, `hidden`, `sortOrder`, `copyright`, `uploadedAt` | Accessibility, ordering, rights |

Tags and equipment slugs are normalized when meta is read (`Youtuber` → `YouTuber`, camera labels → registry slugs when possible). The Atom feed includes JPEG enclosures (thumbs when available). Set `copyright` in `site.json` for a footer rights line.

Example:

```json
{
  "version": 1,
  "id": "39990adb8f064e3ebb2528db6ba98c1d",
  "title": "Sir Robert Peel Statue",
  "tags": ["Statue", "Heritage"],
  "location": "Bury, UK",
  "capturedOn": "2026-05-10",
  "camera": "sony-ilce-7m4",
  "lens": "tamron-28-200mm-f28-56-di-iii-rxd"
}
```

### Collections (`meta/collections/{slug}.json`)

Schema: `schemas/gallery-collection-meta.schema.json`. Provides display titles and optional cover image for the collections filter and deep links (`?collection={slug}`).

### Equipment (`meta/cameras/`, `meta/lenses/`)

Schema: `schemas/gallery-equipment-meta.schema.json`. Registers friendly names, make/model, description, and optional `image` (path relative to `public/gallery/`).

- Captions and the lightbox show **only the camera name**; clicking opens one modal with camera + lens details.
- Camera profiles may set `lensSlug` as the default lens when an image omits `lens`.
- Per-image `lens` in the sidecar overrides the camera default.

Slugs are lowercase hyphenated (e.g. `sony-ilce-7m4`). Image sidecars may use the slug or a human label that slugifies to a registry file.

## Git and gallery assets

**Tracked in git:** originals (`public/gallery/{id}.{ext}`), photo sidecars (`meta/{id}.json`), and equipment/collection registries under `meta/cameras/`, `meta/lenses/`, `meta/collections/`.

**Not tracked (regenerated locally and in CI):** `public/gallery/thumbs/` and `public/gallery/display/` — run `npm run generate-assets` or `npm run build` after clone or pull.

`.gitignore` does **not** shrink an existing clone: anything already committed stays in history and is downloaded on `git pull`. Git only transfers **new or changed** objects, so a code-only push/pull is small unless gallery files changed. The old “ignore the whole gallery + `git add -f`” pattern hid files from normal `git add` but did not stop pulls once assets were on the remote.

### Sync with `origin/master`

| Script | Command |
|--------|---------|
| Pull remote gallery into this checkout | `npm run gallery:pull` |
| Push local gallery + `site.json` / logo / CNAME to remote | `npm run gallery:push` |

`gallery:pull` replaces local gallery originals and meta from the remote, then run `npm run generate-assets`. `gallery:push` runs `git pull --rebase`, `git add public/gallery/`, optional site config, commit, and push. Env: `GALLERY_SYNC_COMMIT_MESSAGE`, `GALLERY_SYNC_SKIP_PULL=1`, `GALLERY_SYNC_DRY=1`. Default branch is `master` unless `GALLERY_SYNC_ALLOW_ANY_BRANCH=1`.

**Code-only work:** commit with `git add` / `git push` as usual.

**CI (GitHub Pages):** Actions runs `npm run generate-assets`, verifies committed sidecars match (`npm run check-gallery-assets`), then builds. Derivatives under `thumbs/` and `display/` are not in git.

### Local deploy script (`local-scripts/deploy.ps1`)

Not in git (see `.gitignore` → `local-scripts/`). Keep your copy on each machine; typical layout:

| Flag / mode | What it does |
|-------------|----------------|
| *(default)* | `npm run build`, stage gallery + `site.json` / logo / CNAME when changed, bump **Galleree Upload** version if `tools/gallery-uploader/` changed, commit, `git pull --rebase`, push |
| `-CodeOnly` | Build and push **without** staging `public/gallery/` (site/src/tooling only) |
| `-DryRun` | Print planned git steps without committing |

**Before a full deploy:** run `npm run generate-assets` locally so `blurHash` / `exifDisplay` in photo sidecars match CI (`check-gallery-assets` fails the Pages workflow if meta would change after generate).

**Uploader-only release** (no site deploy): use `local-scripts/publish-uploader.ps1` — see [tools/gallery-uploader/README.md](tools/gallery-uploader/README.md).

## Desktop uploader

`tools/gallery-uploader/` is a Tauri app for bulk-adding images to a repo checkout, writing sidecars and 720px JPEG thumbs, editing existing metadata, updating `site.json`, and pushing via Git. See [tools/gallery-uploader/README.md](tools/gallery-uploader/README.md) for tokens and releases.

## Android uploader

`tools/gallery-uploader-android/` is a Flutter tablet app with the same gallery workflow. Pushes to `main`/`master` that touch that folder publish a prerelease APK via `.github/workflows/gallery-uploader-android-release.yml`. See [tools/gallery-uploader-android/README.md](tools/gallery-uploader-android/README.md).

## Deployment

GitHub Actions workflow `.github/workflows/deploy-pages.yml` runs `npm run build` on pushes to `main`/`master` when gallery or site code changes. Enable **Pages → Source: GitHub Actions** in the repo settings.

Share pages for individual photos are emitted under `dist/share/p/` when `siteUrl` is set in `site.json`. Collection share pages (with collection-specific Open Graph tags) land under `dist/share/c/` — copy those URLs for Discord/Slack previews; `?collection=` deep links only update the SPA.

## Project structure

| Path | Role |
|------|------|
| `src/` | React UI, hooks, gallery logic |
| `vite/` | Manifest plugin, share HTML, site meta injection |
| `scripts/generate-gallery-assets.mjs` | Thumbs, display WebP, blurHash, EXIF sidecar fields |
| `schemas/` | JSON Schema for metadata files (authoring reference) |
| `public/site.json` | Site copy and branding |
| `public/gallery/` | Images and metadata |

Legacy **filename-encoded** metadata (`title_tags-loc-…`) is still parsed for static share HTML only; the live gallery reads JSON sidecars exclusively.
