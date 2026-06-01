function num(env: string | undefined, fallback: number): number {
  const n = Number(env)
  return Number.isFinite(n) && n > 0 ? n : fallback
}

export const galleryColumns = num(import.meta.env.VITE_GALLERY_COLUMNS, 2)

export const maxConcurrentImageLoads = num(
  import.meta.env.VITE_MAX_CONCURRENT_IMAGE_LOADS,
  3,
)

/** Above this count, the grid renders in batches while scrolling. */
export const galleryVirtualizeThreshold = num(
  import.meta.env.VITE_GALLERY_VIRTUALIZE_THRESHOLD,
  120,
)

export const galleryVirtualizeInitial = num(
  import.meta.env.VITE_GALLERY_VIRTUALIZE_INITIAL,
  48,
)

export const galleryVirtualizeBatch = num(
  import.meta.env.VITE_GALLERY_VIRTUALIZE_BATCH,
  36,
)
