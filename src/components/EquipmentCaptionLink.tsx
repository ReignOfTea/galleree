import type { ResolvedEquipmentRef } from '../lib/galleryEquipmentMeta'

export type EquipmentOpenContext = {
  cameraRef: ResolvedEquipmentRef
  lensRef: ResolvedEquipmentRef | null
}

type Props = {
  cameraRef: ResolvedEquipmentRef | null
  lensRef: ResolvedEquipmentRef | null
  onOpen?: (ctx: EquipmentOpenContext) => void
}

export function EquipmentCaptionLink({ cameraRef, lensRef, onOpen }: Props) {
  if (!cameraRef) return null

  if (cameraRef.hasRegistry && onOpen) {
    return (
      <button
        type="button"
        className="gallery-caption-equipment"
        onClick={() => onOpen({ cameraRef, lensRef })}
      >
        {cameraRef.label}
      </button>
    )
  }

  return <span>{cameraRef.label}</span>
}
