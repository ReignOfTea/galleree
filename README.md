# Galleree

A static portfolio gallery built with React, TypeScript, and Vite. Images and JSON metadata live under `public/gallery/`; the site builds a manifest at compile time and deploys to GitHub Pages (or any static host).

## Quick start

```bash
npm install
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`). Add photos under `public/gallery/` (see layout below), then refresh—the dev server reloads when gallery files change.

Production build (regenerates thumbnails, then Vite):

```bash
npm run build
npm run preview
```

| Script | Purpose |
|--------|---------|
| `npm run dev` | Dev server with hot reload |
| `npm run build` | Thumbnails + TypeScript + production bundle → `dist/` |
| `npm run generate-thumbs` | Only `public/gallery/thumbs/*.jpg` |
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
3. **Thumbnail** — `public/gallery/thumbs/{id}.jpg` (created by `npm run build` / `generate-thumbs`)

```
public/gallery/
  {id}.jpg
  meta/
    {id}.json              # per-image metadata (required)
    collections/
      {slug}.json          # collection registry (optional)
    cameras/
      {slug}.json          # camera profile (optional)
      {slug}.png           # product image (optional)
    lenses/
      {slug}.json          # lens profile (optional)
      {slug}.png
  thumbs/
    {id}.jpg
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

`public/gallery/**` is gitignored by default (large binaries). Registry folders are tracked:

- `public/gallery/meta/cameras/**`
- `public/gallery/meta/lenses/**`
- `public/gallery/meta/collections/**`

To commit photos and sidecars: `git add -f public/gallery/` (or use the desktop uploader below).

## Desktop uploader

`tools/gallery-uploader/` is a Tauri app for bulk-adding images to a repo checkout, writing sidecars, generating thumbs, and pushing via Git. See [tools/gallery-uploader/README.md](tools/gallery-uploader/README.md) for tokens and releases.

## Deployment

GitHub Actions workflow `.github/workflows/deploy-pages.yml` runs `npm run build` on pushes to `main`/`master` when gallery or site code changes. Enable **Pages → Source: GitHub Actions** in the repo settings.

Share pages for individual photos are emitted under `dist/share/p/` when `siteUrl` is set in `site.json`.

## Project structure

| Path | Role |
|------|------|
| `src/` | React UI, hooks, gallery logic |
| `vite/` | Manifest plugin, share HTML, site meta injection |
| `scripts/generate-gallery-thumbs.mjs` | Sharp-based thumb generation |
| `schemas/` | JSON Schema for metadata files (authoring reference) |
| `public/site.json` | Site copy and branding |
| `public/gallery/` | Images and metadata |

Legacy **filename-encoded** metadata (`title_tags-loc-…`) is still parsed for static share HTML only; the live gallery reads JSON sidecars exclusively.
