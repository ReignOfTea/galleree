export type ViewMode = "accordion" | "compact"

export function jumpToNextMissingTitle(
  rows: { id: string; title: string }[],
  panelRefs: ReadonlyMap<string, HTMLElement>,
  startAfterId?: string,
): string | null {
  const missing = rows.filter((r) => !r.title.trim())
  if (missing.length === 0) return null

  let startIdx = 0
  if (startAfterId) {
    const cur = missing.findIndex((r) => r.id === startAfterId)
    startIdx = cur >= 0 ? (cur + 1) % missing.length : 0
  }

  for (let i = 0; i < missing.length; i += 1) {
    const row = missing[(startIdx + i) % missing.length]
    const el = panelRefs.get(row.id)
    if (!el) continue

    const details = el.closest("details")
    if (details) details.open = true

    el.scrollIntoView({ behavior: "smooth", block: "center" })
    const input = el.querySelector<HTMLInputElement>(
      'input[placeholder*="Title"], input.photo-table__title, .field--warn input',
    )
    input?.focus()
    return row.id
  }
  return missing[0]?.id ?? null
}
