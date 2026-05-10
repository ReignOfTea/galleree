/** Turn keys from exifr into readable labels / values for the details panel */

const LABEL: Record<string, string> = {
  Make: 'Camera make',
  Model: 'Camera model',
  LensMake: 'Lens make',
  LensModel: 'Lens',
  FocalLength: 'Focal length',
  FocalLengthIn35mmFormat: 'Focal length (35mm eq.)',
  FNumber: 'Aperture',
  ExposureTime: 'Shutter speed',
  ISO: 'ISO',
  ISOSpeedRatings: 'ISO',
  ExposureProgram: 'Exposure program',
  MeteringMode: 'Metering mode',
  Flash: 'Flash',
  WhiteBalance: 'White balance',
  Orientation: 'Orientation',
  DateTimeOriginal: 'Date (original)',
  CreateDate: 'Date (created)',
  ModifyDate: 'Date (modified)',
  ImageWidth: 'Width',
  ImageHeight: 'Height',
  ExifImageWidth: 'Width',
  ExifImageHeight: 'Height',
  ColorSpace: 'Color space',
  Software: 'Software',
  Artist: 'Artist',
  Copyright: 'Copyright',
  Title: 'Title',
  Description: 'Description',
  Keywords: 'Keywords',
  Country: 'Country',
  City: 'City',
  Sublocation: 'Location',
}

const SKIP_KEY = /^(thumbnail|MakerNote|PrintImageMatching|CFAPattern|ComponentsConfiguration)$/i

function isSkippableValue(v: unknown): boolean {
  if (v == null) return true
  if (typeof v === 'object') {
    if (v instanceof ArrayBuffer) return true
    if (ArrayBuffer.isView(v)) return true
    if (Array.isArray(v)) return v.length > 12
  }
  return false
}

function formatExposureSeconds(v: number): string {
  if (v >= 1) return `${v % 1 === 0 ? v : v.toFixed(1)} s`
  const inv = Math.round(1 / v)
  return `1/${inv} s`
}

function formatValue(key: string, v: unknown): string | null {
  if (v == null) return null
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) return null
    if (key === 'ExposureTime') return formatExposureSeconds(v)
    if (key === 'FNumber') return `f/${v}`
    if (key === 'FocalLength' || key === 'FocalLengthIn35mmFormat') return `${Math.round(v)} mm`
    return String(v)
  }
  if (typeof v === 'boolean') return v ? 'Yes' : 'No'
  if (v instanceof Date) {
    return v.toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    })
  }
  if (typeof v === 'string') {
    const t = v.trim()
    return t.length > 0 ? t : null
  }
  if (Array.isArray(v)) {
    const parts = v
      .map((x) => (typeof x === 'string' || typeof x === 'number' ? String(x) : null))
      .filter(Boolean) as string[]
    return parts.length ? parts.join(', ') : null
  }
  return null
}

function labelForKey(key: string): string {
  return LABEL[key] ?? key.replace(/([A-Z])([a-z])/g, ' $1$2').replace(/^./, (s) => s.toUpperCase()).trim()
}

const PREFERRED_ORDER = [
  'Make',
  'Model',
  'LensModel',
  'FocalLength',
  'FocalLengthIn35mmFormat',
  'FNumber',
  'ExposureTime',
  'ISO',
  'ISOSpeedRatings',
  'ExposureProgram',
  'MeteringMode',
  'Flash',
  'WhiteBalance',
  'DateTimeOriginal',
  'CreateDate',
  'ModifyDate',
  'ImageWidth',
  'ImageHeight',
  'ExifImageWidth',
  'ExifImageHeight',
  'Orientation',
  'ColorSpace',
  'Software',
  'Artist',
  'Copyright',
]

export type ExifDisplayRow = { label: string; value: string }

export function exifToDisplayRows(raw: Record<string, unknown>): ExifDisplayRow[] {
  const seen = new Set<string>()
  const rows: ExifDisplayRow[] = []

  const pushKey = (key: string) => {
    if (SKIP_KEY.test(key)) return
    if (seen.has(key)) return
    const val = raw[key]
    if (isSkippableValue(val)) return
    const formatted = formatValue(key, val)
    if (!formatted) return
    seen.add(key)
    rows.push({ label: labelForKey(key), value: formatted })
  }

  for (const key of PREFERRED_ORDER) {
    if (key in raw) pushKey(key)
  }

  for (const key of Object.keys(raw).sort()) {
    pushKey(key)
  }

  return rows
}
