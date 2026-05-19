import sharp from 'sharp'

/** Encode a 4×4 BlurHash from an image file (uses a small resize for speed). */
export async function blurHashFromImagePath(
  filePath: string,
): Promise<string | null> {
  try {
    const { encode } = await import('blurhash')
    const { data, info } = await sharp(filePath)
      .rotate()
      .resize(32, 32, { fit: 'inside' })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true })
    const w = info.width
    const h = info.height
    if (!w || !h) return null
    return encode(new Uint8ClampedArray(data), w, h, 4, 4)
  } catch {
    return null
  }
}
