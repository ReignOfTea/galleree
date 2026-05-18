function num(env: string | undefined, fallback: number): number {
  const n = Number(env)
  return Number.isFinite(n) && n > 0 ? n : fallback
}

export const galleryColumns = num(import.meta.env.VITE_GALLERY_COLUMNS, 2)

export const maxConcurrentImageLoads = num(
  import.meta.env.VITE_MAX_CONCURRENT_IMAGE_LOADS,
  3,
)
