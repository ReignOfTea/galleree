type SavedStyles = {
  htmlOverflow: string
  bodyOverflow: string
  bodyPaddingRight: string
  compensatePx: string
}

let lockCount = 0
let saved: SavedStyles | null = null

function measureScrollbarWidth(): number {
  return Math.max(0, window.innerWidth - document.documentElement.clientWidth)
}

/**
 * Prevent background scroll without shifting layout when the scrollbar disappears.
 * Ref-counted so nested modals (lightbox + filters) can share one lock.
 */
export function lockBodyScroll(): () => void {
  if (lockCount === 0) {
    const scrollbarWidth = measureScrollbarWidth()
    saved = {
      htmlOverflow: document.documentElement.style.overflow,
      bodyOverflow: document.body.style.overflow,
      bodyPaddingRight: document.body.style.paddingRight,
      compensatePx: document.documentElement.style.getPropertyValue(
        '--scrollbar-compensate',
      ),
    }

    document.documentElement.style.overflow = 'hidden'
    document.body.style.overflow = 'hidden'

    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`
      document.documentElement.style.setProperty(
        '--scrollbar-compensate',
        `${scrollbarWidth}px`,
      )
    }
  }

  lockCount++

  return () => {
    lockCount = Math.max(0, lockCount - 1)
    if (lockCount !== 0 || !saved) return

    document.documentElement.style.overflow = saved.htmlOverflow
    document.body.style.overflow = saved.bodyOverflow
    document.body.style.paddingRight = saved.bodyPaddingRight

    if (saved.compensatePx) {
      document.documentElement.style.setProperty(
        '--scrollbar-compensate',
        saved.compensatePx,
      )
    } else {
      document.documentElement.style.removeProperty('--scrollbar-compensate')
    }

    saved = null
  }
}
