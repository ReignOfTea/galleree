import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'
import { parseGalleryCollectionMetaFile } from '../src/lib/galleryCollectionMeta'
import { parseGalleryEquipmentMetaFile } from '../src/lib/galleryEquipmentMeta'
import {
  displayRelativePathForId,
  galleryIdFromBasename,
  GALLERY_THUMB_WIDTHS,
  isValidGalleryImageBasename,
  isValidGalleryImageId,
  parseGalleryMetaFile,
  thumbRelativePathForId,
  thumbVariantAvifRelativePath,
  thumbVariantRelativePath,
} from '../src/lib/galleryMeta'
import {
  GALLERY_MANIFEST_FILENAME,
  type GalleryManifest,
  type ManifestCollection,
  type ManifestEquipmentEntry,
  type ManifestImage,
  type ManifestThumbVariant,
} from '../src/lib/manifest'
import { absolutePublicUrl, loadSiteForShare } from './galleryShareHtml'
import { blurHashFromImagePath } from './blurHashEncode'
import { galleryShareStubId } from './sharePageHash'

const IMAGE_EXT = ['.jpg', '.jpeg', '.png', '.webp', '.avif', '.gif']

function findImageForMetaId(galleryDir: string, id: string): string | null {
  for (const ext of IMAGE_EXT) {
    const candidate = `${id}${ext}`
    if (fs.existsSync(path.join(galleryDir, candidate))) return candidate
  }
  return null
}

function loadCollections(
  galleryDir: string,
): Record<string, ManifestCollection> {
  const dir = path.join(galleryDir, 'meta', 'collections')
  const out: Record<string, ManifestCollection> = {}
  if (!fs.existsSync(dir)) return out
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!ent.isFile() || !ent.name.endsWith('.json')) continue
    try {
      const raw = JSON.parse(
        fs.readFileSync(path.join(dir, ent.name), 'utf8'),
      ) as unknown
      const doc = parseGalleryCollectionMetaFile(raw)
      if (doc) {
        out[doc.slug] = {
          slug: doc.slug,
          title: doc.title,
          description: doc.description,
          coverImageId: doc.coverImageId,
        }
      }
    } catch {
      /* skip */
    }
  }
  return out
}

function loadEquipmentRegistry(
  galleryDir: string,
  kind: 'cameras' | 'lenses',
): Record<string, ManifestEquipmentEntry> {
  const dir = path.join(galleryDir, 'meta', kind)
  const out: Record<string, ManifestEquipmentEntry> = {}
  if (!fs.existsSync(dir)) return out
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!ent.isFile() || !ent.name.endsWith('.json')) continue
    const expectedSlug = ent.name.replace(/\.json$/i, '').toLowerCase()
    try {
      const raw = JSON.parse(
        fs.readFileSync(path.join(dir, ent.name), 'utf8'),
      ) as unknown
      const doc = parseGalleryEquipmentMetaFile(raw, { expectedSlug })
      if (!doc) continue
      out[doc.slug] = {
        slug: doc.slug,
        name: doc.name,
        make: doc.make,
        model: doc.model,
        description: doc.description,
        image: doc.image,
        ...(doc.lensSlug ? { lensSlug: doc.lensSlug } : {}),
      }
    } catch {
      /* skip */
    }
  }
  return out
}

async function imagePixelSize(
  filePath: string,
): Promise<{ width: number; height: number } | null> {
  try {
    const { width, height } = await sharp(filePath).metadata()
    if (width && height) return { width, height }
  } catch {
    /* skip */
  }
  return null
}

function loadThumbVariants(
  galleryDir: string,
  id: string,
): ManifestThumbVariant[] {
  const variants: ManifestThumbVariant[] = []
  for (const w of GALLERY_THUMB_WIDTHS) {
    const rel =
      w === 720 ? thumbRelativePathForId(id) : thumbVariantRelativePath(id, w)
    if (fs.existsSync(path.join(galleryDir, ...rel.split('/')))) {
      const avifRel = thumbVariantAvifRelativePath(id, w)
      const entry: ManifestThumbVariant = { width: w, path: rel }
      if (fs.existsSync(path.join(galleryDir, ...avifRel.split('/')))) {
        entry.pathAvif = avifRel
      }
      variants.push(entry)
    }
  }
  return variants
}

async function readManifestImages(
  galleryDir: string,
  siteUrl: string | undefined,
  viteBase: string,
): Promise<ManifestImage[]> {
  const metaDir = path.join(galleryDir, 'meta')
  if (!fs.existsSync(metaDir)) return []

  const images: ManifestImage[] = []

  for (const ent of fs.readdirSync(metaDir, { withFileTypes: true })) {
    if (!ent.isFile() || !ent.name.endsWith('.json')) continue

    const id = ent.name.replace(/\.json$/i, '')
    if (!isValidGalleryImageId(id)) continue

    const metaPath = path.join(metaDir, ent.name)

    let raw: unknown
    try {
      raw = JSON.parse(fs.readFileSync(metaPath, 'utf8'))
    } catch {
      continue
    }

    const meta = parseGalleryMetaFile(raw, { expectedId: id })
    if (!meta || meta.id !== id) continue
    if (meta.hidden) continue

    const galleryFile = findImageForMetaId(galleryDir, id)
    if (!galleryFile || !isValidGalleryImageBasename(galleryFile)) continue
    if (galleryIdFromBasename(galleryFile) !== id) continue

    const thumb = thumbRelativePathForId(id)
    const thumbAbs = path.join(galleryDir, ...thumb.split('/'))
    const entry: ManifestImage = { file: galleryFile, meta }
    if (meta.blurHash) entry.blurHash = meta.blurHash

    const thumbVariants = loadThumbVariants(galleryDir, id)
    if (thumbVariants.length > 0) entry.thumbVariants = thumbVariants

    const displayRel = displayRelativePathForId(id)
    const displayAbs = path.join(galleryDir, ...displayRel.split('/'))
    if (fs.existsSync(displayAbs)) entry.display = displayRel

    const srcAbs = path.join(galleryDir, galleryFile)
    if (fs.existsSync(thumbAbs)) {
      entry.thumb = thumb
      const size = await imagePixelSize(thumbAbs)
      if (size) {
        entry.thumbWidth = size.width
        entry.thumbHeight = size.height
      }
      if (!entry.blurHash) {
        entry.blurHash =
          (await blurHashFromImagePath(thumbAbs)) ?? undefined
      }
    } else {
      const size = await imagePixelSize(srcAbs)
      if (size) {
        entry.thumbWidth = size.width
        entry.thumbHeight = size.height
      }
      if (!entry.blurHash) {
        entry.blurHash =
          (await blurHashFromImagePath(srcAbs)) ?? undefined
      }
    }

    if (siteUrl) {
      const stubPath = `share/p/${galleryShareStubId(galleryFile)}.html`
      entry.shareStub = stubPath
      entry.sharePageUrl = absolutePublicUrl(siteUrl, viteBase, stubPath)
    }

    images.push(entry)
  }

  return images.sort((a, b) =>
    a.file.localeCompare(b.file, undefined, { sensitivity: 'base' }),
  )
}

export async function buildGalleryManifest(
  root: string,
  viteBase: string,
): Promise<GalleryManifest> {
  const galleryDir = path.join(root, 'public', 'gallery')
  const site = loadSiteForShare(root)
  return {
    generatedAt: new Date().toISOString(),
    collections: loadCollections(galleryDir),
    equipment: {
      cameras: loadEquipmentRegistry(galleryDir, 'cameras'),
      lenses: loadEquipmentRegistry(galleryDir, 'lenses'),
    },
    images: await readManifestImages(
      galleryDir,
      site.siteUrl ?? undefined,
      viteBase,
    ),
  }
}

export { GALLERY_MANIFEST_FILENAME }
