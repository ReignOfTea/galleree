import type { UploadRow } from "../types"

function captureSortKey(r: UploadRow): number {
  const iso = r.captureDateTimeIso.trim()
  if (iso) {
    const t = Date.parse(iso)
    if (!Number.isNaN(t)) return t
  }
  const d = r.captureDate.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(d)) {
    const t = Date.parse(`${d}T12:00:00`)
    if (!Number.isNaN(t)) return t
  }
  return Number.POSITIVE_INFINITY
}

/** Oldest capture first; undated rows keep relative order at the end. */
export function sortRowsByCaptureDate(rows: UploadRow[]): UploadRow[] {
  return rows
    .map((row, index) => ({ row, index, key: captureSortKey(row) }))
    .sort((a, b) => {
      if (a.key !== b.key) return a.key - b.key
      return a.index - b.index
    })
    .map((x) => x.row)
}
