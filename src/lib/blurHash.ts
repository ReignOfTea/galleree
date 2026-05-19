import { decode } from 'blurhash'

/** Tiny data URL for use as a CSS background while thumbnails load. */
export function blurHashToDataUrl(
  hash: string,
  width = 32,
  height = 32,
): string {
  const pixels = decode(hash, width, height)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return ''
  const imageData = ctx.createImageData(width, height)
  imageData.data.set(pixels)
  ctx.putImageData(imageData, 0, 0)
  return canvas.toDataURL()
}
