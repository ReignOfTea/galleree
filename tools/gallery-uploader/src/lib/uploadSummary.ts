import { SELECT_NONE } from "../registryTypes"
import type { GalleryRegistries } from "../registryTypes"
import type { UploadRow } from "../types"

export type UploadSummary = {
  total: number
  titled: number
  hidden: number
  visible: number
  collectionLabel: string | null
  collectionsUsed: string[]
}

export function buildUploadSummary(
  rows: UploadRow[],
  registries: GalleryRegistries,
): UploadSummary {
  const titled = rows.filter((r) => r.title.trim().length > 0).length
  const hidden = rows.filter((r) => r.hidden).length
  const collectionSlugs = new Set<string>()
  for (const r of rows) {
    if (r.collectionSelect !== SELECT_NONE) {
      collectionSlugs.add(r.collectionSelect)
    }
  }
  const collectionsUsed = [...collectionSlugs]
  let collectionLabel: string | null = null
  if (collectionsUsed.length === 1) {
    const slug = collectionsUsed[0]
    collectionLabel =
      registries.collections.find((c) => c.slug === slug)?.title ?? slug
  } else if (collectionsUsed.length > 1) {
    collectionLabel = `${collectionsUsed.length} collections`
  }

  return {
    total: rows.length,
    titled,
    hidden,
    visible: rows.length - hidden,
    collectionLabel,
    collectionsUsed,
  }
}

export function formatUploadSummary(summary: UploadSummary): string {
  const parts: string[] = [`${summary.total} photo${summary.total === 1 ? "" : "s"}`]
  if (summary.collectionLabel) {
    parts.push(`collection: ${summary.collectionLabel}`)
  }
  parts.push(`${summary.visible} visible`)
  if (summary.hidden > 0) {
    parts.push(`${summary.hidden} hidden`)
  }
  parts.push(
    summary.titled === summary.total
      ? "all titled"
      : `${summary.titled}/${summary.total} titled`,
  )
  return parts.join(" · ")
}
