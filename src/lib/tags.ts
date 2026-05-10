function stripExtension(filename: string): string {
  const dot = filename.lastIndexOf('.')
  return dot > 0 ? filename.slice(0, dot) : filename
}

function isNumericSegment(segment: string): boolean {
  return segment !== '' && /^\d+$/.test(segment)
}

function titleCaseTag(segment: string): string {
  if (!segment) return segment
  return segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase()
}

/** `new-york` → "New York" */
function formatLocationCitySlug(slug: string): string {
  return slug
    .split('-')
    .filter(Boolean)
    .map(titleCaseTag)
    .join(' ')
}

const LOC_SEGMENT = /^loc-(.+)$/i

export type FilenameMeta = {
  tags: string[]
  /** From `loc-City-Country`, shown as "City, CC" (e.g. Bury, UK). */
  locationDisplay: string | null
}

/**
 * Underscore-separated stem segments become tags; numeric segments are skipped.
 * A segment `loc-City-Country` yields location "City, COUNTRY" (hyphens in city → spaces)
 * and adds one tag equal to that string; the raw `loc-…` segment is not split into extra tags.
 *
 * Example: `car_museum_flowers_loc-Bury-UK_01.jpg` → tags Car, Museum, Flowers, Bury, UK;
 * locationDisplay `"Bury, UK"`.
 */
export function parseFilenameMeta(filename: string): FilenameMeta {
  const baseName = stripExtension(filename.split(/[/\\]/).pop() ?? '')
  const segments = baseName.split('_').filter(Boolean)

  const wordTags: string[] = []
  let locationDisplay: string | null = null

  for (const seg of segments) {
    if (isNumericSegment(seg)) continue

    const locMatch = seg.match(LOC_SEGMENT)
    if (locMatch) {
      const inner = locMatch[1]
      const splitAt = inner.lastIndexOf('-')
      if (splitAt > 0) {
        const citySlug = inner.slice(0, splitAt)
        const country = inner.slice(splitAt + 1).trim()
        const cityDisplay = formatLocationCitySlug(citySlug).trim()
        if (cityDisplay && country) {
          locationDisplay = `${cityDisplay}, ${country.toUpperCase()}`
        }
      }
      continue
    }

    wordTags.push(titleCaseTag(seg))
  }

  const tags = [...new Set([...wordTags, ...(locationDisplay ? [locationDisplay] : [])])]

  return { tags, locationDisplay }
}
