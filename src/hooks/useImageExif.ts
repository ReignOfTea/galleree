import { useEffect, useState } from 'react'
import exifr from 'exifr'
import { exifToDisplayRows, type ExifDisplayRow } from '../lib/exifDisplay'

export type ImageExifState =
  | { status: 'idle' | 'loading' }
  | { status: 'ok'; rows: ExifDisplayRow[] }
  | { status: 'error'; message: string }

export function useImageExif(url: string | null): ImageExifState {
  const [state, setState] = useState<ImageExifState | undefined>(undefined)

  useEffect(() => {
    if (!url) return

    let cancelled = false
    ;(async () => {
      try {
        const raw = await exifr.parse(url, {
          iptc: true,
          xmp: true,
          jfif: true,
          mergeOutput: true,
          reviveValues: true,
        })
        if (cancelled) return
        if (!raw || typeof raw !== 'object') {
          setState({ status: 'ok', rows: [] })
          return
        }
        const rows = exifToDisplayRows(raw as Record<string, unknown>)
        setState({ status: 'ok', rows })
      } catch (e) {
        if (!cancelled) {
          setState({
            status: 'error',
            message: e instanceof Error ? e.message : 'Could not read image metadata',
          })
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [url])

  if (!url) return { status: 'idle' }
  if (state === undefined) return { status: 'loading' }
  return state
}
