import { equipmentSlugFromLabel } from "@galleree/gallery-equipment"
import type { RegistryEquipment } from "./registryTypes"

function normalizeLabel(label: string): string {
  return label.trim().toLowerCase().replace(/\s+/g, " ")
}

export function matchEquipmentSlug(
  label: string,
  items: readonly RegistryEquipment[],
): string | null {
  const t = normalizeLabel(label)
  if (!t) return null

  for (const item of items) {
    if (item.slug === t) return item.slug
    if (normalizeLabel(item.name) === t) return item.slug
    const makeModel = [item.make, item.model]
      .filter(Boolean)
      .join(" ")
    if (makeModel && normalizeLabel(makeModel) === t) return item.slug
  }

  const derived = equipmentSlugFromLabel(label)
  if (derived && items.some((i) => i.slug === derived)) return derived

  return null
}
