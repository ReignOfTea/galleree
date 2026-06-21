import { SELECT_NONE } from "../registryTypes"
import type { GalleryRegistries } from "../registryTypes"
import type { UploadRow } from "../types"

/** Registry slug for Sony α7 IV (`public/gallery/meta/cameras/sony-ilce-7m4.json`). */
export const DEFAULT_CAMERA_SLUG = "sony-ilce-7m4"

/** Registry slug for Tamron 28-200mm (`public/gallery/meta/lenses/tamron-28-200mm-f28-56-di-iii-rxd.json`). */
export const DEFAULT_LENS_SLUG = "tamron-28-200mm-f28-56-di-iii-rxd"

/** Fill camera/lens when EXIF did not resolve them and the slugs exist in the registry. */
export function applyEquipmentDefaults(
  row: UploadRow,
  registries: GalleryRegistries,
): void {
  if (row.cameraSelect === SELECT_NONE) {
    if (registries.cameras.some((c) => c.slug === DEFAULT_CAMERA_SLUG)) {
      row.cameraSelect = DEFAULT_CAMERA_SLUG
    }
  }
  if (row.lensSelect === SELECT_NONE) {
    if (registries.lenses.some((l) => l.slug === DEFAULT_LENS_SLUG)) {
      row.lensSelect = DEFAULT_LENS_SLUG
    }
  }
}
