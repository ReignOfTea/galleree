import fs from 'node:fs'
import path from 'node:path'
import type { Plugin } from 'vite'

const IMAGE_EXT = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.avif',
  '.gif',
])

function readFirstGalleryFile(root: string): string | null {
  const galleryDir = path.join(root, 'public', 'gallery')
  if (!fs.existsSync(galleryDir)) return null

  const names = fs
    .readdirSync(galleryDir)
    .filter((name) => IMAGE_EXT.has(path.extname(name).toLowerCase()))
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))

  return names[0] ?? null
}

function escapeHtmlAttr(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
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

/**
 * Absolute URL for a file under `public/` (e.g. `gallery/x.jpg`).
 * `siteUrl` is the deployed site root (e.g. `https://reignoftea.github.io/galleree`).
 */
function absolutePublicUrl(
  siteUrl: string,
  viteBase: string,
  publicRelative: string,
): string {
  const root = new URL(siteUrl.endsWith('/') ? siteUrl : `${siteUrl}/`)
  const pb = viteBase.startsWith('/') ? viteBase : `/${viteBase}`
  const baseSeg =
    pb === '/' ? '' : pb.replace(/^\/+|\/+$/g, '')
  const rel = publicRelative.replace(/^\/+/, '')

  if (!baseSeg) {
    return `${root.origin}/${rel}`
  }
  return `${root.origin}/${baseSeg}/${rel}`
}

function metaDescFromSite(site: Record<string, unknown>, title: string, max: number): string {
  const tagline = typeof site.tagline === 'string' ? site.tagline.trim() : ''
  const bio = typeof site.bio === 'string' ? site.bio.trim() : ''
  let description = tagline || bio || `${title} — photography portfolio`
  if (description.length > max) {
    description = `${description.slice(0, max - 1)}…`
  }
  return description
}

export type SiteHtmlMetaPluginOptions = {
  /** Vite `base`, e.g. `/` or `/repo/` */
  base: string
}

export function siteHtmlMetaPlugin(options: SiteHtmlMetaPluginOptions): Plugin {
  const viteBase = options.base ?? '/'
  let root = ''

  return {
    name: 'galleree-site-html-meta',

    configResolved(config) {
      root = config.root
    },

    transformIndexHtml(html) {
      const sitePath = path.join(root, 'public', 'site.json')
      let title = 'Portfolio'
      let description = 'Photography portfolio'
      let siteUrl: string | null = null
      let lang = 'en'
      let ogImageRel: string | null = null

      try {
        const raw = fs.readFileSync(sitePath, 'utf8')
        const site = JSON.parse(raw) as Record<string, unknown>

        if (typeof site.title === 'string' && site.title.trim()) {
          title = site.title.trim()
        }
        description = metaDescFromSite(site, title, 160)

        if (typeof site.lang === 'string' && site.lang.trim()) {
          lang = site.lang.trim()
        }

        if (typeof site.siteUrl === 'string') {
          siteUrl = normalizeSiteUrl(site.siteUrl)
        }

        if (typeof site.ogImage === 'string' && site.ogImage.trim()) {
          ogImageRel = site.ogImage.trim().replace(/^\/+/, '')
        } else if (
          typeof site.logo === 'string' &&
          site.logo.trim()
        ) {
          ogImageRel = site.logo.trim().replace(/^\/+/, '')
        } else {
          const first = readFirstGalleryFile(root)
          if (first) ogImageRel = `gallery/${first}`
        }
      } catch {
        /* defaults */
      }

      const titleHtml = `<title>${escapeHtmlAttr(title)}</title>`
      const descHtml = `<meta name="description" content="${escapeHtmlAttr(description)}" />`

      let extra = ''

      let ogImageAbsolute = ''

      if (siteUrl) {
        const rawHome = absolutePublicUrl(siteUrl, viteBase, '')
        const pageUrl = rawHome.endsWith('/') ? rawHome : `${rawHome}/`
        const canonical = `<link rel="canonical" href="${escapeHtmlAttr(pageUrl)}" />`

        if (ogImageRel) {
          ogImageAbsolute = absolutePublicUrl(siteUrl, viteBase, ogImageRel)
        }

        extra += `\n    ${canonical}`
        extra += `\n    <meta property="og:title" content="${escapeHtmlAttr(title)}" />`
        extra += `\n    <meta property="og:description" content="${escapeHtmlAttr(description)}" />`
        extra += `\n    <meta property="og:type" content="website" />`
        extra += `\n    <meta property="og:url" content="${escapeHtmlAttr(pageUrl)}" />`
        if (ogImageAbsolute) {
          extra += `\n    <meta property="og:image" content="${escapeHtmlAttr(ogImageAbsolute)}" />`
        }
        extra += `\n    <meta name="twitter:card" content="summary_large_image" />`
        extra += `\n    <meta name="twitter:title" content="${escapeHtmlAttr(title)}" />`
        extra += `\n    <meta name="twitter:description" content="${escapeHtmlAttr(description)}" />`
        if (ogImageAbsolute) {
          extra += `\n    <meta name="twitter:image" content="${escapeHtmlAttr(ogImageAbsolute)}" />`
        }

        const ld = {
          '@context': 'https://schema.org',
          '@type': 'WebSite',
          name: title,
          description,
          url: pageUrl,
        }
        extra += `\n    <script type="application/ld+json">${JSON.stringify(ld)}</script>`
      } else {
        extra += `\n    <meta name="twitter:card" content="summary" />`
        extra += `\n    <meta name="twitter:title" content="${escapeHtmlAttr(title)}" />`
        extra += `\n    <meta name="twitter:description" content="${escapeHtmlAttr(description)}" />`
      }

      const htmlLang = escapeHtmlAttr(lang)
      const htmlOut = html.replace(/<html lang="[^"]*"/, `<html lang="${htmlLang}"`)

      return htmlOut
        .replace(/<title>[\s\S]*?<\/title>/, titleHtml)
        .replace(
          /<meta name="description" content="[^"]*" *\/?>/,
          `${descHtml}${extra}`,
        )
    },

    writeBundle(bundleOptions) {
      const outDir = bundleOptions.dir
      if (!outDir || !root) return

      let siteUrl: string | null = null
      try {
        const raw = fs.readFileSync(path.join(root, 'public', 'site.json'), 'utf8')
        const site = JSON.parse(raw) as Record<string, unknown>
        if (typeof site.siteUrl === 'string') {
          siteUrl = normalizeSiteUrl(site.siteUrl)
        }
      } catch {
        /* ignore */
      }

      const robotsLines = ['User-agent: *', 'Allow: /']
      if (siteUrl) {
        const rawHome = absolutePublicUrl(siteUrl, viteBase, '')
        const pageUrl = rawHome.endsWith('/') ? rawHome : `${rawHome}/`
        const sitemapUrl = new URL('sitemap.xml', pageUrl).href
        robotsLines.push('', `Sitemap: ${sitemapUrl}`)
      }
      fs.writeFileSync(path.join(outDir, 'robots.txt'), `${robotsLines.join('\n')}\n`, 'utf8')

      if (siteUrl) {
        const rawHome = absolutePublicUrl(siteUrl, viteBase, '')
        const loc = rawHome.endsWith('/') ? rawHome : `${rawHome}/`
        const today = new Date().toISOString().slice(0, 10)
        const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${escapeXml(loc)}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>
`
        fs.writeFileSync(path.join(outDir, 'sitemap.xml'), sitemap, 'utf8')
      }
    },
  }
}
