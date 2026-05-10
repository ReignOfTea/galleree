import fs from 'node:fs'
import path from 'node:path'
import { parseFilenameMeta } from '../src/lib/filenameMeta'

function escapeHtmlAttr(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
}

function normalizeSiteUrl(raw: string): string | null {
  const t = raw.trim()
  if (!t) return null
  try {
    const u = new URL(t)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
    return u.href.replace(/\/+$/, '')
  } catch {
    return null
  }
}

export function absolutePublicUrl(
  siteUrl: string,
  viteBase: string,
  publicRelative: string,
): string {
  const root = new URL(siteUrl.endsWith('/') ? siteUrl : `${siteUrl}/`)
  const pb = viteBase.startsWith('/') ? viteBase : `/${viteBase}`
  const baseSeg = pb === '/' ? '' : pb.replace(/^\/+|\/+$/g, '')
  const segments = publicRelative
    .replace(/^\/+/, '')
    .split('/')
    .filter(Boolean)
    .map(encodeURIComponent)
    .join('/')

  if (!baseSeg) {
    return `${root.origin}/${segments}`
  }
  return `${root.origin}/${baseSeg}/${segments}`
}

function metaDesc(site: Record<string, unknown>, title: string, max: number): string {
  const tagline = typeof site.tagline === 'string' ? site.tagline.trim() : ''
  const bio = typeof site.bio === 'string' ? site.bio.trim() : ''
  let description = tagline || bio || `${title} — photography`
  if (description.length > max) {
    description = `${description.slice(0, max - 1)}…`
  }
  return description
}

export type GalleryShareHtmlParams = {
  file: string
  stubId: string
  siteUrl: string
  viteBase: string
  siteTitle: string
  description: string
  htmlLang: string
}

/** Static HTML for crawlers (Discord, Slack, etc.) — hash `#photo=` is invisible to servers. */
export function renderGallerySharePageHtml(p: GalleryShareHtmlParams): string {
  const { file, stubId, siteUrl, viteBase, siteTitle, description, htmlLang } = p

  const meta = parseFilenameMeta(file)
  const ogTitle = meta.displayTitle
    ? `${meta.displayTitle} — ${siteTitle}`
    : siteTitle

  const shareRelPath = `share/p/${stubId}.html`
  const sharePageAbs = absolutePublicUrl(siteUrl, viteBase, shareRelPath)
  const imageAbs = absolutePublicUrl(siteUrl, viteBase, `gallery/${file}`)

  const rawHome = absolutePublicUrl(siteUrl, viteBase, '')
  const homeBase = rawHome.endsWith('/') ? rawHome : `${rawHome}/`
  const redirectTarget = `${homeBase}?photo=${encodeURIComponent(file)}`

  return `<!DOCTYPE html>
<html lang="${escapeHtmlAttr(htmlLang)}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtmlAttr(ogTitle)}</title>
  <meta name="description" content="${escapeHtmlAttr(description)}" />
  <meta name="robots" content="noindex,nofollow" />
  <link rel="canonical" href="${escapeHtmlAttr(sharePageAbs)}" />
  <meta property="og:title" content="${escapeHtmlAttr(ogTitle)}" />
  <meta property="og:description" content="${escapeHtmlAttr(description)}" />
  <meta property="og:type" content="article" />
  <meta property="og:url" content="${escapeHtmlAttr(sharePageAbs)}" />
  <meta property="og:image" content="${escapeHtmlAttr(imageAbs)}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtmlAttr(ogTitle)}" />
  <meta name="twitter:description" content="${escapeHtmlAttr(description)}" />
  <meta name="twitter:image" content="${escapeHtmlAttr(imageAbs)}" />
  <meta http-equiv="refresh" content="0;url=${escapeHtmlAttr(redirectTarget)}" />
</head>
<body>
  <p><a href="${escapeHtmlAttr(redirectTarget)}">Open photo</a></p>
</body>
</html>
`
}

export function loadSiteForShare(root: string): {
  siteUrl: string | null
  siteTitle: string
  description: string
  htmlLang: string
} {
  const sitePath = path.join(root, 'public', 'site.json')
  let siteTitle = 'Portfolio'
  let description = 'Photography portfolio'
  let siteUrl: string | null = null

  let htmlLang = 'en'
  try {
    const raw = fs.readFileSync(sitePath, 'utf8')
    const site = JSON.parse(raw) as Record<string, unknown>
    if (typeof site.title === 'string' && site.title.trim()) {
      siteTitle = site.title.trim()
    }
    description = metaDesc(site, siteTitle, 160)
    if (typeof site.siteUrl === 'string') {
      siteUrl = normalizeSiteUrl(site.siteUrl)
    }
    if (typeof site.lang === 'string' && site.lang.trim()) {
      htmlLang = site.lang.trim()
    }
  } catch {
    /* defaults */
  }

  return { siteUrl, siteTitle, description, htmlLang }
}
