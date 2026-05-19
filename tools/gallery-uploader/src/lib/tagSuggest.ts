export function parseTagList(value: string): string[] {
  return value
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean)
}

/** The tag fragment being edited at `caret` (between commas). */
export function tagFragmentAt(
  value: string,
  caret: number,
): { fragment: string; fragmentStart: number; fragmentEnd: number } {
  const safeCaret = Math.max(0, Math.min(caret, value.length))
  let start = safeCaret
  while (start > 0 && value[start - 1] !== ",") start--
  while (start < value.length && value[start] === " ") start++
  let end = safeCaret
  while (end < value.length && value[end] !== ",") end++
  return {
    fragment: value.slice(start, end),
    fragmentStart: start,
    fragmentEnd: end,
  }
}

export function applySuggestedTag(
  value: string,
  caret: number,
  tag: string,
): { value: string; caret: number } {
  const { fragmentStart, fragmentEnd } = tagFragmentAt(value, caret)
  const before = value.slice(0, fragmentStart)
  const after = value.slice(fragmentEnd).replace(/^,\s*/, "")
  const suffix = after.length > 0 ? after : ""
  const newValue = suffix ? `${before}${tag}, ${suffix}` : `${before}${tag}, `
  const newCaret = before.length + tag.length + 2
  return { value: newValue, caret: newCaret }
}

export function filterTagSuggestions(
  knownTags: readonly string[],
  value: string,
  caret: number,
  limit = 8,
): string[] {
  const { fragment } = tagFragmentAt(value, caret)
  const needle = fragment.trim().toLowerCase()
  const used = new Set(parseTagList(value).map((t) => t.toLowerCase()))
  const out: string[] = []
  for (const tag of knownTags) {
    const key = tag.toLowerCase()
    if (used.has(key)) continue
    if (needle && !key.startsWith(needle)) continue
    out.push(tag)
    if (out.length >= limit) break
  }
  return out
}
