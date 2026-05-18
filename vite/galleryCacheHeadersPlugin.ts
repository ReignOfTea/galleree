import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Plugin } from 'vite'

const ONE_WEEK_SECONDS = 60 * 60 * 24 * 7
const GALLERY_CACHE_CONTROL = `public, max-age=${ONE_WEEK_SECONDS}, stale-while-revalidate=86400`

function galleryCacheMiddleware(
  req: IncomingMessage,
  res: ServerResponse,
  next: (err?: unknown) => void,
): void {
  const url = req.url?.split('?')[0] ?? ''
  if (
    url.includes('/gallery/') &&
    !url.endsWith('.json') &&
    !url.includes('/meta/')
  ) {
    res.setHeader('Cache-Control', GALLERY_CACHE_CONTROL)
  }
  next()
}

/** Sets week-long HTTP caching for gallery images in dev and preview. */
export function galleryCacheHeadersPlugin(): Plugin {
  return {
    name: 'gallery-cache-headers',
    configureServer(server) {
      server.middlewares.use(galleryCacheMiddleware)
    },
    configurePreviewServer(server) {
      server.middlewares.use(galleryCacheMiddleware)
    },
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: '_headers',
        source: [
          '/gallery/*',
          `  Cache-Control: ${GALLERY_CACHE_CONTROL}`,
          '',
        ].join('\n'),
      })
    },
  }
}
