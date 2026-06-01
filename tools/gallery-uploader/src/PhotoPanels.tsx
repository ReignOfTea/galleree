import type { ReactNode } from "react"
import { TagsInput } from "./components/TagsInput"
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
  knownTags: readonly string[]
  /** Shown on empty copyright fields (from site.json footer line). */
  copyrightPlaceholder?: string
  selectedIds: ReadonlySet<string>
  onToggleSelect: (id: string, selected: boolean) => void
  updateRow: (id: string, patch: Partial<UploadRow>) => void
  getDestPreview: (r: UploadRow) => { id: string; file: string } | null
  onOpenRegistryCreate: (request: RegistryModalRequest) => void
}

function RegistryFieldRow({
  label,
  select,
  onCreate,
  extra,
}: {
  label: string
  select: ReactNode
  onCreate: () => void
  extra?: ReactNode
}) {
  return (
    <div className="registry-field-block">
      <div className="field-with-action">
        <label className="field field-with-action__field">
          <span>{label}</span>
          {select}
        </label>
        <button type="button" className="ghost field-with-action__btn" onClick={onCreate}>
          New…
        </button>
      </div>
      {extra}
    </div>
  )
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
                {preview ? (
                  <code
                    className={`photo-panel__dest ${r.destExists && !r.editExistingId ? "warn" : ""}`}
                  >
                    {preview.file}
                  </code>
                ) : (
                  <span className="muted photo-panel__dest-pending">
                    Add a title to assign a gallery file id (stays fixed while you edit)
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
                  <TagsInput
                    value={r.tags}
                    knownTags={knownTags}
                    placeholder="photos, travel"
                    onChange={(tags) => updateRow(r.id, { tags })}
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
                    onChange={(e) => {
                      const nextDate = e.target.value
                      const patch: { captureDate: string; captureDateTimeIso?: string } = {
                        captureDate: nextDate,
                      }
                      const iso = r.captureDateTimeIso.trim()
                      if (iso && /^\d{4}-\d{2}-\d{2}T/.test(iso) && nextDate) {
                        patch.captureDateTimeIso = `${nextDate}T${iso.split("T")[1]}`
                      } else if (!nextDate) {
                        patch.captureDateTimeIso = ""
                      }
                      updateRow(r.id, patch)
                    }}
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
                      onChange={(e) => {
                        const slug = e.target.value
                        updateRow(r.id, {
                          collectionSelect: slug,
                          ...(slug === SELECT_NONE ? { collectionSetCover: false } : {}),
                        })
                      }}
                    >
                      <option value={SELECT_NONE}>No collection</option>
                      {registries.collections.map((c) => (
                        <option key={c.slug} value={c.slug}>
                          {c.title}
                        </option>
                      ))}
                    </select>
                  }
                  extra={
                    r.collectionSelect !== SELECT_NONE ? (
                      <div className="collection-cover-option">
                        <label className="field field--inline">
                          <input
                            type="checkbox"
                            checked={r.collectionSetCover}
                            disabled={!r.destId}
                            onChange={(e) =>
                              updateRow(r.id, { collectionSetCover: e.target.checked })
                            }
                          />
                          <span>Make cover photo</span>
                        </label>
                        {!r.destId ? (
                          <p className="collection-cover-option__hint muted">
                            Add a title so this photo gets a gallery id.
                          </p>
                        ) : null}
                      </div>
                    ) : null
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
                        placeholder={copyrightPlaceholder || undefined}
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
