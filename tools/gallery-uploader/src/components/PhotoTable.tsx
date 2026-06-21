import { Fragment } from "react"
import { PhotoPanelBody } from "./PhotoPanelBody"
import { TagsInput } from "./TagsInput"
import type { GalleryRegistries, RegistryModalRequest } from "../registryTypes"
import { SELECT_NONE } from "../registryTypes"
import type { UploadRow } from "../types"

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
  expandedId: string | null
  onToggleSelect: (id: string, selected: boolean) => void
  onExpand: (id: string | null) => void
  updateRow: (id: string, patch: Partial<UploadRow>) => void
  getDestPreview: (r: UploadRow) => { id: string; file: string } | null
  onOpenRegistryCreate: (request: RegistryModalRequest) => void
  panelRefs: React.MutableRefObject<Map<string, HTMLElement>>
  onReplaceImage: (rowId: string) => void
  onRevertEditImage: (rowId: string) => void
}

export function PhotoTable({
  rows,
  registries,
  knownTags,
  copyrightPlaceholder = "",
  selectedIds,
  expandedId,
  onToggleSelect,
  onExpand,
  updateRow,
  getDestPreview,
  onOpenRegistryCreate,
  panelRefs,
  onReplaceImage,
  onRevertEditImage,
}: Props) {
  return (
    <div className="photo-table-wrap">
      <table className="photo-table">
        <thead>
          <tr>
            <th scope="col" className="photo-table__col-check" />
            <th scope="col" className="photo-table__col-thumb" />
            <th scope="col">Title</th>
            <th scope="col">Description</th>
            <th scope="col">Collection</th>
            <th scope="col">Tags</th>
            <th scope="col" className="photo-table__col-actions" />
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const name = basename(r.sourcePath)
            const titleMissing = !r.title.trim()
            const destOverwrite = r.destExists && !r.editExistingId
            const preview = getDestPreview(r)
            const expanded = expandedId === r.id
            const rowClass = titleMissing
              ? "photo-table__row--warn"
              : destOverwrite
                ? "photo-table__row--overwrite"
                : undefined

            return (
              <Fragment key={r.id}>
                <tr
                  ref={(el) => {
                    if (el) panelRefs.current.set(r.id, el)
                    else panelRefs.current.delete(r.id)
                  }}
                  data-row-id={r.id}
                  data-title-missing={titleMissing ? "true" : undefined}
                  data-dest-overwrite={destOverwrite ? "true" : undefined}
                  className={rowClass}
                >
                  <td>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(r.id)}
                      onChange={(e) => onToggleSelect(r.id, e.target.checked)}
                      aria-label={`Select ${name}`}
                    />
                  </td>
                  <td>
                    <img className="photo-table__thumb" src={r.previewSrc} alt="" />
                  </td>
                  <td>
                    <input
                      className={`photo-table__title${titleMissing ? " photo-table__title--warn" : ""}`}
                      value={r.title}
                      placeholder="Title (required)"
                      onChange={(e) => updateRow(r.id, { title: e.target.value })}
                      autoComplete="off"
                    />
                    <div className="photo-table__meta muted">
                      {preview ? (
                        <>
                          <code className={destOverwrite ? "warn" : ""}>{preview.file}</code>
                          {destOverwrite ? (
                            <span className="photo-table__overwrite-badge">
                              Will replace the existing file in the gallery on upload
                            </span>
                          ) : null}
                        </>
                      ) : (
                        <span>{name}</span>
                      )}
                    </div>
                  </td>
                  <td>
                    <textarea
                      className="photo-table__description"
                      value={r.description}
                      rows={2}
                      placeholder="Optional context"
                      onChange={(e) => updateRow(r.id, { description: e.target.value })}
                    />
                  </td>
                  <td>
                    <select
                      value={r.collectionSelect}
                      onChange={(e) =>
                        updateRow(r.id, {
                          collectionSelect: e.target.value,
                          ...(e.target.value === SELECT_NONE
                            ? { collectionSetCover: false }
                            : {}),
                        })
                      }
                    >
                      <option value={SELECT_NONE}>—</option>
                      {registries.collections.map((c) => (
                        <option key={c.slug} value={c.slug}>
                          {c.title}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <TagsInput
                      value={r.tags}
                      knownTags={knownTags}
                      placeholder="tags"
                      onChange={(tags) => updateRow(r.id, { tags })}
                    />
                  </td>
                  <td>
                    <button
                      type="button"
                      className="ghost photo-table__more"
                      onClick={() => onExpand(expanded ? null : r.id)}
                    >
                      {expanded ? "Less" : "More…"}
                    </button>
                  </td>
                </tr>
                {expanded ? (
                  <tr className="photo-table__detail-row">
                    <td colSpan={7}>
                      <PhotoPanelBody
                        row={r}
                        registries={registries}
                        knownTags={knownTags}
                        copyrightPlaceholder={copyrightPlaceholder}
                        titleMissing={titleMissing}
                        updateRow={updateRow}
                        onOpenRegistryCreate={onOpenRegistryCreate}
                        onReplaceImage={onReplaceImage}
                        onRevertEditImage={onRevertEditImage}
                      />
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
