import {
  GALLERY_COLLECTION_META_VERSION,
  collectionSlugFromTitle,
  isValidCollectionSlug,
  parseGalleryCollectionMetaFile,
  serializeGalleryCollectionMeta,
} from "@galleree/gallery-collection"
import {
  GALLERY_EQUIPMENT_META_VERSION,
  equipmentSlugFromLabel,
  isValidEquipmentSlug,
  parseGalleryEquipmentMetaFile,
  serializeGalleryEquipmentMeta,
} from "@galleree/gallery-equipment"
import { appInvoke } from "./tauriBridge"
import { normalizeKnownTags } from "./lib/tagSuggest"
import type { GalleryRegistries } from "./registryTypes"

async function writeRegistryJson(relativePath: string, json: string): Promise<void> {
  await appInvoke("write_gallery_registry_file", { relativePath, json })
}

async function writeRegistryAsset(relativePath: string, sourcePath: string): Promise<void> {
  await appInvoke("write_registry_asset", { relativePath, sourcePath })
}

export type SaveCollectionInput = {
  /** Existing slug when editing; derived from title when creating. */
  slug?: string
  title: string
  description: string
  coverImageId: string | null
}

export type SaveEquipmentInput = {
  slug?: string
  name: string
  make: string
  model: string
  description: string
  imagePath: string | null
  lensSlug: string | null
}

async function readRegistryJson(relativePath: string): Promise<unknown> {
  const raw = await appInvoke<string>("read_gallery_registry_file", {
    relativePath,
  })
  return JSON.parse(raw) as unknown
}

export async function loadCollectionForEdit(slug: string): Promise<SaveCollectionInput> {
  const raw = await readRegistryJson(`meta/collections/${slug}.json`)
  const meta = parseGalleryCollectionMetaFile(raw)
  if (!meta) {
    throw new Error(`Could not read collection “${slug}”.`)
  }
  return {
    slug: meta.slug,
    title: meta.title,
    description: meta.description ?? "",
    coverImageId: meta.coverImageId,
  }
}

export async function loadEquipmentForEdit(
  kind: "camera" | "lens",
  slug: string,
): Promise<SaveEquipmentInput & { imageRelative: string | null }> {
  const raw = await readRegistryJson(`meta/${kind}s/${slug}.json`)
  const meta = parseGalleryEquipmentMetaFile(raw, { expectedSlug: slug })
  if (!meta) {
    throw new Error(`Could not read ${kind} “${slug}”.`)
  }
  return {
    slug: meta.slug,
    name: meta.name,
    make: meta.make ?? "",
    model: meta.model ?? "",
    description: meta.description ?? "",
    imagePath: null,
    lensSlug: meta.lensSlug ?? null,
    imageRelative: meta.image,
  }
}

export async function resolveGalleryAssetPath(
  relative: string,
): Promise<string> {
  return appInvoke("resolve_gallery_relative_path", { relativePath: relative })
}

export async function saveCollectionRegistry(
  input: SaveCollectionInput,
): Promise<string> {
  const title = input.title.trim()
  const slug =
    input.slug?.trim().toLowerCase() ?? collectionSlugFromTitle(title) ?? ""
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

/** Updates an existing collection registry to use a gallery image id as its cover. */
export async function setCollectionCoverPhoto(
  slug: string,
  coverImageId: string,
  registries: GalleryRegistries,
): Promise<void> {
  const col = registries.collections.find((c) => c.slug === slug)
  if (!col) {
    throw new Error(`Collection “${slug}” was not found in the gallery project.`)
  }
  const id = coverImageId.trim().toLowerCase()
  if (!id) {
    throw new Error("This photo does not have a gallery id yet — add a title first.")
  }

  await writeRegistryJson(
    `meta/collections/${slug}.json`,
    serializeGalleryCollectionMeta({
      version: GALLERY_COLLECTION_META_VERSION,
      slug,
      title: col.title,
      description: col.description,
      coverImageId: id,
    }),
  )
}

export async function saveCameraRegistry(input: SaveEquipmentInput): Promise<string> {
  const name = input.name.trim()
  const slug = input.slug?.trim().toLowerCase() ?? equipmentSlugFromLabel(name) ?? ""
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
  const slug = input.slug?.trim().toLowerCase() ?? equipmentSlugFromLabel(name) ?? ""
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

export async function fetchGalleryTags(): Promise<string[]> {
  const raw = await appInvoke<string[]>("list_gallery_tags")
  return normalizeKnownTags(raw)
}
