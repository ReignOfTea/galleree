const ALLOWED_EXT = new Set([".jpg", ".jpeg", ".png", ".webp", ".avif", ".gif"])

export function isAllowedImagePath(filePath: string): boolean {
  const lower = filePath.toLowerCase()
  const dot = lower.lastIndexOf(".")
  if (dot < 0) return false
  return ALLOWED_EXT.has(lower.slice(dot))
}

export function normalizeExtensionFromPath(filePath: string): string {
  const lower = filePath.toLowerCase()
  const dot = lower.lastIndexOf(".")
  const ext = dot >= 0 ? lower.slice(dot) : ".jpg"
  return ALLOWED_EXT.has(ext) ? ext : ".jpg"
}

export function displayToSlug(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
}

export function buildLocSegment(locationDisplay: string): string | null {
  const t = locationDisplay.trim()
  if (!t) return null
  const comma = t.indexOf(",")
  if (comma > 0) {
    const city = t.slice(0, comma).trim()
    const country = t.slice(comma + 1).trim().replace(/\s+/g, "")
    if (!city || !country) return null
    const citySlug = displayToSlug(city)
    if (!citySlug) return null
    return `loc-${citySlug}-${country.toUpperCase()}`
  }
  const lastSpace = t.lastIndexOf(" ")
  if (lastSpace > 0) {
    const city = t.slice(0, lastSpace).trim()
    const cc = t.slice(lastSpace + 1).trim()
    if (!city || !cc) return null
    const citySlug = displayToSlug(city)
    if (!citySlug) return null
    if (/^[A-Za-z]{2,3}$/.test(cc)) {
      return `loc-${citySlug}-${cc.toUpperCase()}`
    }
  }
  return null
}

export type GalleryFilenameInput = {
  title: string
  tags: string[]
  location: string
  capturedAt: Date | null
  dateOnly: boolean
  camera: string
  event: string
}

/**
 * Builds a gallery filename matching `src/lib/filenameMeta.ts` structured convention
 * (`tags-…` segment required — we always emit `tags-…`).
 */
export function buildGalleryFilename(
  fields: GalleryFilenameInput,
  extensionWithDot: string,
): string {
  const extRaw = extensionWithDot.startsWith(".")
    ? extensionWithDot.slice(1).toLowerCase()
    : extensionWithDot.toLowerCase()

  let titleSlug = displayToSlug(fields.title)
  if (!titleSlug) titleSlug = "untitled"

  let tagSlugs = fields.tags.map((x) => displayToSlug(x)).filter(Boolean)
  if (tagSlugs.length === 0) tagSlugs = [titleSlug]
  else {
    // Stable filename: same tag set must not change order with comma entry order (avoids duplicate uploads).
    tagSlugs = [...new Set(tagSlugs)].sort((a, b) => a.localeCompare(b, "en"))
  }

  const parts: string[] = [titleSlug, `tags-${tagSlugs.join("--")}`]

  const loc = fields.location.trim()
    ? buildLocSegment(fields.location)
    : null
  if (loc) parts.push(loc)

  if (fields.capturedAt) {
    const d = fields.capturedAt
    const y = d.getFullYear()
    const mo = String(d.getMonth() + 1).padStart(2, "0")
    const day = String(d.getDate()).padStart(2, "0")
    if (fields.dateOnly) {
      parts.push(`dt-${y}${mo}${day}`)
    } else {
      const hh = String(d.getHours()).padStart(2, "0")
      const mm = String(d.getMinutes()).padStart(2, "0")
      const ss = String(d.getSeconds()).padStart(2, "0")
      parts.push(`dt-${y}${mo}${day}-${hh}${mm}${ss}`)
    }
  }

  const cam = fields.camera.trim()
  if (cam) parts.push(`cam-${displayToSlug(cam)}`)

  const evt = fields.event.trim()
  if (evt) parts.push(`evt-${displayToSlug(evt)}`)

  return `${parts.join("_")}.${extRaw}`
}
