import { useMemo } from 'react'
import { blurHashToDataUrl } from '../lib/blurHash'

type Props = {
  blurHash: string | null | undefined
  className?: string
}

export function GalleryBlurPlaceholder({ blurHash, className }: Props) {
  const style = useMemo(() => {
    if (!blurHash) return undefined
    const url = blurHashToDataUrl(blurHash, 32, 32)
    if (!url) return undefined
    return {
      backgroundImage: `url(${url})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
    } as const
  }, [blurHash])

  return (
    <div
      className={['gallery-skeleton', className].filter(Boolean).join(' ')}
      style={style}
      aria-hidden
    />
  )
}
