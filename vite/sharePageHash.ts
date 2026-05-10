import { createHash } from 'node:crypto'

/** Stable short id for `share/p/<id>.html` — must match build + dev middleware. */
export function galleryShareStubId(filename: string): string {
  return createHash('sha256').update(filename, 'utf8').digest('hex').slice(0, 20)
}
