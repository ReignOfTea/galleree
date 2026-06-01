type FsDocument = Document & {
  webkitFullscreenElement?: Element | null
  webkitExitFullscreen?: () => Promise<void>
  mozFullScreenElement?: Element | null
  mozCancelFullScreen?: () => Promise<void>
  msFullscreenElement?: Element | null
  msExitFullscreen?: () => Promise<void>
}

type FsElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void
  mozRequestFullScreen?: () => Promise<void> | void
  msRequestFullscreen?: () => Promise<void> | void
}

export function getFullscreenElement(): Element | null {
  const d = document as FsDocument
  return (
    document.fullscreenElement ??
    d.webkitFullscreenElement ??
    d.mozFullScreenElement ??
    d.msFullscreenElement ??
    null
  )
}

export function exitFullscreenDocument(): void {
  const d = document as FsDocument
  const p =
    document.exitFullscreen?.() ??
    d.webkitExitFullscreen?.() ??
    d.mozCancelFullScreen?.() ??
    d.msExitFullscreen?.()
  void p?.catch(() => {})
}

/** Must run synchronously inside a click/key handler — no await before this. */
export function enterFullscreenElement(el: HTMLElement): void {
  const node = el as FsElement
  const p =
    node.requestFullscreen?.() ??
    node.webkitRequestFullscreen?.() ??
    node.mozRequestFullScreen?.() ??
    node.msRequestFullscreen?.()
  if (p && typeof (p as Promise<void>).catch === 'function') {
    void (p as Promise<void>).catch(() => {})
  }
}
