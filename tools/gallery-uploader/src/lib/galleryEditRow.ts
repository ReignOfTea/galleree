import { appConvertFileSrc } from "../tauriBridge"
import { normalizeExtensionFromPath } from "../imageExtensions"
import { SELECT_NONE } from "../registryTypes"
import type { GalleryRegistries } from "../registryTypes"
import type { GalleryPhotoEdit, UploadRow } from "../types"
import { resolveEquipmentSelect } from "./applyImageHints"

export function uploadRowFromGalleryEdit(
  photo: GalleryPhotoEdit,
  registries: GalleryRegistries,
): UploadRow {
  const cam = resolveEquipmentSelect(photo.camera, registries.cameras)
  const lens = resolveEquipmentSelect(photo.lens, registries.lenses)
  const ext = normalizeExtensionFromPath(photo.destFilename)

  return {
    id: crypto.randomUUID(),
    sourcePath: photo.imagePath,
    previewSrc: appConvertFileSrc(photo.imagePath),
    title: photo.title,
    description: photo.description ?? "",
    tags: photo.tags.join(", "),
    location: photo.location ?? "",
    captureDate: photo.capturedOn ?? "",
    captureDateTimeIso: photo.capturedAt ?? "",
    collectionSelect: photo.collectionSlug ?? SELECT_NONE,
    collectionSetCover: false,
    cameraSelect: cam.select,
    cameraCustom: cam.custom,
    lensSelect: lens.select,
    lensCustom: lens.custom,
    alt: photo.alt ?? "",
    hidden: photo.hidden,
    sortOrder:
      photo.sortOrder != null && Number.isFinite(photo.sortOrder)
        ? String(photo.sortOrder)
        : "",
    copyright: photo.copyright ?? "",
    extension: ext,
    destId: photo.id,
    destFilename: photo.destFilename,
    destExists: true,
    editExistingId: photo.id,
    preserveUploadedAt: photo.uploadedAt,
    preserveExifDisplay: photo.exifDisplay,
    editGalleryImagePath: photo.imagePath,
    editOriginalFilename: photo.destFilename,
    replaceImageFile: false,
  }
}
