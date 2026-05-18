export type JustifiedGalleryRow<T> = {
  items: T[]
  /** Shared thumbnail band height for this row (px). */
  thumbHeight: number
}

export type JustifiedLayoutOptions = {
  maxCols: number
  containerWidth: number
  gap: number
  targetThumbHeight?: number
  minThumbHeight?: number
  maxThumbHeight?: number
}

const DEFAULT_ASPECT = 4 / 3

export function thumbAspectFromSize(
  width?: number,
  height?: number,
): number {
  if (width && height && height > 0) {
    return Math.max(0.25, Math.min(4, width / height))
  }
  return DEFAULT_ASPECT
}

/**
 * Packs images into rows with a shared height so each thumb shows fully (no crop).
 * Row breaks when cumulative width at the target height fills the container.
 */
export function packJustifiedGalleryRows<T extends { thumbAspect: number }>(
  items: T[],
  {
    maxCols,
    containerWidth,
    gap,
    targetThumbHeight = 300,
    minThumbHeight = 168,
    maxThumbHeight = 520,
  }: JustifiedLayoutOptions,
): JustifiedGalleryRow<T>[] {
  if (items.length === 0 || containerWidth <= 0) return []

  const rows: JustifiedGalleryRow<T>[] = []
  let i = 0

  while (i < items.length) {
    const rowItems: T[] = []
    let aspectSum = 0

    while (i + rowItems.length < items.length) {
      if (rowItems.length >= maxCols) break

      const next = items[i + rowItems.length]!
      const nextAspect = Math.max(0.25, Math.min(4, next.thumbAspect))
      const tryCount = rowItems.length + 1
      const trySum = aspectSum + nextAspect
      const rowWidthAtTarget =
        targetThumbHeight * trySum + gap * Math.max(0, tryCount - 1)

      rowItems.push(next)
      aspectSum = trySum

      if (
        rowWidthAtTarget >= containerWidth * 0.9 ||
        tryCount >= maxCols
      ) {
        break
      }
    }

    const count = rowItems.length
    const isLastRow = i + count >= items.length
    let thumbHeight = (containerWidth - gap * (count - 1)) / aspectSum

    if (isLastRow && count < maxCols) {
      thumbHeight = Math.min(targetThumbHeight, thumbHeight)
    }

    thumbHeight = Math.max(
      minThumbHeight,
      Math.min(maxThumbHeight, thumbHeight),
    )

    rows.push({ items: rowItems, thumbHeight })
    i += count
  }

  return rows
}
