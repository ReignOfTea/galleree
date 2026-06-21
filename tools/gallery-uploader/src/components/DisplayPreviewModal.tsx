import { useCallback, useEffect, useState } from "react"
import { appConvertFileSrc, appInvoke } from "../tauriBridge"
import type { UploadRow } from "../types"

type Props = {
  rows: UploadRow[]
  startIndex?: number
  onClose: () => void
}

export function DisplayPreviewModal({ rows, startIndex = 0, onClose }: Props) {
  const [index, setIndex] = useState(startIndex)
  const [src, setSrc] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const row = rows[index]

  const loadPreview = useCallback(async (path: string) => {
    setLoading(true)
    setError(null)
    try {
      const previewPath = await appInvoke<string>("ensure_display_preview", { path })
      setSrc(appConvertFileSrc(previewPath))
    } catch (e) {
      setSrc(null)
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!row) return
    void loadPreview(row.sourcePath)
  }, [row, loadPreview])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
      if (e.key === "ArrowLeft") setIndex((i) => Math.max(0, i - 1))
      if (e.key === "ArrowRight") setIndex((i) => Math.min(rows.length - 1, i + 1))
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose, rows.length])

  if (!row) return null

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="display-preview-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Display preview"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="display-preview-modal__header">
          <div>
            <strong>{row.title.trim() || "Untitled"}</strong>
            <span className="muted display-preview-modal__counter">
              {index + 1} / {rows.length}
            </span>
          </div>
          <button type="button" className="ghost" onClick={onClose}>
            Close
          </button>
        </header>
        <div className="display-preview-modal__body">
          {loading ? <p className="muted">Generating display preview…</p> : null}
          {error ? <p className="display-preview-modal__error">{error}</p> : null}
          {src && !loading ? (
            <img className="display-preview-modal__img" src={src} alt={row.title || ""} />
          ) : null}
        </div>
        <footer className="display-preview-modal__footer">
          <button
            type="button"
            className="ghost"
            disabled={index <= 0}
            onClick={() => setIndex((i) => i - 1)}
          >
            Previous
          </button>
          <button
            type="button"
            className="ghost"
            disabled={index >= rows.length - 1}
            onClick={() => setIndex((i) => i + 1)}
          >
            Next
          </button>
        </footer>
      </div>
    </div>
  )
}
