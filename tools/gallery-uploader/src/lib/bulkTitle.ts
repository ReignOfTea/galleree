import { fileBaseName } from "./titleFromFilename"
import type { UploadRow } from "../types"

const CAMERA_PREFIX_RE =
  /^(DSC[_-]?|IMG[_-]?|_?MG[_-]?|P\d{7}|GH\d{2}|GOPR\d{4}|DJI[_-]?|SAM[_-]?|PA\d{6}|DSCN\d{4})/i

export type BulkTitleMode =
  | { kind: "prefix"; text: string }
  | { kind: "suffix"; text: string }
  | { kind: "stripCameraPrefix" }
  | { kind: "number"; start: number; pad: number }

export function applyBulkTitle(row: UploadRow, mode: BulkTitleMode): string {
  let title = row.title.trim()
  if (!title) {
    title = fileBaseName(row.sourcePath)
  }

  switch (mode.kind) {
    case "prefix":
      return mode.text ? `${mode.text}${title}` : title
    case "suffix":
      return mode.text ? `${title}${mode.text}` : title
    case "stripCameraPrefix":
      return title.replace(CAMERA_PREFIX_RE, "").trim() || title
    case "number":
      return title
    default:
      return title
  }
}

export function applyBulkTitlesToRows(
  rows: UploadRow[],
  scopeIds: ReadonlySet<string> | null,
  mode: BulkTitleMode,
): UploadRow[] {
  let counter = mode.kind === "number" ? mode.start : 0
  return rows.map((r) => {
    const inScope = !scopeIds || scopeIds.size === 0 || scopeIds.has(r.id)
    if (!inScope) return r

    if (mode.kind === "number") {
      const pad = Math.max(0, mode.pad)
      const num = String(counter).padStart(pad, "0")
      counter += 1
      const base = applyBulkTitle(r, { kind: "stripCameraPrefix" })
      return { ...r, title: `${base} ${num}`.trim() }
    }

    return { ...r, title: applyBulkTitle(r, mode) }
  })
}
