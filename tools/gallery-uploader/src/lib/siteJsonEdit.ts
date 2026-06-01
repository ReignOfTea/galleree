import { normalizeSiteConfig, type SiteConfig } from "@galleree/site-config"

const FORM_STRING_KEYS = [
  "kicker",
  "tagline",
  "about",
  "siteUrl",
  "lang",
  "contactEmail",
  "copyright",
] as const satisfies readonly (keyof SiteConfig)[]

/** Apply form fields onto the existing site.json object (keeps social, logo, labels, etc.). */
export function mergeSiteConfigIntoRaw(
  base: Record<string, unknown>,
  draft: SiteConfig,
): Record<string, unknown> {
  const n = normalizeSiteConfig(draft)
  const out: Record<string, unknown> = { ...base, title: n.title }

  for (const key of FORM_STRING_KEYS) {
    const value = n[key]
    if (typeof value === "string" && value.length > 0) {
      out[key] = value
    } else {
      delete out[key]
    }
  }

  if (typeof n.tagline === "string") {
    out.tagline = n.tagline
  }

  return out
}
