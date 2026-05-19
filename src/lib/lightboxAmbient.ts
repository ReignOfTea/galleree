export const LIGHTBOX_AMBIENT_STORAGE_KEY = 'galleree-lightbox-ambient'
export const LIGHTBOX_AMBIENT_INTENSITY_KEY = 'galleree-lightbox-ambient-intensity'

/** Default viewer ambient intensity (0–100 scale on slider). */
export const DEFAULT_AMBIENT_INTENSITY = 85

export const AMBIENT_INTENSITY_MIN = 20
export const AMBIENT_INTENSITY_MAX = 200

const SAMPLE_SIZE = 48

export type AmbientColors = {
  tl: string
  tr: string
  bl: string
  br: string
}

export type AmbientSample = {
  colors: AmbientColors
  /** 0.72–1.12 — scales glow opacity from visible scene brightness. */
  brightness: number
}

export type VisibleImageLayout = {
  centerX: number
  centerY: number
  width: number
  height: number
}

type Corner = keyof AmbientColors

let cachedPreferAmbientOffDefault: boolean | null = null

/** Touch-first mobile / tablet, reduced motion, or modest CPU/RAM — ambient glow is costly. */
export function prefersAmbientOffByDefault(): boolean {
  if (cachedPreferAmbientOffDefault !== null) return cachedPreferAmbientOffDefault
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    cachedPreferAmbientOffDefault = false
    return false
  }

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    cachedPreferAmbientOffDefault = true
    return true
  }

  const touchPrimary =
    window.matchMedia('(hover: none)').matches &&
    window.matchMedia('(pointer: coarse)').matches
  if (touchPrimary) {
    cachedPreferAmbientOffDefault = true
    return true
  }

  const cores = navigator.hardwareConcurrency
  if (cores != null && cores > 0 && cores <= 4) {
    cachedPreferAmbientOffDefault = true
    return true
  }

  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory
  if (memory != null && memory > 0 && memory <= 4) {
    cachedPreferAmbientOffDefault = true
    return true
  }

  cachedPreferAmbientOffDefault = false
  return false
}

export function getStoredLightboxAmbient(): boolean {
  try {
    const v = localStorage.getItem(LIGHTBOX_AMBIENT_STORAGE_KEY)
    if (v === 'off' || v === '0' || v === 'false') return false
    if (v === 'on' || v === '1' || v === 'true') return true
  } catch {
    /* private mode */
  }
  return !prefersAmbientOffByDefault()
}

export function setStoredLightboxAmbient(on: boolean): void {
  try {
    localStorage.setItem(LIGHTBOX_AMBIENT_STORAGE_KEY, on ? 'on' : 'off')
  } catch {
    /* ignore */
  }
}

export function getStoredAmbientIntensity(): number {
  try {
    const v = localStorage.getItem(LIGHTBOX_AMBIENT_INTENSITY_KEY)
    if (v == null) return DEFAULT_AMBIENT_INTENSITY
    const n = Number(v)
    if (!Number.isFinite(n)) return DEFAULT_AMBIENT_INTENSITY
    return Math.min(AMBIENT_INTENSITY_MAX, Math.max(AMBIENT_INTENSITY_MIN, n))
  } catch {
    return DEFAULT_AMBIENT_INTENSITY
  }
}

export function setStoredAmbientIntensity(value: number): void {
  const clamped = Math.min(
    AMBIENT_INTENSITY_MAX,
    Math.max(AMBIENT_INTENSITY_MIN, Math.round(value)),
  )
  try {
    localStorage.setItem(LIGHTBOX_AMBIENT_INTENSITY_KEY, String(clamped))
  } catch {
    /* ignore */
  }
}

/** 0.2–2.0 — scales color mix % and overall glow opacity. */
export function ambientStrengthFromIntensity(intensity: number): number {
  return intensity / 100
}

/** Scale factor for glow footprint (larger = bigger halo). */
export function ambientSizeFromIntensity(intensity: number): number {
  return 0.9 + (intensity / 100) * 0.75
}

function clampByte(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)))
}

function enhanceAmbientRgb(r: number, g: number, b: number): string {
  const max = Math.max(r, g, b, 1)
  const min = Math.min(r, g, b)
  const sat = (max - min) / max
  const boost = 1.22 + sat * 0.48
  const mid = (r + g + b) / 3
  return `rgb(${clampByte(mid + (r - mid) * boost)}, ${clampByte(mid + (g - mid) * boost)}, ${clampByte(mid + (b - mid) * boost)})`
}

function brightnessFromLuminance(avgLum: number): number {
  return 0.72 + (avgLum / 255) * 0.4
}

function pixelInCorner(x: number, y: number, size: number, corner: Corner): boolean {
  const half = size / 2
  switch (corner) {
    case 'tl':
      return x < half && y < half
    case 'tr':
      return x >= half && y < half
    case 'bl':
      return x < half && y >= half
    case 'br':
      return x >= half && y >= half
  }
}

/** Distance from the quadrant’s outer corner (0 = at corner, 1 = toward center). */
function cornerEdgeWeight(
  x: number,
  y: number,
  size: number,
  corner: Corner,
): number {
  const half = size / 2
  let dx = 0
  let dy = 0
  switch (corner) {
    case 'tl':
      dx = x
      dy = y
      break
    case 'tr':
      dx = size - 1 - x
      dy = y
      break
    case 'bl':
      dx = x
      dy = size - 1 - y
      break
    case 'br':
      dx = size - 1 - x
      dy = size - 1 - y
      break
  }
  const maxDist = Math.hypot(half, half) || 1
  const dist = Math.hypot(dx, dy) / maxDist
  return 0.12 + 0.88 * (1 - dist * dist)
}

function sampleCornerColor(
  data: Uint8ClampedArray,
  size: number,
  corner: Corner,
): string | null {
  let rSum = 0
  let gSum = 0
  let bSum = 0
  let weightSum = 0

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (!pixelInCorner(x, y, size, corner)) continue

      const i = (y * size + x) * 4
      const r = data[i]!
      const g = data[i + 1]!
      const b = data[i + 2]!
      const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
      if (lum < 14 || lum > 250) continue

      const w = cornerEdgeWeight(x, y, size, corner)
      rSum += r * w
      gSum += g * w
      bSum += b * w
      weightSum += w
    }
  }

  if (weightSum === 0) return null
  return enhanceAmbientRgb(rSum / weightSum, gSum / weightSum, bSum / weightSum)
}

function colorsFromRegionalImageData(
  data: Uint8ClampedArray,
  size: number,
): AmbientSample | null {
  const corners: Corner[] = ['tl', 'tr', 'bl', 'br']
  const sampled: Partial<AmbientColors> = {}
  let lumSum = 0
  let lumCount = 0

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4
      const r = data[i]!
      const g = data[i + 1]!
      const b = data[i + 2]!
      const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
      if (lum < 14 || lum > 250) continue
      lumSum += lum
      lumCount++
    }
  }

  for (const corner of corners) {
    const color = sampleCornerColor(data, size, corner)
    if (color) sampled[corner] = color
  }

  const first =
    sampled.tl ?? sampled.tr ?? sampled.bl ?? sampled.br ?? null
  if (!first) return null

  const colors: AmbientColors = {
    tl: sampled.tl ?? first,
    tr: sampled.tr ?? first,
    bl: sampled.bl ?? first,
    br: sampled.br ?? first,
  }

  const avgLum = lumCount > 0 ? lumSum / lumCount : 128
  return {
    colors,
    brightness: brightnessFromLuminance(avgLum),
  }
}

function readCanvasSample(
  ctx: CanvasRenderingContext2D,
  size: number,
): AmbientSample | null {
  const { data } = ctx.getImageData(0, 0, size, size)
  return colorsFromRegionalImageData(data, size)
}

/**
 * Center and size of the image region visible inside the viewport (viewport-local px).
 */
export function getVisibleImageLayout(
  img: HTMLImageElement,
  viewport: HTMLElement,
): VisibleImageLayout | null {
  const vp = viewport.getBoundingClientRect()
  const ir = img.getBoundingClientRect()
  if (ir.width < 1 || ir.height < 1) return null

  const visLeft = Math.max(vp.left, ir.left)
  const visTop = Math.max(vp.top, ir.top)
  const visRight = Math.min(vp.right, ir.right)
  const visBottom = Math.min(vp.bottom, ir.bottom)
  const visW = visRight - visLeft
  const visH = visBottom - visTop

  if (visW < 2 || visH < 2) {
    return {
      centerX: ir.left + ir.width / 2 - vp.left,
      centerY: ir.top + ir.height / 2 - vp.top,
      width: ir.width,
      height: ir.height,
    }
  }

  return {
    centerX: visLeft + visW / 2 - vp.left,
    centerY: visTop + visH / 2 - vp.top,
    width: visW,
    height: visH,
  }
}

/** Sample soft accent colors from an already-loaded, same-origin image. */
export function sampleAmbientFromImage(img: HTMLImageElement): AmbientSample | null {
  if (!img.naturalWidth || !img.naturalHeight) return null

  const canvas = document.createElement('canvas')
  canvas.width = SAMPLE_SIZE
  canvas.height = SAMPLE_SIZE
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return null

  try {
    ctx.drawImage(img, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE)
    return readCanvasSample(ctx, SAMPLE_SIZE)
  } catch {
    return null
  }
}

/**
 * Sample colors from the portion of the image currently visible in the viewport
 * (updates as the user pans / zooms).
 */
export function sampleAmbientFromVisibleImage(
  img: HTMLImageElement,
  viewport: HTMLElement | null,
): AmbientSample | null {
  if (!img.naturalWidth || !img.naturalHeight) return null
  if (!viewport) return sampleAmbientFromImage(img)

  const vp = viewport.getBoundingClientRect()
  const ir = img.getBoundingClientRect()
  if (ir.width < 1 || ir.height < 1) return sampleAmbientFromImage(img)

  const visLeft = Math.max(vp.left, ir.left)
  const visTop = Math.max(vp.top, ir.top)
  const visRight = Math.min(vp.right, ir.right)
  const visBottom = Math.min(vp.bottom, ir.bottom)
  const visW = visRight - visLeft
  const visH = visBottom - visTop
  if (visW < 2 || visH < 2) return sampleAmbientFromImage(img)

  const sx = img.naturalWidth / ir.width
  const sy = img.naturalHeight / ir.height
  const srcX = (visLeft - ir.left) * sx
  const srcY = (visTop - ir.top) * sy
  const srcW = visW * sx
  const srcH = visH * sy

  const canvas = document.createElement('canvas')
  canvas.width = SAMPLE_SIZE
  canvas.height = SAMPLE_SIZE
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return null

  try {
    ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE)
    return readCanvasSample(ctx, SAMPLE_SIZE)
  } catch {
    return sampleAmbientFromImage(img)
  }
}
