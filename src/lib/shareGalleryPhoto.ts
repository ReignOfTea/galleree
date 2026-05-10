/**
 * Share the gallery image using platform-native flows where possible:
 * - Web Share Level 2: OS share sheet with the actual image file (common on mobile).
 * - Else Web Share with URL + text only.
 * - Else copy image to clipboard (paste into Instagram/X/etc. manually on desktop).
 *
 * Note: Social-site “intent” URLs cannot attach images; file sharing uses the Web Share API.
 */

export type ShareGalleryResult =
  | { ok: true; mode: 'native-files' | 'native-url' | 'clipboard-image' }
  | { ok: false; reason: 'abort' | 'unsupported' | 'error'; message?: string }

function mimeFromFilename(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase()
  if (ext === 'png') return 'image/png'
  if (ext === 'webp') return 'image/webp'
  if (ext === 'gif') return 'image/gif'
  if (ext === 'avif') return 'image/avif'
  return 'image/jpeg'
}

async function fetchImageBlob(imageUrl: string): Promise<Blob> {
  const res = await fetch(imageUrl, { mode: 'cors', credentials: 'omit' })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.blob()
}

async function copyImageBlob(blob: Blob): Promise<boolean> {
  try {
    if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') {
      return false
    }
    const type =
      blob.type && blob.type.startsWith('image/')
        ? blob.type
        : 'image/png'
    await navigator.clipboard.write([new ClipboardItem({ [type]: blob })])
    return true
  } catch {
    return false
  }
}

export async function shareGalleryPhoto(opts: {
  imageUrl: string
  imageFilename: string
  title: string
  text: string
  pageUrl: string
}): Promise<ShareGalleryResult> {
  const { imageUrl, imageFilename, title, text, pageUrl } = opts

  const nav = navigator as Navigator & {
    share?: (data: ShareData & { files?: File[] }) => Promise<void>
    canShare?: (data: { files: File[] }) => boolean
  }

  let blob: Blob | null = null
  try {
    blob = await fetchImageBlob(imageUrl)
  } catch {
    /* leave blob null */
  }

  const mime =
    blob?.type && blob.type.startsWith('image/')
      ? blob.type
      : mimeFromFilename(imageFilename)

  const file =
    blob != null
      ? new File([blob], imageFilename, {
          type: mime,
          lastModified: Date.now(),
        })
      : null

  const combinedText =
    text.includes(pageUrl) || !pageUrl
      ? text
      : `${text}\n${pageUrl}`.trim()

  function filesShareAllowed(): boolean {
    if (!file || !nav.share) return false
    if (typeof nav.canShare !== 'function') return true
    return nav.canShare({ files: [file] })
  }

  try {
    if (filesShareAllowed()) {
      try {
        await nav.share!({
          files: [file!],
          title,
          text: combinedText,
        })
        return { ok: true, mode: 'native-files' }
      } catch (e) {
        if (e instanceof Error && e.name === 'AbortError') {
          return { ok: false, reason: 'abort' }
        }
        /* fall through — try URL-only share */
      }
    }

    if (nav.share) {
      try {
        await nav.share({
          title,
          text: combinedText,
          url: pageUrl || undefined,
        })
        return { ok: true, mode: 'native-url' }
      } catch (e) {
        if (e instanceof Error && e.name === 'AbortError') {
          return { ok: false, reason: 'abort' }
        }
      }
    }
  } catch {
    /* fall through */
  }

  if (blob && (await copyImageBlob(blob))) {
    return { ok: true, mode: 'clipboard-image' }
  }

  return {
    ok: false,
    reason: 'unsupported',
    message:
      'Sharing is not available. Try “Save”, then upload the file from your device.',
  }
}
