import type { ReactNode } from "react"
import type { GalleryRegistries, RegistryModalRequest } from "./registryTypes"
import { SELECT_CUSTOM, SELECT_NONE } from "./registryTypes"
import type { UploadRow } from "./types"

function basename(p: string): string {
  const s = p.replace(/\\/g, "/")
  const i = s.lastIndexOf("/")
  return i >= 0 ? s.slice(i + 1) : s
}

type Props = {
  rows: UploadRow[]
  registries: GalleryRegistries
  updateRow: (id: string, patch: Partial<UploadRow>) => void
  getDestPreview: (r: UploadRow) => { id: string; file: string } | null
  onOpenRegistryCreate: (request: RegistryModalRequest) => void
}

function RegistryFieldRow({
  label,
  select,
  onCreate,
}: {
  label: string
  select: ReactNode
  onCreate: () => void
}) {
  return (
    <div className="field-with-action">
      <label className="field field-with-action__field">
        <span>{label}</span>
        {select}
      </label>
      <button type="button" className="ghost field-with-action__btn" onClick={onCreate}>
        New…
      </button>
    </div>
  )
}

export function PhotoPanels({
  rows,
  registries,
  updateRow,
  getDestPreview,
  onOpenRegistryCreate,
}: Props) {
  return (
    <div className="photo-panels">
      {rows.map((r) => {
        const name = basename(r.sourcePath)
        const titleMissing = !r.title.trim()
        const preview = getDestPreview(r)

        return (
          <details key={r.id} className="photo-panel">
            <summary className="photo-panel__summary">
              <span className="photo-panel__summary-thumb-wrap">
                <img className="photo-panel__summary-thumb" src={r.previewSrc} alt="" />
              </span>
              <span className="photo-panel__summary-text">
                <span className="photo-panel__filename">{name}</span>
                {titleMissing ? (
                  <span className="photo-panel__badge photo-panel__badge--warn">Title required</span>
                ) : null}
                {preview ? (
                  <code className={`photo-panel__dest ${r.destExists ? "warn" : ""}`}>
                    {preview.file}
                  </code>
                ) : (
                  <span className="muted photo-panel__dest-pending">
                    Add a title to assign a gallery id
                  </span>
                )}
              </span>
            </summary>
            <div className="photo-panel__body">
              <div className="photo-panel__preview">
                <img src={r.previewSrc} alt="" />
              </div>
              <div className="photo-panel__fields">
                <label className={`field ${titleMissing ? "field--warn" : ""}`}>
                  <span>Title (required)</span>
                  <input
                    value={r.title}
                    onChange={(e) => updateRow(r.id, { title: e.target.value })}
                    placeholder="Short title"
                    autoComplete="off"
                  />
                </label>
                <label className="field">
                  <span>Description</span>
                  <textarea
                    value={r.description}
                    onChange={(e) => updateRow(r.id, { description: e.target.value })}
                    placeholder="Optional context for the lightbox and search"
                    rows={2}
                  />
                </label>
                <label className="field">
                  <span>Tags (comma-separated)</span>
                  <input
                    value={r.tags}
                    onChange={(e) => updateRow(r.id, { tags: e.target.value })}
                    placeholder="photos, travel"
                    autoComplete="off"
                  />
                </label>
                <label className="field">
                  <span>Location</span>
                  <input
                    value={r.location}
                    onChange={(e) => updateRow(r.id, { location: e.target.value })}
                    placeholder="City, UK"
                    autoComplete="off"
                  />
                </label>
                <label className="field">
                  <span>Date (optional)</span>
                  <input
                    type="date"
                    value={r.captureDate}
                    onChange={(e) => updateRow(r.id, { captureDate: e.target.value })}
                  />
                </label>

                <RegistryFieldRow
                  label="Collection"
                  onCreate={() =>
                    onOpenRegistryCreate({
                      kind: "collection",
                      rowId: r.id,
                      field: "collectionSelect",
                    })
                  }
                  select={
                    <select
                      value={r.collectionSelect}
                      onChange={(e) =>
                        updateRow(r.id, { collectionSelect: e.target.value })
                      }
                    >
                      <option value={SELECT_NONE}>No collection</option>
                      {registries.collections.map((c) => (
                        <option key={c.slug} value={c.slug}>
                          {c.title}
                        </option>
                      ))}
                    </select>
                  }
                />

                <RegistryFieldRow
                  label="Camera"
                  onCreate={() =>
                    onOpenRegistryCreate({
                      kind: "camera",
                      rowId: r.id,
                      field: "cameraSelect",
                    })
                  }
                  select={
                    <select
                      value={r.cameraSelect}
                      onChange={(e) => updateRow(r.id, { cameraSelect: e.target.value })}
                    >
                      <option value={SELECT_NONE}>Not set</option>
                      {registries.cameras.map((c) => (
                        <option key={c.slug} value={c.slug}>
                          {c.name}
                        </option>
                      ))}
                      <option value={SELECT_CUSTOM}>Custom label…</option>
                    </select>
                  }
                />
                {r.cameraSelect === SELECT_CUSTOM ? (
                  <label className="field">
                    <span>Camera label</span>
                    <input
                      value={r.cameraCustom}
                      onChange={(e) => updateRow(r.id, { cameraCustom: e.target.value })}
                      placeholder="Free text if not in registry"
                      autoComplete="off"
                    />
                  </label>
                ) : null}

                <RegistryFieldRow
                  label="Lens"
                  onCreate={() =>
                    onOpenRegistryCreate({
                      kind: "lens",
                      rowId: r.id,
                      field: "lensSelect",
                    })
                  }
                  select={
                    <select
                      value={r.lensSelect}
                      onChange={(e) => updateRow(r.id, { lensSelect: e.target.value })}
                    >
                      <option value={SELECT_NONE}>Not set</option>
                      {registries.lenses.map((l) => (
                        <option key={l.slug} value={l.slug}>
                          {l.name}
                        </option>
                      ))}
                      <option value={SELECT_CUSTOM}>Custom label…</option>
                    </select>
                  }
                />
                {r.lensSelect === SELECT_CUSTOM ? (
                  <label className="field">
                    <span>Lens label</span>
                    <input
                      value={r.lensCustom}
                      onChange={(e) => updateRow(r.id, { lensCustom: e.target.value })}
                      placeholder="Free text if not in registry"
                      autoComplete="off"
                    />
                  </label>
                ) : null}

                <details className="photo-panel__more">
                  <summary>More metadata</summary>
                  <div className="photo-panel__more-fields">
                    <label className="field">
                      <span>Alt text</span>
                      <input
                        value={r.alt}
                        onChange={(e) => updateRow(r.id, { alt: e.target.value })}
                        placeholder="Accessibility description"
                        autoComplete="off"
                      />
                    </label>
                    <label className="field field--inline">
                      <input
                        type="checkbox"
                        checked={r.hidden}
                        onChange={(e) => updateRow(r.id, { hidden: e.target.checked })}
                      />
                      <span>Hidden (upload but do not show on site)</span>
                    </label>
                    <label className="field">
                      <span>Sort order</span>
                      <input
                        type="number"
                        value={r.sortOrder}
                        onChange={(e) => updateRow(r.id, { sortOrder: e.target.value })}
                        placeholder="Lower = earlier when dates match"
                      />
                    </label>
                    <label className="field">
                      <span>Copyright</span>
                      <input
                        value={r.copyright}
                        onChange={(e) => updateRow(r.id, { copyright: e.target.value })}
                        autoComplete="off"
                      />
                    </label>
                  </div>
                </details>
              </div>
            </div>
          </details>
        )
      })}
    </div>
  )
}
