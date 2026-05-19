import { useLayoutEffect, type RefObject } from 'react'

const VIEWPORT_PAD = 8

/** Keeps a popover panel inside the viewport, aligned to the anchor’s trailing edge. */
export function useViewportAnchoredPopover(
  anchorRef: RefObject<HTMLElement | null>,
  panelRef: RefObject<HTMLElement | null>,
  open: boolean,
) {
  useLayoutEffect(() => {
    if (!open) return
    const anchor = anchorRef.current
    const panel = panelRef.current
    if (!anchor || !panel) return

    const place = () => {
      const anchorRect = anchor.getBoundingClientRect()
      const pad = VIEWPORT_PAD
      const maxW = window.innerWidth - pad * 2

      panel.style.position = 'fixed'
      panel.style.maxWidth = `${maxW}px`
      panel.style.right = 'auto'

      const panelWidth = panel.getBoundingClientRect().width
      let left = anchorRect.right - panelWidth
      left = Math.max(pad, Math.min(left, window.innerWidth - panelWidth - pad))

      const panelHeight = panel.getBoundingClientRect().height
      let top = anchorRect.bottom + 6
      if (top + panelHeight > window.innerHeight - pad) {
        top = Math.max(pad, anchorRect.top - panelHeight - 6)
      }

      panel.style.left = `${left}px`
      panel.style.top = `${top}px`
      panel.dataset.viewportAnchored = ''
    }

    place()
    const ro = new ResizeObserver(place)
    ro.observe(panel)
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)

    return () => {
      ro.disconnect()
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
      panel.style.position = ''
      panel.style.left = ''
      panel.style.top = ''
      panel.style.right = ''
      panel.style.maxWidth = ''
      delete panel.dataset.viewportAnchored
    }
  }, [open, anchorRef, panelRef])
}
