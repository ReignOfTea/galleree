import { normalizeSiteConfig } from "@galleree/site-config"
import { appInvoke } from "../tauriBridge"

/** Footer `copyright` from `public/site.json` in the gallery project clone. */
export async function fetchSiteCopyrightDefault(): Promise<string> {
  try {
    const raw = await appInvoke<string>("read_site_json")
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
      return normalizeSiteConfig(parsed as Record<string, unknown>).copyright?.trim() ?? ""
    }
  } catch {
    /* clone not ready or site.json missing */
  }
  return ""
}
