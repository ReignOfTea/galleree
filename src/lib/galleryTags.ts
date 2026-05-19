/** Canonical display form for a user tag (filters and captions). */
export function normalizeGalleryTag(tag: string): string {
  const t = tag.trim()
  if (!t) return t

  const fixes: Record<string, string> = {
    youtuber: 'YouTuber',
    youtube: 'YouTube',
    coe: 'CoE',
    uk: 'UK',
  }
  const lower = t.toLowerCase()
  if (fixes[lower]) return fixes[lower]

  return t.replace(/[\s-]+/g, (sep) => sep).replace(/\b\w+/g, (word) => {
    if (word.toUpperCase() === word && word.length > 1) return word
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
  })
}

/** Normalize tags and drop case-insensitive duplicates. */
export function normalizeGalleryTags(tags: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of tags) {
    const n = normalizeGalleryTag(raw)
    if (!n) continue
    const key = n.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(n)
  }
  return out
}
