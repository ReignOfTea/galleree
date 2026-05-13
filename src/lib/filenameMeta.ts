/**
 * Filename convention (no sidecar metadata):
 *
 * **Structured** — underscore-separated segments. Detected when `tags-…` is present.
 *
 * Canonical order (flexible; parsing matches by prefix):
 * `{titleSlug}_tags-{tag1}--{tag2}_loc-{CitySlug}-{CC}_dt-{…}_cam-{slug}_evt-{slug}`
 *
 * - **titleSlug**: first segment without a known prefix; hyphens → spaces, words title-cased (e.g. `evening-rush` → "Evening Rush").
 * - **tags**: `tags-` then tags separated by `--`; words inside a tag use single hyphens (`urban--new-york-city` → Urban, New York City). The uploader sorts tag slugs alphabetically so the same tag set always yields one filename.
 * - **loc**: `loc-{citySlug}-{CC}` → "City, CC" (preferred). **`loc-{citySlug},{CC}`** is still parsed for older files (e.g. `loc-Bury,UK`).
 * - **dt**: optional — `dt-YYYYMMDD` (local calendar date, stored as local midnight; no time-of-day in the filename).
 *   **Legacy:** older files may still use `dt-YYYYMMDD-HHmmss` (local wall time); the site still parses those for sort and display.
 * - **cam** / **evt**: optional camera or event label slugs.
 * - **seq-…** (legacy): if still present in old files, the segment is skipped and not shown; sort order uses capture date when present.
 *
 * Example:
 * `evening-rush_tags-urban--night_loc-Bury-UK_dt-20240510_cam-fuji-x100v.jpg`
 *
 * **Legacy** — any filename that does not match structured detection; underscore segments become tags,
 * optional `loc-…`, numeric segments skipped (existing behaviour).
 */

function stripExtension(filename: string): string {
  const dot = filename.lastIndexOf('.')
  return dot > 0 ? filename.slice(0, dot) : filename
}

function isNumericSegment(segment: string): boolean {
  return segment !== '' && /^\d+$/.test(segment)
}

function titleCaseWord(segment: string): string {
  if (!segment) return segment
  return segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase()
}

/** `new-york` → "New York" */
function formatLocationCitySlug(slug: string): string {
  return slug
    .split('-')
    .filter(Boolean)
    .map(titleCaseWord)
    .join(' ')
}

/** Slug with hyphens between words → Title Case phrase */
function slugToDisplayTitle(slug: string): string {
  return slug
    .split('-')
    .filter(Boolean)
    .map(titleCaseWord)
    .join(' ')
}

const LOC_SEGMENT = /^loc-(.+)$/i

function parseLocSegment(seg: string): string | null {
  const locMatch = seg.match(LOC_SEGMENT)
  if (!locMatch) return null
  const inner = locMatch[1]

  const commaIdx = inner.indexOf(',')
  if (commaIdx > 0 && commaIdx < inner.length - 1) {
    const citySlug = inner.slice(0, commaIdx).trim()
    const country = inner.slice(commaIdx + 1).trim()
    const cityDisplay = formatLocationCitySlug(citySlug).trim()
    if (!cityDisplay || !country) return null
    return `${cityDisplay}, ${country.toUpperCase()}`
  }

  const splitAt = inner.lastIndexOf('-')
  if (splitAt <= 0) return null
  const citySlug = inner.slice(0, splitAt)
  const country = inner.slice(splitAt + 1).trim()
  const cityDisplay = formatLocationCitySlug(citySlug).trim()
  if (!cityDisplay || !country) return null
  return `${cityDisplay}, ${country.toUpperCase()}`
}

function isStructuredStem(segments: string[]): boolean {
  return segments.some((s) => s.toLowerCase().startsWith('tags-'))
}

/** `dt-YYYYMMDD` (date-only) or legacy `dt-YYYYMMDD-HHmmss`. */
function parseDtPayload(payload: string): {
  capturedAt: number
  dateOnly: boolean
} | null {
  const full = payload.match(/^(\d{8})-(\d{6})$/)
  if (full) {
    const ds = full[1]
    const ts = full[2]
    const y = +ds.slice(0, 4)
    const mo = +ds.slice(4, 6)
    const d = +ds.slice(6, 8)
    const hh = +ts.slice(0, 2)
    const mm = +ts.slice(2, 4)
    const ss = +ts.slice(4, 6)
    return {
      capturedAt: new Date(y, mo - 1, d, hh, mm, ss).getTime(),
      dateOnly: false,
    }
  }
  const day = payload.match(/^(\d{8})$/)
  if (day) {
    const ds = day[1]
    const y = +ds.slice(0, 4)
    const mo = +ds.slice(4, 6)
    const d = +ds.slice(6, 8)
    return {
      capturedAt: new Date(y, mo - 1, d, 0, 0, 0).getTime(),
      dateOnly: true,
    }
  }
  return null
}

export type FilenameMeta = {
  tags: string[]
  /** From `loc-City-Country`, shown as "City, CC" */
  locationDisplay: string | null
  /** From structured title slug */
  displayTitle: string | null
  /** Local midnight of capture calendar day, or legacy local wall time */
  capturedAt: number | null
  /** True when `dt-…` was date-only (`dt-YYYYMMDD`); UI formats without time-of-day. False for legacy `…-HHmmss`. */
  capturedAtIsDateOnly: boolean
  cameraLabel: string | null
  eventLabel: string | null
  parseMode: 'structured' | 'legacy'
}

function parseStructuredStem(segments: string[]): FilenameMeta {
  let titleSlug: string | null = null
  let tagsPayload: string | null = null
  let locationDisplay: string | null = null
  let capturedAt: number | null = null
  let capturedAtIsDateOnly = false
  let cameraLabel: string | null = null
  let eventLabel: string | null = null

  for (const seg of segments) {
    const lower = seg.toLowerCase()
    if (lower.startsWith('tags-')) {
      tagsPayload = seg.slice('tags-'.length)
      continue
    }
    if (lower.startsWith('loc-')) {
      locationDisplay = parseLocSegment(seg)
      continue
    }
    if (lower.startsWith('dt-')) {
      const payload = seg.slice('dt-'.length)
      const parsed = parseDtPayload(payload)
      if (parsed) {
        capturedAt = parsed.capturedAt
        capturedAtIsDateOnly = parsed.dateOnly
      }
      continue
    }
    if (lower.startsWith('seq-')) {
      continue
    }
    if (lower.startsWith('cam-')) {
      cameraLabel = slugToDisplayTitle(seg.slice('cam-'.length))
      continue
    }
    if (lower.startsWith('evt-')) {
      eventLabel = slugToDisplayTitle(seg.slice('evt-'.length))
      continue
    }
    if (titleSlug === null) titleSlug = seg
  }

  const tagParts: string[] = []
  if (tagsPayload !== null && tagsPayload.length > 0) {
    for (const raw of tagsPayload.split('--')) {
      if (raw) tagParts.push(slugToDisplayTitle(raw))
    }
  }

  const tags = [...new Set([...tagParts, ...(locationDisplay ? [locationDisplay] : [])])]

  return {
    tags,
    locationDisplay,
    displayTitle: titleSlug ? slugToDisplayTitle(titleSlug) : null,
    capturedAt,
    capturedAtIsDateOnly,
    cameraLabel,
    eventLabel,
    parseMode: 'structured',
  }
}

function parseLegacyStem(segments: string[]): Omit<FilenameMeta, 'parseMode'> {
  const wordTags: string[] = []
  let locationDisplay: string | null = null

  for (const seg of segments) {
    if (isNumericSegment(seg)) continue

    const locMatch = seg.match(LOC_SEGMENT)
    if (locMatch) {
      locationDisplay = parseLocSegment(seg)
      continue
    }

    wordTags.push(titleCaseWord(seg))
  }

  const tags = [...new Set([...wordTags, ...(locationDisplay ? [locationDisplay] : [])])]

  return {
    tags,
    locationDisplay,
    displayTitle: null,
    capturedAt: null,
    capturedAtIsDateOnly: false,
    cameraLabel: null,
    eventLabel: null,
  }
}

/**
 * Parse gallery image metadata from `filename` (basename or path).
 * Structured convention when `tags-…` appears; otherwise legacy rules apply.
 */
export function parseFilenameMeta(filename: string): FilenameMeta {
  const baseName = stripExtension(filename.split(/[/\\]/).pop() ?? '')
  const segments = baseName.split('_').filter(Boolean)

  if (isStructuredStem(segments)) {
    return parseStructuredStem(segments)
  }

  const legacy = parseLegacyStem(segments)
  return { ...legacy, parseMode: 'legacy' }
}
