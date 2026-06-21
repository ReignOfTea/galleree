import { formatUploadSummary, buildUploadSummary } from "../lib/uploadSummary"
import type { GalleryRegistries } from "../registryTypes"
import type { UploadRow } from "../types"

type Props = {
  rows: UploadRow[]
  registries: GalleryRegistries
  allTitlesOk: boolean
}

export function UploadSummaryStrip({ rows, registries, allTitlesOk }: Props) {
  if (rows.length === 0) return null
  const summary = buildUploadSummary(rows, registries)
  const text = formatUploadSummary(summary)

  return (
    <div
      className={`upload-summary${allTitlesOk ? " upload-summary--ready" : " upload-summary--warn"}`}
      role="status"
    >
      <strong>Ready to upload:</strong> {text}
      {!allTitlesOk ? (
        <span className="upload-summary__hint">
          {" "}
          — add titles for every photo before uploading.
        </span>
      ) : null}
    </div>
  )
}
