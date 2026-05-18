import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import type {
  CameraEquipmentDetail,
  ResolvedEquipment,
} from '../lib/galleryEquipmentMeta'

type Props = CameraEquipmentDetail & {
  onClose: () => void
}

function EquipmentBlock({
  kicker,
  equipment,
}: {
  kicker: string
  equipment: ResolvedEquipment
}) {
  const makeModel = [equipment.make, equipment.model].filter(Boolean).join(' ')

  return (
    <section className="equipment-modal-block" aria-label={kicker}>
      <p className="equipment-modal-kicker">{kicker}</p>
      {equipment.imageUrl ? (
        <div className="equipment-modal-image-wrap">
          <img
            src={equipment.imageUrl}
            alt=""
            className="equipment-modal-image"
            decoding="async"
          />
        </div>
      ) : null}
      <h3 className="equipment-modal-block-title">{equipment.name}</h3>
      {makeModel ? (
        <p className="equipment-modal-make-model">{makeModel}</p>
      ) : null}
      {equipment.description ? (
        <p className="equipment-modal-description">{equipment.description}</p>
      ) : null}
    </section>
  )
}

export function EquipmentDetailModal({ camera, lens, onClose }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return createPortal(
    <div
      className="equipment-modal-root"
      role="dialog"
      aria-modal="true"
      aria-labelledby="equipment-modal-title"
    >
      <button
        type="button"
        className="equipment-modal-backdrop"
        aria-label="Close equipment details"
        onClick={onClose}
      />
      <div className="equipment-modal-panel" onClick={(e) => e.stopPropagation()}>
        <header className="equipment-modal-header">
          <h2 id="equipment-modal-title" className="equipment-modal-title">
            {camera.name}
          </h2>
          <button
            type="button"
            className="equipment-modal-close"
            aria-label="Close"
            onClick={onClose}
          >
            ×
          </button>
        </header>
        <div className="equipment-modal-body">
          <EquipmentBlock kicker="Camera" equipment={camera} />
          {lens ? <EquipmentBlock kicker="Lens" equipment={lens} /> : null}
        </div>
      </div>
    </div>,
    document.body,
  )
}
