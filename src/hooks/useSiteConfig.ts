import { useEffect, useState } from 'react'
import {
  aboutLeadText,
  normalizeSiteConfig,
  siteJsonHref,
  type SiteConfig,
} from '../lib/siteConfig'
import { BOOTSTRAP_SITE_CONFIG } from '../lib/siteBootstrap'

export function useSiteConfig(): SiteConfig {
  const [config, setConfig] = useState<SiteConfig>(BOOTSTRAP_SITE_CONFIG)

  useEffect(() => {
    let cancelled = false

    ;(async () => {
      try {
        const res = await fetch(siteJsonHref(), { cache: 'no-store' })
        if (!res.ok || cancelled) return
        const raw: unknown = await res.json()
        if (!cancelled) setConfig(normalizeSiteConfig(raw))
      } catch {
        /* keep bootstrap */
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    document.documentElement.lang = config.lang ?? 'en'
  }, [config.lang])

  useEffect(() => {
    document.title = config.title

    let meta = document.querySelector<HTMLMetaElement>(
      'meta[name="description"]',
    )
    if (!meta) {
      meta = document.createElement('meta')
      meta.setAttribute('name', 'description')
      document.head.appendChild(meta)
    }
    const description = [config.tagline, aboutLeadText(config.about)]
      .filter(Boolean)
      .join(' · ')
    meta.setAttribute('content', description || config.title)
  }, [config])

  return config
}
