import type { EquipmentOpenContext } from './EquipmentCaptionLink'
import type { ResolvedEquipmentRef } from '../lib/galleryEquipmentMeta'

type Props = {
  cameraRef: ResolvedEquipmentRef | null
  lensRef: ResolvedEquipmentRef | null
  onOpen?: (ctx: EquipmentOpenContext) => void
}

export function LightboxEquipmentValue({ cameraRef, lensRef, onOpen }: Props) {
  if (!cameraRef) return <>—</>
  if (cameraRef.hasRegistry && onOpen) {
    return (
      <button
        type="button"
        className="lightbox-equipment-link"
        onClick={() => onOpen({ cameraRef, lensRef })}
      >
        {cameraRef.label}
      </button>
    )
  }
  return <>{cameraRef.label}</>
}
