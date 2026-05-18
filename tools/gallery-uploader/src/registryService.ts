import {
  GALLERY_COLLECTION_META_VERSION,
  collectionSlugFromTitle,
  isValidCollectionSlug,
  serializeGalleryCollectionMeta,
} from "@galleree/gallery-collection"
import {
  GALLERY_EQUIPMENT_META_VERSION,
  equipmentSlugFromLabel,
  isValidEquipmentSlug,
  serializeGalleryEquipmentMeta,
} from "@galleree/gallery-equipment"
import { appInvoke } from "./tauriBridge"

async function writeRegistryJson(relativePath: string, json: string): Promise<void> {
  await appInvoke("write_gallery_registry_file", { relativePath, json })
}

async function writeRegistryAsset(relativePath: string, sourcePath: string): Promise<void> {
  await appInvoke("write_registry_asset", { relativePath, sourcePath })
}

export type SaveCollectionInput = {
  title: string
  description: string
  coverImageId: string | null
}

export type SaveEquipmentInput = {
  name: string
  make: string
  model: string
  description: string
  imagePath: string | null
  lensSlug: string | null
}

export async function saveCollectionRegistry(
  input: SaveCollectionInput,
): Promise<string> {
  const title = input.title.trim()
  const slug = collectionSlugFromTitle(title)
  if (!slug) {
    throw new Error("Enter a title that produces a valid slug (letters and numbers).")
  }
  if (!isValidCollectionSlug(slug)) {
    throw new Error(`Invalid collection slug “${slug}”.`)
  }

  await writeRegistryJson(
    `meta/collections/${slug}.json`,
    serializeGalleryCollectionMeta({
      version: GALLERY_COLLECTION_META_VERSION,
      slug,
      title,
      description: input.description.trim() || null,
      coverImageId: input.coverImageId,
    }),
  )
  return slug
}

export async function saveCameraRegistry(input: SaveEquipmentInput): Promise<string> {
  const name = input.name.trim()
  const slug = equipmentSlugFromLabel(name)
  if (!slug || !isValidEquipmentSlug(slug)) {
    throw new Error("Enter a name that produces a valid camera slug.")
  }

  let image: string | null = null
  if (input.imagePath) {
    const rel = `meta/cameras/${slug}.png`
    await writeRegistryAsset(rel, input.imagePath)
    image = rel
  }

  await writeRegistryJson(
    `meta/cameras/${slug}.json`,
    serializeGalleryEquipmentMeta({
      version: GALLERY_EQUIPMENT_META_VERSION,
      slug,
      name,
      make: input.make.trim() || null,
      model: input.model.trim() || null,
      description: input.description.trim() || null,
      image,
      lensSlug: input.lensSlug,
    }),
  )
  return slug
}

export async function saveLensRegistry(input: SaveEquipmentInput): Promise<string> {
  const name = input.name.trim()
  const slug = equipmentSlugFromLabel(name)
  if (!slug || !isValidEquipmentSlug(slug)) {
    throw new Error("Enter a name that produces a valid lens slug.")
  }

  let image: string | null = null
  if (input.imagePath) {
    const rel = `meta/lenses/${slug}.png`
    await writeRegistryAsset(rel, input.imagePath)
    image = rel
  }

  await writeRegistryJson(
    `meta/lenses/${slug}.json`,
    serializeGalleryEquipmentMeta({
      version: GALLERY_EQUIPMENT_META_VERSION,
      slug,
      name,
      make: input.make.trim() || null,
      model: input.model.trim() || null,
      description: input.description.trim() || null,
      image,
    }),
  )
  return slug
}

export async function fetchGalleryImages(): Promise<
  import("./registryTypes").GalleryImageRef[]
> {
  return appInvoke("list_gallery_images")
}
