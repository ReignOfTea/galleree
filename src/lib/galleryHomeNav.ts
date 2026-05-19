/** Fired when the user resets to the main gallery (e.g. logo click). */
export const GALLERY_HOME_NAV_EVENT = 'galleree:gallery-home'

export function dispatchGalleryHomeNav(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(GALLERY_HOME_NAV_EVENT))
}
