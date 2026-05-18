const ALLOWED_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif', '.gif'])

export function isAllowedImagePath(filePath: string): boolean {
  const lower = filePath.toLowerCase()
  const dot = lower.lastIndexOf('.')
  if (dot < 0) return false
  return ALLOWED_EXT.has(lower.slice(dot))
}

export function normalizeExtensionFromPath(filePath: string): string {
  const lower = filePath.toLowerCase()
  const dot = lower.lastIndexOf('.')
  const ext = dot >= 0 ? lower.slice(dot) : '.jpg'
  return ALLOWED_EXT.has(ext) ? ext : '.jpg'
}
