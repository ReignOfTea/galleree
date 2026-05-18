import siteJson from '../../public/site.json'
import { normalizeSiteConfig, type SiteConfig } from './siteConfig'

/** Bundled `public/site.json` — avoids a flash of generic defaults before fetch. */
export const BOOTSTRAP_SITE_CONFIG: SiteConfig = normalizeSiteConfig(siteJson)
