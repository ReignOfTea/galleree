/** Basename without extension. */
export function fileBaseName(path: string): string {
  const s = path.replace(/\\/g, "/")
  const name = s.slice(s.lastIndexOf("/") + 1)
  const dot = name.lastIndexOf(".")
  return dot > 0 ? name.slice(0, dot) : name
}

/** Human-ish title from `IMG_1234-edit_final.jpg` → `Img 1234 Edit Final`. */
export function titleFromFilename(path: string): string {
  const stem = fileBaseName(path)
  const words = stem
    .replace(/[_+.]+/g, " ")
    .replace(/-/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .split(/\s+/)
    .filter(Boolean)
  if (words.length === 0) return stem
  return words
    .map((w) => {
      if (/^\d+$/.test(w)) return w
      const lower = w.toLowerCase()
      return lower.charAt(0).toUpperCase() + lower.slice(1)
    })
    .join(" ")
}
