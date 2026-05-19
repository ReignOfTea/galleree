import { useEffect, type RefObject } from 'react'

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

function getFocusable(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => !el.hasAttribute('disabled') && el.getAttribute('aria-hidden') !== 'true',
  )
}

/** Keep Tab / Shift+Tab inside `container` while `active`. */
export function useFocusTrap(
  containerRef: RefObject<HTMLElement | null>,
  active: boolean,
  options?: { initialFocus?: 'first' | 'container' },
): void {
  useEffect(() => {
    if (!active) return
    const container = containerRef.current
    if (!container) return

    const focusables = getFocusable(container)
    if (options?.initialFocus !== 'container' && focusables.length > 0) {
      focusables[0]?.focus({ preventScroll: true })
    } else {
      container.focus({ preventScroll: true })
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return
      const nodes = getFocusable(container)
      if (nodes.length === 0) {
        e.preventDefault()
        return
      }
      const first = nodes[0]!
      const last = nodes[nodes.length - 1]!
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault()
          last.focus({ preventScroll: true })
        }
      } else if (document.activeElement === last) {
        e.preventDefault()
        first.focus({ preventScroll: true })
      }
    }

    container.addEventListener('keydown', onKeyDown)
    return () => container.removeEventListener('keydown', onKeyDown)
  }, [active, containerRef, options?.initialFocus])
}
