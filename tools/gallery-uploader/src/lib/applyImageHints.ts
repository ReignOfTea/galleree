import { matchEquipmentSlug } from "../matchRegistry"
import { SELECT_CUSTOM, SELECT_NONE } from "../registryTypes"
import type { GalleryRegistries, RegistryEquipment } from "../registryTypes"
import type { UploadRow } from "../types"
import { applyEquipmentDefaults } from "./equipmentDefaults"

export type ImageHints = {
  description: string | null
  dateTimeOriginalIso: string | null
  make: string | null
  model: string | null
  lensModel: string | null
}

export function parseIsoToCaptureDate(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Apply EXIF hints to a new or existing upload row. */
export function applyImageHints(
  row: UploadRow,
  hints: ImageHints,
  registries: GalleryRegistries,
): void {
  if (hints.description?.trim()) {
    row.description = hints.description.trim()
  }
  if (hints.dateTimeOriginalIso) {
    row.captureDateTimeIso = hints.dateTimeOriginalIso
    const parsed = parseIsoToCaptureDate(hints.dateTimeOriginalIso)
    if (parsed) row.captureDate = parsed
  }
  const camParts = [hints.make, hints.model].filter(Boolean) as string[]
  if (camParts.length) {
    const label = camParts.join(" ")
    const slug = matchEquipmentSlug(label, registries.cameras)
    if (slug) {
      row.cameraSelect = slug
    } else {
      row.cameraSelect = SELECT_CUSTOM
      row.cameraCustom = label
    }
  }
  if (hints.lensModel?.trim()) {
    const label = hints.lensModel.trim()
    const slug = matchEquipmentSlug(label, registries.lenses)
    if (slug) {
      row.lensSelect = slug
    } else {
      row.lensSelect = SELECT_CUSTOM
      row.lensCustom = label
    }
  }
  applyEquipmentDefaults(row, registries)
}

export function resolveEquipmentSelect(
  value: string | null | undefined,
  items: readonly RegistryEquipment[],
): { select: string; custom: string } {
  if (!value?.trim()) {
    return { select: SELECT_NONE, custom: "" }
  }
  const t = value.trim()
  const slug = matchEquipmentSlug(t, items)
  if (slug) return { select: slug, custom: "" }
  return { select: SELECT_CUSTOM, custom: t }
}
