import type { UploadRow } from "./types"

function basename(p: string): string {
  const s = p.replace(/\\/g, "/")
  const i = s.lastIndexOf("/")
  return i >= 0 ? s.slice(i + 1) : s
}

type Props = {
  rows: UploadRow[]
  updateRow: (id: string, patch: Partial<UploadRow>) => void
  getDestPreview: (r: UploadRow) => string | null
}

export function PhotoPanels({ rows, updateRow, getDestPreview }: Props) {
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
                  <code className={`photo-panel__dest ${r.destExists ? "warn" : ""}`}>{preview}</code>
                ) : (
                  <span className="muted photo-panel__dest-pending">Add a title to preview the filename</span>
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
                    placeholder="Short title for the filename"
                    autoComplete="off"
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
                <label className="field">
                  <span>Camera</span>
                  <input
                    value={r.camera}
                    onChange={(e) => updateRow(r.id, { camera: e.target.value })}
                    placeholder="From EXIF if available"
                    autoComplete="off"
                  />
                </label>
                <label className="field">
                  <span>Event</span>
                  <input
                    value={r.event}
                    onChange={(e) => updateRow(r.id, { event: e.target.value })}
                    autoComplete="off"
                  />
                </label>
              </div>
            </div>
          </details>
        )
      })}
    </div>
  )
}
