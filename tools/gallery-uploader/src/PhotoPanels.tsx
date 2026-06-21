import { PhotoPanelBody } from "./components/PhotoPanelBody"
import type { GalleryRegistries, RegistryModalRequest } from "./registryTypes"
import type { UploadRow } from "./types"

function basename(p: string): string {
  const s = p.replace(/\\/g, "/")
  const i = s.lastIndexOf("/")
  return i >= 0 ? s.slice(i + 1) : s
}

type Props = {
  rows: UploadRow[]
  registries: GalleryRegistries
  knownTags: readonly string[]
  copyrightPlaceholder?: string
  selectedIds: ReadonlySet<string>
  onToggleSelect: (id: string, selected: boolean) => void
  updateRow: (id: string, patch: Partial<UploadRow>) => void
  getDestPreview: (r: UploadRow) => { id: string; file: string } | null
  onOpenRegistryCreate: (request: RegistryModalRequest) => void
  panelRefs: React.MutableRefObject<Map<string, HTMLElement>>
}

export function PhotoPanels({
  rows,
  registries,
  knownTags,
  copyrightPlaceholder = "",
  selectedIds,
  onToggleSelect,
  updateRow,
  getDestPreview,
  onOpenRegistryCreate,
  panelRefs,
}: Props) {
  return (
    <div className="photo-panels">
      {rows.map((r) => {
        const name = basename(r.sourcePath)
        const titleMissing = !r.title.trim()
        const destClash = r.destExists && !r.editExistingId
        const preview = getDestPreview(r)

        return (
          <details
            key={r.id}
            ref={(el) => {
              if (el) panelRefs.current.set(r.id, el)
              else panelRefs.current.delete(r.id)
            }}
            data-row-id={r.id}
            data-title-missing={titleMissing ? "true" : undefined}
            data-dest-clash={destClash ? "true" : undefined}
            className={`photo-panel${destClash ? " photo-panel--clash" : ""}`}
          >
            <summary className="photo-panel__summary">
              <label
                className="photo-panel__select"
                onClick={(e) => e.stopPropagation()}
              >
                <input
                  type="checkbox"
                  checked={selectedIds.has(r.id)}
                  onChange={(e) => onToggleSelect(r.id, e.target.checked)}
                  aria-label={`Select ${name}`}
                />
              </label>
              <span className="photo-panel__summary-thumb-wrap">
                <img className="photo-panel__summary-thumb" src={r.previewSrc} alt="" />
              </span>
              <span className="photo-panel__summary-text">
                <span className="photo-panel__filename">{name}</span>
                {r.editExistingId ? (
                  <span className="photo-panel__badge">Editing</span>
                ) : null}
                {titleMissing ? (
                  <span className="photo-panel__badge photo-panel__badge--warn">Title required</span>
                ) : null}
                {destClash ? (
                  <span className="photo-panel__badge photo-panel__badge--clash">
                    Already in gallery
                  </span>
                ) : null}
                {preview ? (
                  <code className={`photo-panel__dest ${destClash ? "warn" : ""}`}>
                    {preview.file}
                  </code>
                ) : (
                  <span className="muted photo-panel__dest-pending">
                    Add a title to assign a gallery file id (stays fixed while you edit)
                  </span>
                )}
              </span>
            </summary>
            <PhotoPanelBody
              row={r}
              registries={registries}
              knownTags={knownTags}
              copyrightPlaceholder={copyrightPlaceholder}
              titleMissing={titleMissing}
              updateRow={updateRow}
              onOpenRegistryCreate={onOpenRegistryCreate}
            />
          </details>
        )
      })}
    </div>
  )
}
