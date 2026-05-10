/** `#photo=` fragment or `?photo=` query — filename must match manifest `file`. */

export function parsePhotoFromLocation(): string | null {
  if (typeof window === 'undefined') return null
  const url = new URL(window.location.href)
  if (url.hash.startsWith('#photo=')) {
    try {
      return decodeURIComponent(url.hash.slice(7))
    } catch {
      return null
    }
  }
  const q = url.searchParams.get('photo')
  if (!q) return null
  try {
    return decodeURIComponent(q)
  } catch {
    return q
  }
}

export function photoIsInLocation(): boolean {
  return parsePhotoFromLocation() !== null
}

export function setPhotoInLocation(file: string): void {
  const url = new URL(window.location.href)
  url.searchParams.delete('photo')
  url.hash = `photo=${encodeURIComponent(file)}`
  window.history.replaceState(
    null,
    '',
    `${url.pathname}${url.search}${url.hash}`,
  )
}

export function clearPhotoFromLocation(): void {
  const url = new URL(window.location.href)
  url.hash = ''
  url.searchParams.delete('photo')
  window.history.replaceState(null, '', `${url.pathname}${url.search}`)
}
