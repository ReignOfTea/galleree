import { absolutePublicUrl } from './galleryShareHtml'

function escapeHtmlAttr(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
}

export type GalleryCollectionHtmlParams = {
  slug: string
  title: string
  description: string | null
  siteUrl: string
  viteBase: string
  siteTitle: string
  siteDescription: string
  htmlLang: string
  coverImageRel: string | null
}

export function renderGalleryCollectionPageHtml(
  p: GalleryCollectionHtmlParams,
): string {
  const {
    slug,
    title,
    description,
    siteUrl,
    viteBase,
    siteTitle,
    siteDescription,
    htmlLang,
    coverImageRel,
  } = p

  const pageRel = `share/c/${slug}.html`
  const pageAbs = absolutePublicUrl(siteUrl, viteBase, pageRel)
  const ogTitle = `${title} — ${siteTitle}`
  const ogDescription =
    (description?.trim() || siteDescription).slice(0, 300) || siteDescription
  const imageAbs = coverImageRel
    ? absolutePublicUrl(siteUrl, viteBase, coverImageRel)
    : absolutePublicUrl(siteUrl, viteBase, '')

  const rawHome = absolutePublicUrl(siteUrl, viteBase, '')
  const homeBase = rawHome.endsWith('/') ? rawHome : `${rawHome}/`
  const redirectTarget = `${homeBase}?collection=${encodeURIComponent(slug)}`

  return `<!DOCTYPE html>
<html lang="${escapeHtmlAttr(htmlLang)}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtmlAttr(ogTitle)}</title>
  <meta name="description" content="${escapeHtmlAttr(ogDescription)}" />
  <link rel="canonical" href="${escapeHtmlAttr(pageAbs)}" />
  <meta property="og:title" content="${escapeHtmlAttr(ogTitle)}" />
  <meta property="og:description" content="${escapeHtmlAttr(ogDescription)}" />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="${escapeHtmlAttr(pageAbs)}" />
  <meta property="og:image" content="${escapeHtmlAttr(imageAbs)}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtmlAttr(ogTitle)}" />
  <meta name="twitter:description" content="${escapeHtmlAttr(ogDescription)}" />
  <meta name="twitter:image" content="${escapeHtmlAttr(imageAbs)}" />
  <meta http-equiv="refresh" content="0;url=${escapeHtmlAttr(redirectTarget)}" />
</head>
<body>
  <p><a href="${escapeHtmlAttr(redirectTarget)}">Open collection: ${escapeHtmlAttr(title)}</a></p>
</body>
</html>
`
}
