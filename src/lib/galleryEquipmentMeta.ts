import { displayTitleToSlug } from './slug'

export const GALLERY_EQUIPMENT_META_VERSION = 1 as const

export type EquipmentKind = 'camera' | 'lens'

/** Registry entry at `public/gallery/meta/cameras/{slug}.json` or `meta/lenses/{slug}.json` */
export type GalleryEquipmentMetaFile = {
  version: typeof GALLERY_EQUIPMENT_META_VERSION
  slug: string
  /** Friendly display name shown in captions */
  name: string
  make: string | null
  model: string | null
  description: string | null
  /** Path relative to `public/gallery/`, e.g. `meta/cameras/sony-a7iv.jpg` */
  image: string | null
  /** Default lens registry slug (camera profiles only) */
  lensSlug?: string | null
}

export type ResolvedEquipment = {
  slug: string
  name: string
  make: string | null
  model: string | null
  description: string | null
  imageUrl: string | null
  /** Default lens when the image sidecar omits `lens` (camera registry only) */
  lensSlug?: string | null
}

export type GalleryEquipmentRegistry = {
  cameras: Record<string, ResolvedEquipment>
  lenses: Record<string, ResolvedEquipment>
}

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export function isValidEquipmentSlug(slug: string): boolean {
  const t = slug.trim().toLowerCase()
  return t.length > 0 && t.length <= 80 && SLUG_RE.test(t)
}

export function equipmentSlugFromLabel(label: string): string | null {
  const slug = displayTitleToSlug(label)
  return slug && isValidEquipmentSlug(slug) ? slug : null
}

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x)
}

function nullableString(raw: unknown): string | null {
  if (raw == null) return null
  if (typeof raw !== 'string') return null
  const t = raw.trim()
  return t ? t : null
}

export function parseGalleryEquipmentMetaFile(
  raw: unknown,
  options: { expectedSlug?: string } = {},
): GalleryEquipmentMetaFile | null {
  if (!isRecord(raw)) return null
  if (raw.version !== GALLERY_EQUIPMENT_META_VERSION) return null

  const slug =
    typeof raw.slug === 'string' && isValidEquipmentSlug(raw.slug)
      ? raw.slug.trim().toLowerCase()
      : options.expectedSlug && isValidEquipmentSlug(options.expectedSlug)
        ? options.expectedSlug.trim().toLowerCase()
        : null

  const name =
    typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim() : null
  if (!slug || !name) return null
  if (options.expectedSlug && slug !== options.expectedSlug.toLowerCase()) {
    return null
  }

  const image = nullableString(raw.image)
  const lensSlugRaw = nullableString(raw.lensSlug)
  const lensSlug =
    lensSlugRaw && isValidEquipmentSlug(lensSlugRaw)
      ? lensSlugRaw.toLowerCase()
      : null

  return {
    version: GALLERY_EQUIPMENT_META_VERSION,
    slug,
    name,
    make: nullableString(raw.make),
    model: nullableString(raw.model),
    description: nullableString(raw.description),
    image,
    lensSlug,
  }
}

export function serializeGalleryEquipmentMeta(
  meta: GalleryEquipmentMetaFile,
): string {
  const out: Record<string, unknown> = {
    version: meta.version,
    slug: meta.slug,
    name: meta.name,
  }
  if (meta.make) out.make = meta.make
  if (meta.model) out.model = meta.model
  if (meta.description) out.description = meta.description
  if (meta.image) out.image = meta.image
  if (meta.lensSlug) out.lensSlug = meta.lensSlug
  return `${JSON.stringify(out, null, 2)}\n`
}

export type ResolvedEquipmentRef = {
  kind: EquipmentKind
  slug: string
  label: string
  hasRegistry: boolean
}

export function resolveEquipmentRef(
  raw: string | null,
  kind: EquipmentKind,
  registry: ReadonlyMap<string, ResolvedEquipment>,
): ResolvedEquipmentRef | null {
  if (!raw?.trim()) return null
  const trimmed = raw.trim()

  const directSlug = isValidEquipmentSlug(trimmed)
    ? trimmed.toLowerCase()
    : null
  if (directSlug && registry.has(directSlug)) {
    return {
      kind,
      slug: directSlug,
      label: registry.get(directSlug)!.name,
      hasRegistry: true,
    }
  }

  const derivedSlug = equipmentSlugFromLabel(trimmed)
  if (derivedSlug && registry.has(derivedSlug)) {
    return {
      kind,
      slug: derivedSlug,
      label: registry.get(derivedSlug)!.name,
      hasRegistry: true,
    }
  }

  return {
    kind,
    slug: directSlug ?? derivedSlug ?? trimmed.toLowerCase(),
    label: trimmed,
    hasRegistry: false,
  }
}

export type CameraEquipmentDetail = {
  camera: ResolvedEquipment
  lens: ResolvedEquipment | null
}

/** Camera modal: image sidecar lens wins, then camera registry default. */
export function resolveCameraEquipmentDetail(
  registry: GalleryEquipmentRegistry,
  cameraSlug: string,
  imageLens: ResolvedEquipmentRef | null | undefined,
): CameraEquipmentDetail | null {
  const camera = registry.cameras[cameraSlug]
  if (!camera) return null

  const lensSlug =
    (imageLens?.hasRegistry ? imageLens.slug : null) ??
    camera.lensSlug ??
    null
  const lens = lensSlug ? (registry.lenses[lensSlug] ?? null) : null

  return { camera, lens }
}
