import fs from 'node:fs'
import path from 'node:path'
import { parseGalleryCollectionMetaFile } from '../src/lib/galleryCollectionMeta'
import {
  isValidGalleryImageBasename,
  isValidGalleryImageId,
  parseGalleryMetaFile,
} from '../src/lib/galleryMeta'
import { galleryShareStubId } from './sharePageHash'

const IMAGE_EXT = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.avif',
  '.gif',
])

function findImageForId(galleryDir: string, id: string): string | null {
  for (const ext of IMAGE_EXT) {
    const candidate = `${id}${ext}`
    if (fs.existsSync(path.join(galleryDir, candidate))) return candidate
  }
  return null
}

export type BuildFeedItem = {
  file: string
  title: string
  description: string | null
  uploadedAt: string | null
  capturedAt: string | null
  sharePagePath: string | null
  /** `gallery/thumbs/{id}.jpg` or full-size under `gallery/`. */
  feedImageRel: string
}

export function loadGalleryBuildExtras(root: string): {
  collectionSlugs: string[]
  feedItems: BuildFeedItem[]
} {
  const galleryDir = path.join(root, 'public', 'gallery')
  const collectionSlugs: string[] = []
  const colDir = path.join(galleryDir, 'meta', 'collections')
  if (fs.existsSync(colDir)) {
    for (const ent of fs.readdirSync(colDir, { withFileTypes: true })) {
      if (!ent.isFile() || !ent.name.endsWith('.json')) continue
      try {
        const raw = JSON.parse(
          fs.readFileSync(path.join(colDir, ent.name), 'utf8'),
        ) as unknown
        const doc = parseGalleryCollectionMetaFile(raw)
        if (doc) collectionSlugs.push(doc.slug)
      } catch {
        /* skip */
      }
    }
  }

  const feedItems: BuildFeedItem[] = []
  const metaDir = path.join(galleryDir, 'meta')
  if (fs.existsSync(metaDir)) {
    for (const ent of fs.readdirSync(metaDir, { withFileTypes: true })) {
      if (!ent.isFile() || !ent.name.endsWith('.json')) continue
      const id = ent.name.replace(/\.json$/i, '')
      if (!isValidGalleryImageId(id)) continue
      let raw: unknown
      try {
        raw = JSON.parse(fs.readFileSync(path.join(metaDir, ent.name), 'utf8'))
      } catch {
        continue
      }
      const meta = parseGalleryMetaFile(raw, { expectedId: id })
      if (!meta || meta.hidden) continue
      const file = findImageForId(galleryDir, id)
      if (!file || !isValidGalleryImageBasename(file)) continue
      const thumbPath = path.join(galleryDir, 'thumbs', `${id}.jpg`)
      const feedImageRel = fs.existsSync(thumbPath)
        ? `gallery/thumbs/${id}.jpg`
        : `gallery/${file}`
      feedItems.push({
        file,
        title: meta.title,
        description: meta.description,
        uploadedAt: meta.uploadedAt,
        capturedAt: meta.capturedAt,
        sharePagePath: `share/p/${galleryShareStubId(file)}.html`,
        feedImageRel,
      })
    }
  }

  return { collectionSlugs, feedItems }
}

export function buildSitemapXml(
  siteUrl: string,
  viteBase: string,
  extras: ReturnType<typeof loadGalleryBuildExtras>,
  absolutePublicUrl: (rel: string) => string,
): string {
  const today = new Date().toISOString().slice(0, 10)
  const urls: string[] = []

  const home = absolutePublicUrl('')
  urls.push(`  <url>
    <loc>${escapeXml(home.endsWith('/') ? home : `${home}/`)}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>`)

  for (const slug of extras.collectionSlugs) {
    const loc = new URL(siteUrl.endsWith('/') ? siteUrl : `${siteUrl}/`)
    const pb = viteBase.startsWith('/') ? viteBase : `/${viteBase}`
    const baseSeg = pb === '/' ? '' : pb.replace(/^\/+|\/+$/g, '')
    const pathPart = baseSeg
      ? `/${baseSeg}/?collection=${encodeURIComponent(slug)}`
      : `/?collection=${encodeURIComponent(slug)}`
    const collectionUrl = `${loc.origin}${pathPart}`
    urls.push(`  <url>
    <loc>${escapeXml(collectionUrl)}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`)
  }

  for (const item of extras.feedItems) {
    if (!item.sharePagePath) continue
    const shareUrl = absolutePublicUrl(item.sharePagePath)
    urls.push(`  <url>
    <loc>${escapeXml(shareUrl)}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.5</priority>
  </url>`)
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>
`
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function buildAtomFeed(
  siteTitle: string,
  _siteUrl: string,
  _viteBase: string,
  description: string,
  items: BuildFeedItem[],
  absolutePublicUrl: (rel: string) => string,
): string {
  const home = absolutePublicUrl('')
  const feedUrl = absolutePublicUrl('feed.xml')
  const updated = new Date().toISOString()

  const sorted = [...items].sort((a, b) => {
    const ta = Date.parse(a.uploadedAt ?? a.capturedAt ?? '') || 0
    const tb = Date.parse(b.uploadedAt ?? b.capturedAt ?? '') || 0
    return tb - ta
  })

  const entries = sorted.slice(0, 48).map((item) => {
    const link = item.sharePagePath
      ? absolutePublicUrl(item.sharePagePath)
      : absolutePublicUrl(`gallery/${item.file}`)
    const imageUrl = absolutePublicUrl(item.feedImageRel)
    const pub =
      item.uploadedAt ?? item.capturedAt ?? updated
    const summary = item.description
      ? `<summary>${escapeXml(item.description)}</summary>`
      : ''
    const enclosure = `<link rel="enclosure" type="image/jpeg" href="${escapeXml(imageUrl)}" />`
    const mediaThumb = `<media:thumbnail xmlns:media="http://search.yahoo.com/mrss/" url="${escapeXml(imageUrl)}" />`
    return `  <entry>
    <title>${escapeXml(item.title)}</title>
    <link href="${escapeXml(link)}" />
    <id>${escapeXml(link)}</id>
    <updated>${pub}</updated>
    <published>${pub}</published>
    ${summary}
    ${enclosure}
    ${mediaThumb}
  </entry>`
  })

  return `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xmlns:media="http://search.yahoo.com/mrss/">
  <title>${escapeXml(siteTitle)}</title>
  <subtitle>${escapeXml(description)}</subtitle>
  <link href="${escapeXml(home.endsWith('/') ? home : `${home}/`)}" />
  <link rel="self" href="${escapeXml(feedUrl)}" />
  <id>${escapeXml(home)}</id>
  <updated>${updated}</updated>
${entries.join('\n')}
</feed>
`
}
