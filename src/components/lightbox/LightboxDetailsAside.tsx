import type { GalleryEntry } from '../../hooks/useGalleryManifest'
import type { ExifDisplayRow } from '../../lib/exifDisplay'
import { formatCaptureDate } from '../../lib/galleryLabels'
import type { EquipmentOpenContext } from '../EquipmentCaptionLink'
import { LightboxEquipmentValue } from '../LightboxEquipmentValue'
import {
  DetailCollectionPeers,
  DetailField,
  DetailTagChips,
} from './LightboxDetailsFields'
import { IconClose } from './LightboxIcons'

type Props = {
  photo: GalleryEntry
  exifRows: ExifDisplayRow[]
  selectedTagSet: ReadonlySet<string>
  collectionPeers: GalleryEntry[]
  onClose: () => void
  onEquipmentOpen?: (ctx: EquipmentOpenContext) => void
  onOpenCollectionPeer?: (entry: GalleryEntry) => void
  onToggleTag?: (tag: string) => void
}

export function LightboxDetailsAside({
  photo,
  exifRows,
  selectedTagSet,
  collectionPeers,
  onClose,
  onEquipmentOpen,
  onOpenCollectionPeer,
  onToggleTag,
}: Props) {
  const detailTags = photo.tags.filter((t) => t !== photo.locationDisplay)
  const filenameDateLong =
    photo.capturedAt != null
      ? formatCaptureDate(
          photo.capturedAt,
          photo.capturedAtIsDateOnly,
          'detailsLong',
        )
      : null

  return (
    <>
      <button
        type="button"
        className="lightbox-details-scrim"
        aria-label="Close details panel"
        onClick={onClose}
      />
      <aside
        id="lightbox-details-panel"
        className="lightbox-details-panel"
        role="complementary"
        aria-labelledby="lightbox-details-heading"
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="lightbox-details-panel-header">
          <h2 id="lightbox-details-heading" className="lightbox-details-heading">
            Photo details
          </h2>
          <button
            type="button"
            className="lightbox-details-close"
            onClick={onClose}
            aria-label="Close details"
          >
            <IconClose className="lightbox-tool-icon-svg" />
          </button>
        </div>
        <div className="lightbox-details-body">
          <section
            className="lightbox-details-section lightbox-details-section-card"
            aria-labelledby="lightbox-details-meta"
          >
            <h3
              id="lightbox-details-meta"
              className="lightbox-details-section-title"
            >
              Gallery metadata
            </h3>
            <div className="lightbox-details-fields">
              <DetailField label="Title" wide>
                {photo.displayTitle}
              </DetailField>
              {photo.description?.trim() ? (
                <DetailField label="Description" wide>
                  {photo.description}
                </DetailField>
              ) : null}
              <DetailField label="Tags" wide>
                <DetailTagChips
                  tags={detailTags}
                  selectedTags={selectedTagSet}
                  onToggleTag={onToggleTag}
                />
              </DetailField>
              <DetailField label="Location">{photo.locationDisplay}</DetailField>
              <DetailField
                label={photo.capturedAtIsDateOnly ? 'Date' : 'Date & time'}
              >
                {filenameDateLong}
              </DetailField>
              <DetailField label="Camera">
                <LightboxEquipmentValue
                  cameraRef={photo.cameraRef}
                  lensRef={photo.lensRef}
                  onOpen={onEquipmentOpen}
                />
              </DetailField>
              <DetailField label="Collection">{photo.eventLabel}</DetailField>
              {photo.alt ? (
                <DetailField label="Alt text" wide>
                  {photo.alt}
                </DetailField>
              ) : null}
              {photo.copyright ? (
                <DetailField label="Copyright" wide>
                  {photo.copyright}
                </DetailField>
              ) : null}
            </div>
          </section>

          {collectionPeers.length > 0 && onOpenCollectionPeer ? (
            <DetailCollectionPeers
              peers={collectionPeers}
              onSelect={onOpenCollectionPeer}
            />
          ) : null}

          <section
            className="lightbox-details-section lightbox-details-section-card"
            aria-labelledby="lightbox-details-exif"
          >
            <h3
              id="lightbox-details-exif"
              className="lightbox-details-section-title"
            >
              Technical
            </h3>
            {exifRows.length === 0 ? (
              <p className="lightbox-details-muted">
                No technical metadata stored for this photo. Rebuild the site after
                adding images to populate it.
              </p>
            ) : null}
            {exifRows.length > 0 ? (
              <div className="lightbox-details-exif-grid">
                {exifRows.map((row, i) => (
                  <div
                    key={`${row.label}-${i}`}
                    className="lightbox-details-exif-item"
                  >
                    <span className="lightbox-details-exif-label">
                      {row.label}
                    </span>
                    <span className="lightbox-details-exif-value">
                      {row.value}
                    </span>
                  </div>
                ))}
              </div>
            ) : null}
          </section>
        </div>
      </aside>
    </>
  )
}
