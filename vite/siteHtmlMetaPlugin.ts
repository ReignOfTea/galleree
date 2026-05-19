import fs from 'node:fs'
import path from 'node:path'
import type { Plugin } from 'vite'
import {
  buildAtomFeed,
  buildSitemapXml,
  loadGalleryBuildExtras,
} from './galleryBuildExtras'
import { pickOgImageRel } from './ogImagePick'

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

function readSiteJson(root: string): Record<string, unknown> | null {
  try {
    return JSON.parse(
      fs.readFileSync(path.join(root, 'public', 'site.json'), 'utf8'),
    ) as Record<string, unknown>
  } catch {
    return null
  }
}

function siteUrlFromSiteJson(root: string): string | null {
  const site = readSiteJson(root)
  if (!site || typeof site.siteUrl !== 'string') return null
  return normalizeSiteUrl(site.siteUrl)
}

function siteCopyFromJson(root: string): {
  title: string
  description: string
} {
  const site = readSiteJson(root)
  let title = 'Portfolio'
  if (site && typeof site.title === 'string' && site.title.trim()) {
    title = site.title.trim()
  }
  const description = site
    ? metaDescFromSite(site, title, 300)
    : 'Photography portfolio'
  return { title, description }
}

function buildGalleryExtrasArtifacts(
  root: string,
  siteUrl: string,
  viteBase: string,
): {
  robotsTxt: string
  sitemapXml: string
  feedXml: string
  feedLinkHtml: string
} {
  const abs = (rel: string) => absolutePublicUrl(siteUrl, viteBase, rel)
  const extras = loadGalleryBuildExtras(root)
  const { title, description } = siteCopyFromJson(root)

  const rawHome = absolutePublicUrl(siteUrl, viteBase, '')
  const pageUrl = rawHome.endsWith('/') ? rawHome : `${rawHome}/`
  const sitemapUrl = new URL('sitemap.xml', pageUrl).href
  const robotsLines = ['User-agent: *', 'Allow: /', '', `Sitemap: ${sitemapUrl}`]

  const feedLinkHtml = `<link rel="alternate" type="application/atom+xml" title="${escapeHtmlAttr(title)} feed" href="${escapeHtmlAttr(abs('feed.xml'))}" />`

  return {
    robotsTxt: `${robotsLines.join('\n')}\n`,
    sitemapXml: buildSitemapXml(siteUrl, viteBase, extras, abs),
    feedXml: buildAtomFeed(
      title,
      siteUrl,
      viteBase,
      description,
      extras.feedItems,
      abs,
    ),
    feedLinkHtml,
  }
}

/** Path under Vite base, e.g. `/feed.xml` when base is `/`. */
function pathUnderViteBase(pathname: string, viteBase: string): string {
  const basePath = viteBase.replace(/\/$/, '') || ''
  let rel = pathname
  if (basePath && rel.startsWith(basePath)) {
    rel = rel.slice(basePath.length) || '/'
  }
  if (!rel.startsWith('/')) rel = `/${rel}`
  return rel
}

function metaDescFromSite(site: Record<string, unknown>, title: string, max: number): string {
  const tagline = typeof site.tagline === 'string' ? site.tagline.trim() : ''
  const aboutRaw = typeof site.about === 'string' ? site.about.trim() : ''
  const aboutLead = aboutRaw.split(/\n\n+/)[0]?.trim() ?? ''
  const bio = typeof site.bio === 'string' ? site.bio.trim() : ''
  let description = tagline || aboutLead || bio || `${title} — photography portfolio`
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

        ogImageRel = pickOgImageRel(root, site)
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

      const feedPath =
        viteBase === '/' ? '/feed.xml' : `${viteBase.replace(/\/?$/, '')}/feed.xml`
      if (!extra.includes('application/atom+xml')) {
        extra += `\n    <link rel="alternate" type="application/atom+xml" title="${escapeHtmlAttr(title)} feed" href="${escapeHtmlAttr(feedPath)}" />`
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

    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url || !root) return next()
        try {
          const pathname = new URL(req.url, 'http://local').pathname
          const rel = pathUnderViteBase(pathname, viteBase)
          if (rel !== '/feed.xml' && rel !== '/sitemap.xml' && rel !== '/robots.txt') {
            return next()
          }

          const host = req.headers.host
          if (!host) return next()

          const siteUrl =
            siteUrlFromSiteJson(root) ?? normalizeSiteUrl(`http://${host}`)
          if (!siteUrl) return next()

          const artifacts = buildGalleryExtrasArtifacts(root, siteUrl, viteBase)

          if (rel === '/feed.xml') {
            res.statusCode = 200
            res.setHeader('Content-Type', 'application/atom+xml; charset=utf-8')
            res.setHeader('Cache-Control', 'no-cache')
            res.end(artifacts.feedXml)
            return
          }
          if (rel === '/sitemap.xml') {
            res.statusCode = 200
            res.setHeader('Content-Type', 'application/xml; charset=utf-8')
            res.setHeader('Cache-Control', 'no-cache')
            res.end(artifacts.sitemapXml)
            return
          }
          res.statusCode = 200
          res.setHeader('Content-Type', 'text/plain; charset=utf-8')
          res.setHeader('Cache-Control', 'no-cache')
          res.end(artifacts.robotsTxt)
        } catch {
          next()
        }
      })
    },

    writeBundle(bundleOptions) {
      const outDir = bundleOptions.dir
      if (!outDir || !root) return

      const siteUrl = siteUrlFromSiteJson(root)
      if (!siteUrl) {
        fs.writeFileSync(
          path.join(outDir, 'robots.txt'),
          'User-agent: *\nAllow: /\n',
          'utf8',
        )
        return
      }

      const artifacts = buildGalleryExtrasArtifacts(root, siteUrl, viteBase)
      fs.writeFileSync(path.join(outDir, 'robots.txt'), artifacts.robotsTxt, 'utf8')
      fs.writeFileSync(path.join(outDir, 'sitemap.xml'), artifacts.sitemapXml, 'utf8')
      fs.writeFileSync(path.join(outDir, 'feed.xml'), artifacts.feedXml, 'utf8')

      const indexPath = path.join(outDir, 'index.html')
      if (fs.existsSync(indexPath)) {
        let html = fs.readFileSync(indexPath, 'utf8')
        if (!html.includes('application/atom+xml')) {
          html = html.replace('</head>', `    ${artifacts.feedLinkHtml}\n  </head>`)
          fs.writeFileSync(indexPath, html, 'utf8')
        }
      }
    },
  }
}
