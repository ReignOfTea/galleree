export type SocialLink = {
  label: string
  url: string
}

/** What to show in the portfolio header when `logo` is set. Without `logo`, the text title is always shown. */
export type HeaderLayout = 'title' | 'logo' | 'both'

export type SiteConfig = {
  title: string
  tagline?: string
  bio?: string
  /** Label shown above tag filters (default: “Series”) */
  collectionsLabel?: string
  social?: SocialLink[]
  /**
   * Logo image: filename under `public/` (e.g. `logo.svg`) or absolute `https://…` URL.
   * Resolved with the site base path on GitHub Pages.
   */
  logo?: string
  /** Alt text for the logo; defaults to `title`. */
  logoAlt?: string
  /** With `logo`: `title` (text only), `logo` (image only), or `both`. Default: `both`. */
  header?: HeaderLayout
  /** CSS length for `max-height` on the logo (e.g. `"4rem"`, `"72px"`). */
  logoMaxHeight?: string
  /** CSS length or `min()` for `max-width` (e.g. `"min(100%, 40rem)"`). Wide marks often need this. */
  logoMaxWidth?: string
  /** `<html lang>` (BCP 47), e.g. `en` or `en-GB`. */
  lang?: string
  /**
   * Canonical site root URL for OG/Twitter cards, sitemap, and `robots.txt` (include GitHub Pages path).
   * Example: `https://gallery.reignoftea.com` or `https://reignoftea.github.io/galleree`
   */
  siteUrl?: string
  /** Open Graph / Twitter image: path under `public/` or absolute `https://…`. Defaults to first gallery image. */
  ogImage?: string
}

export const DEFAULT_SITE_CONFIG: SiteConfig = {
  title: 'Portfolio',
  tagline: '',
}

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x)
}

function isAllowedUrl(url: string): boolean {
  try {
    const u = new URL(url)
    return ['http:', 'https:', 'mailto:'].includes(u.protocol)
  } catch {
    return false
  }
}

export function normalizeSiteConfig(raw: unknown): SiteConfig {
  if (!isRecord(raw)) return { ...DEFAULT_SITE_CONFIG }

  const title =
    typeof raw.title === 'string' && raw.title.trim()
      ? raw.title.trim()
      : DEFAULT_SITE_CONFIG.title

  const tagline =
    typeof raw.tagline === 'string' ? raw.tagline.trim() : undefined
  const bio = typeof raw.bio === 'string' ? raw.bio.trim() : undefined
  const collectionsLabel =
    typeof raw.collectionsLabel === 'string' && raw.collectionsLabel.trim()
      ? raw.collectionsLabel.trim()
      : undefined

  const logo =
    typeof raw.logo === 'string' && raw.logo.trim() ? raw.logo.trim() : undefined
  const logoAlt =
    typeof raw.logoAlt === 'string' && raw.logoAlt.trim()
      ? raw.logoAlt.trim()
      : undefined

  let header: HeaderLayout | undefined
  if (typeof raw.header === 'string') {
    const h = raw.header.trim().toLowerCase()
    if (h === 'title' || h === 'logo' || h === 'both') header = h
  }

  const logoMaxHeight =
    typeof raw.logoMaxHeight === 'string' && raw.logoMaxHeight.trim()
      ? raw.logoMaxHeight.trim()
      : undefined
  const logoMaxWidth =
    typeof raw.logoMaxWidth === 'string' && raw.logoMaxWidth.trim()
      ? raw.logoMaxWidth.trim()
      : undefined

  const lang =
    typeof raw.lang === 'string' && raw.lang.trim() ? raw.lang.trim() : undefined

  const siteUrl =
    typeof raw.siteUrl === 'string' && raw.siteUrl.trim()
      ? raw.siteUrl.trim()
      : undefined

  const ogImage =
    typeof raw.ogImage === 'string' && raw.ogImage.trim()
      ? raw.ogImage.trim()
      : undefined

  const social: SocialLink[] = []
  if (Array.isArray(raw.social)) {
    for (const item of raw.social) {
      if (!isRecord(item)) continue
      const label = typeof item.label === 'string' ? item.label.trim() : ''
      const url = typeof item.url === 'string' ? item.url.trim() : ''
      if (label && url && isAllowedUrl(url)) social.push({ label, url })
    }
  }

  return {
    title,
    ...(tagline ? { tagline } : {}),
    ...(bio ? { bio } : {}),
    ...(collectionsLabel ? { collectionsLabel } : {}),
    ...(social.length ? { social } : {}),
    ...(logo ? { logo } : {}),
    ...(logoAlt ? { logoAlt } : {}),
    ...(header ? { header } : {}),
    ...(logoMaxHeight ? { logoMaxHeight } : {}),
    ...(logoMaxWidth ? { logoMaxWidth } : {}),
    ...(lang ? { lang } : {}),
    ...(siteUrl ? { siteUrl } : {}),
    ...(ogImage ? { ogImage } : {}),
  }
}

/** Public asset path (`public/logo.svg` → `logo.svg`) or absolute URL → usable `src`. */
export function resolveSiteAssetUrl(path: string): string {
  const t = path.trim()
  if (!t) return ''
  if (/^https?:\/\//i.test(t)) return t
  const base = import.meta.env.BASE_URL
  const prefix = base.endsWith('/') ? base : `${base}/`
  const rel = t.replace(/^\/+/, '')
  return `${prefix}${rel}`
}

export function resolveHeaderPresentation(config: SiteConfig): {
  layout: HeaderLayout
  logoSrc: string
  logoAlt: string
} {
  const logoSrc = config.logo?.trim() ? resolveSiteAssetUrl(config.logo.trim()) : ''
  let layout: HeaderLayout = 'title'
  if (logoSrc) {
    if (config.header === 'title' || config.header === 'logo' || config.header === 'both') {
      layout = config.header
    } else {
      layout = 'both'
    }
  }
  return {
    layout,
    logoSrc,
    logoAlt: config.logoAlt?.trim() || config.title,
  }
}

export function siteJsonHref(): string {
  const base = import.meta.env.BASE_URL
  const normalized = base.endsWith('/') ? base : `${base}/`
  return `${normalized}site.json`
}
