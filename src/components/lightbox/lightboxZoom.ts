export type Pan = { x: number; y: number }

export const MIN_SCALE = 1
export const MAX_SCALE = 8

export function clampScale(s: number): number {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, s))
}

export function applyZoomToward(
  v: { scale: number; pan: Pan },
  ox: number,
  oy: number,
  targetScale: number,
): { scale: number; pan: Pan } {
  const s = clampScale(targetScale)
  if (s <= MIN_SCALE) return { scale: MIN_SCALE, pan: { x: 0, y: 0 } }
  const ratio = s / v.scale
  return {
    scale: s,
    pan: {
      x: ox - (ox - v.pan.x) * ratio,
      y: oy - (oy - v.pan.y) * ratio,
    },
  }
}

export function absoluteAssetUrl(path: string): string {
  if (typeof window === 'undefined') return path
  try {
    return new URL(path, window.location.origin).href
  } catch {
    return path
  }
}
