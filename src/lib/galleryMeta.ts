import type { FilenameMeta } from './filenameMeta'
import { isValidCollectionSlug } from './galleryCollectionMeta'
import {
  resolveEquipmentRef,
  type ResolvedEquipment,
  type ResolvedEquipmentRef,
} from './galleryEquipmentMeta'

export const GALLERY_META_VERSION = 1 as const

const ALLOWED_IMAGE_EXT = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.avif',
  '.gif',
])

/** 32-char hex id (UUID without dashes). */
export const GALLERY_IMAGE_ID_RE = /^[a-f0-9]{32}$/i

/** Sidecar at `public/gallery/meta/{id}.json` — image is `{id}.{ext}` on disk. */
export type GalleryImageMetaFile = {
  version: typeof GALLERY_META_VERSION
  id: string
  title: string
  description: string | null
  /** User tags only — location is not stored here */
  tags: string[]
  location: string | null
  /** Local calendar day `YYYY-MM-DD` */
  capturedOn: string | null
  /** ISO 8601 date or date-time for precise sort */
  capturedAt: string | null
  camera: string | null
  lens: string | null
  collectionSlug: string | null
  alt: string | null
  hidden: boolean
  sortOrder: number | null
  copyright: string | null
  uploadedAt: string | null
}

export type GalleryMetaSource = 'json'

export type ResolvedGalleryMeta = Omit<FilenameMeta, 'parseMode'> & {
  metaSource: GalleryMetaSource
  imageId: string
  description: string | null
  collectionSlug: string | null
  alt: string | null
  hidden: boolean
  sortOrder: number | null
  copyright: string | null
  uploadedAt: string | null
  cameraRef: ResolvedEquipmentRef | null
  lensRef: ResolvedEquipmentRef | null
  lensLabel: string | null
}

export function galleryIdFromBasename(file: string): string {
  return file.replace(/\.[^.]+$/i, '')
}

export function metaRelativePathForId(id: string): string {
  return `meta/${id}.json`
}

export function metaRelativePathForImage(galleryFile: string): string {
  return metaRelativePathForId(galleryIdFromBasename(galleryFile))
}

export function thumbRelativePathForId(id: string): string {
  return `thumbs/${id}.jpg`
}

export function thumbRelativePathForImage(galleryFile: string): string {
  return thumbRelativePathForId(galleryIdFromBasename(galleryFile))
}

export function normalizeImageExtension(extensionWithDot: string): string {
  const ext = extensionWithDot.startsWith('.')
    ? extensionWithDot.toLowerCase()
    : `.${extensionWithDot.toLowerCase()}`
  return ALLOWED_IMAGE_EXT.has(ext) ? ext : '.jpg'
}

export function generateGalleryImageId(): string {
  return globalThis.crypto.randomUUID().replace(/-/g, '')
}

export function isValidGalleryImageId(id: string): boolean {
  return GALLERY_IMAGE_ID_RE.test(id)
}

export function isValidGalleryImageBasename(name: string): boolean {
  if (!name || name.includes('/') || name.includes('\\') || name.includes('..')) {
    return false
  }
  const ext = name.slice(name.lastIndexOf('.')).toLowerCase()
  if (!ALLOWED_IMAGE_EXT.has(ext)) return false
  return isValidGalleryImageId(galleryIdFromBasename(name))
}

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x)
}

function normalizeStringArray(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  const out: string[] = []
  for (const item of raw) {
    if (typeof item !== 'string') continue
    const t = item.trim()
    if (t) out.push(t)
  }
  return [...new Set(out)]
}

function normalizeCapturedOn(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const t = raw.trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return null
  const [y, mo, d] = t.split('-').map(Number)
  const dt = new Date(y, mo - 1, d, 0, 0, 0)
  if (Number.isNaN(dt.getTime())) return null
  if (
    dt.getFullYear() !== y ||
    dt.getMonth() !== mo - 1 ||
    dt.getDate() !== d
  ) {
    return null
  }
  return t
}

function normalizeIsoDateTime(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const t = raw.trim()
  if (!t) return null
  const d = new Date(t)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString()
}

function nullableString(raw: unknown): string | null {
  if (raw == null) return null
  if (typeof raw !== 'string') return null
  const t = raw.trim()
  return t ? t : null
}

function normalizeSortOrder(raw: unknown): number | null {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw
  if (typeof raw === 'string' && raw.trim()) {
    const n = Number(raw)
    if (Number.isFinite(n)) return n
  }
  return null
}

function normalizeBoolean(raw: unknown, defaultValue: boolean): boolean {
  if (typeof raw === 'boolean') return raw
  if (raw === 'true' || raw === 1) return true
  if (raw === 'false' || raw === 0) return false
  return defaultValue
}

export function stripLocationFromTags(
  tags: string[],
  location: string | null,
): string[] {
  if (!location) return tags
  return tags.filter((t) => t !== location)
}

type ParseMetaOptions = {
  /** Meta path stem must match this id */
  expectedId?: string
}

function parseCollectionSlug(raw: Record<string, unknown>): string | null {
  if (typeof raw.collectionSlug !== 'string' || !raw.collectionSlug.trim()) {
    return null
  }
  const s = raw.collectionSlug.trim().toLowerCase()
  return isValidCollectionSlug(s) ? s : null
}

export function parseGalleryMetaFile(
  raw: unknown,
  options: ParseMetaOptions = {},
): GalleryImageMetaFile | null {
  if (!isRecord(raw)) return null
  if (raw.version !== GALLERY_META_VERSION) return null

  const title =
    typeof raw.title === 'string' && raw.title.trim()
      ? raw.title.trim()
      : null
  if (!title) return null

  let id: string | null = null
  if (typeof raw.id === 'string' && isValidGalleryImageId(raw.id)) {
    id = raw.id.trim().toLowerCase()
  } else if (options.expectedId && isValidGalleryImageId(options.expectedId)) {
    id = options.expectedId.toLowerCase()
  }
  if (!id) return null
  if (options.expectedId && id !== options.expectedId.toLowerCase()) return null

  const location = nullableString(raw.location)
  let tags = normalizeStringArray(raw.tags)
  tags = stripLocationFromTags(tags, location)

  return {
    version: GALLERY_META_VERSION,
    id,
    title,
    description: nullableString(raw.description),
    tags,
    location,
    capturedOn: normalizeCapturedOn(raw.capturedOn),
    capturedAt: normalizeIsoDateTime(raw.capturedAt),
    camera: nullableString(raw.camera),
    lens: nullableString(raw.lens),
    collectionSlug: parseCollectionSlug(raw),
    alt: nullableString(raw.alt),
    hidden: normalizeBoolean(raw.hidden, false),
    sortOrder: normalizeSortOrder(raw.sortOrder),
    copyright: nullableString(raw.copyright),
    uploadedAt: normalizeIsoDateTime(raw.uploadedAt),
  }
}

export function captureTimestamps(
  meta: Pick<GalleryImageMetaFile, 'capturedAt' | 'capturedOn'>,
): {
  capturedAt: number | null
  capturedAtIsDateOnly: boolean
} {
  if (meta.capturedAt) {
    const d = new Date(meta.capturedAt)
    if (!Number.isNaN(d.getTime())) {
      const iso = d.toISOString()
      const dateOnly =
        iso.endsWith('T00:00:00.000Z') &&
        d.getUTCHours() === 0 &&
        d.getUTCMinutes() === 0
      return {
        capturedAt: d.getTime(),
        capturedAtIsDateOnly: dateOnly,
      }
    }
  }
  if (meta.capturedOn) {
    const [y, mo, day] = meta.capturedOn.split('-').map(Number)
    const dt = new Date(y, mo - 1, day, 0, 0, 0)
    if (!Number.isNaN(dt.getTime())) {
      return { capturedAt: dt.getTime(), capturedAtIsDateOnly: true }
    }
  }
  return { capturedAt: null, capturedAtIsDateOnly: false }
}

export function captureDateToCapturedOn(date: Date | null): string | null {
  if (!date || Number.isNaN(date.getTime())) return null
  const y = date.getFullYear()
  const mo = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${y}-${mo}-${day}`
}

export function nowIsoTimestamp(): string {
  return new Date().toISOString()
}

export function galleryMetaFromUploadFields(
  fields: {
    title: string
    description: string
    tags: string[]
    location: string
    capturedAt: Date | null
    camera: string
    lens: string
    /** Registry slug, or omit / null for none */
    collectionSlug: string | null
    alt: string
    hidden: boolean
    sortOrder: number | null
    copyright: string
  },
  id: string,
  uploadedAt?: string,
): GalleryImageMetaFile {
  const title = fields.title.trim() || 'Untitled'
  let tags = fields.tags.map((t) => t.trim()).filter(Boolean)
  if (tags.length === 0) tags = [title]
  tags = stripLocationFromTags(tags, fields.location.trim() || null)

  const collectionSlugRaw = fields.collectionSlug?.trim().toLowerCase() ?? ''
  const collectionSlug =
    collectionSlugRaw && isValidCollectionSlug(collectionSlugRaw)
      ? collectionSlugRaw
      : null
  const capturedOn = captureDateToCapturedOn(fields.capturedAt)
  const capturedAt =
    fields.capturedAt && !Number.isNaN(fields.capturedAt.getTime())
      ? fields.capturedAt.toISOString()
      : null

  return {
    version: GALLERY_META_VERSION,
    id,
    title,
    description: fields.description.trim() || null,
    tags: [...new Set(tags)],
    location: fields.location.trim() || null,
    capturedOn,
    capturedAt,
    camera: fields.camera.trim() || null,
    lens: fields.lens.trim() || null,
    collectionSlug: collectionSlug ?? null,
    alt: fields.alt.trim() || null,
    hidden: fields.hidden,
    sortOrder: fields.sortOrder,
    copyright: fields.copyright.trim() || null,
    uploadedAt: uploadedAt ?? nowIsoTimestamp(),
  }
}

/** Omit null/empty fields for small sidecars. */
export function serializeGalleryMeta(meta: GalleryImageMetaFile): string {
  const out: Record<string, unknown> = {
    version: meta.version,
    id: meta.id,
    title: meta.title,
    tags: meta.tags,
  }
  if (meta.description) out.description = meta.description
  if (meta.location) out.location = meta.location
  if (meta.capturedOn) out.capturedOn = meta.capturedOn
  if (meta.capturedAt) out.capturedAt = meta.capturedAt
  if (meta.camera) out.camera = meta.camera
  if (meta.lens) out.lens = meta.lens
  if (meta.collectionSlug) out.collectionSlug = meta.collectionSlug
  if (meta.alt) out.alt = meta.alt
  if (meta.hidden) out.hidden = true
  if (meta.sortOrder != null) out.sortOrder = meta.sortOrder
  if (meta.copyright) out.copyright = meta.copyright
  if (meta.uploadedAt) out.uploadedAt = meta.uploadedAt
  return `${JSON.stringify(out, null, 2)}\n`
}

export type ResolveGalleryMetaOptions = {
  collectionTitleBySlug?: ReadonlyMap<string, string>
  cameras?: ReadonlyMap<string, ResolvedEquipment>
  lenses?: ReadonlyMap<string, ResolvedEquipment>
}

export function resolveGalleryMeta(
  meta: GalleryImageMetaFile,
  options: ResolveGalleryMetaOptions = {},
): ResolvedGalleryMeta {
  const collectionTitleBySlug =
    options.collectionTitleBySlug ?? new Map<string, string>()
  const cameras = options.cameras ?? new Map<string, ResolvedEquipment>()
  const lenses = options.lenses ?? new Map<string, ResolvedEquipment>()

  const locationDisplay = meta.location
  const tags = [
    ...new Set([
      ...meta.tags,
      ...(locationDisplay ? [locationDisplay] : []),
    ]),
  ]
  const { capturedAt, capturedAtIsDateOnly } = captureTimestamps(meta)
  const eventLabel = meta.collectionSlug
    ? (collectionTitleBySlug.get(meta.collectionSlug) ?? null)
    : null

  const cameraRef = resolveEquipmentRef(meta.camera, 'camera', cameras)
  const lensRef = resolveEquipmentRef(meta.lens, 'lens', lenses)

  return {
    tags,
    locationDisplay,
    displayTitle: meta.title,
    capturedAt,
    capturedAtIsDateOnly,
    cameraLabel: cameraRef?.label ?? null,
    eventLabel,
    metaSource: 'json',
    imageId: meta.id,
    description: meta.description,
    collectionSlug: meta.collectionSlug,
    alt: meta.alt,
    hidden: meta.hidden,
    sortOrder: meta.sortOrder,
    copyright: meta.copyright,
    uploadedAt: meta.uploadedAt,
    cameraRef,
    lensRef,
    lensLabel: lensRef?.label ?? null,
  }
}

export function resolveEntryMeta(
  meta: GalleryImageMetaFile,
  options?: ResolveGalleryMetaOptions,
): ResolvedGalleryMeta {
  return resolveGalleryMeta(meta, options)
}

export function randomGalleryImageFilename(
  extensionWithDot: string,
  takenNames: ReadonlySet<string>,
): { id: string; file: string } {
  const ext = normalizeImageExtension(extensionWithDot)
  let id: string
  let file: string
  do {
    id = generateGalleryImageId()
    file = `${id}${ext}`
  } while (takenNames.has(file.toLowerCase()))
  return { id, file }
}
