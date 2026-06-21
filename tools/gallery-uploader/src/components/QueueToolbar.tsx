import type { ViewMode } from "../lib/queueUi"

type Props = {
  rowCount: number
  viewMode: ViewMode
  disabled?: boolean
  onViewModeChange: (mode: ViewMode) => void
  onSortByCaptureDate: () => void
  onJumpToMissingTitle: () => void
  onOpenDisplayPreview: () => void
}

export function QueueToolbar({
  rowCount,
  viewMode,
  disabled,
  onViewModeChange,
  onSortByCaptureDate,
  onJumpToMissingTitle,
  onOpenDisplayPreview,
}: Props) {
  if (rowCount === 0) return null

  return (
    <div className="queue-toolbar">
      <div className="queue-toolbar__group">
        <span className="queue-toolbar__label muted">View</span>
        <button
          type="button"
          className={viewMode === "compact" ? "" : "ghost"}
          disabled={disabled}
          onClick={() => onViewModeChange("compact")}
        >
          Table
        </button>
        <button
          type="button"
          className={viewMode === "accordion" ? "" : "ghost"}
          disabled={disabled}
          onClick={() => onViewModeChange("accordion")}
        >
          Panels
        </button>
      </div>
      <div className="queue-toolbar__group">
        <button type="button" className="ghost" disabled={disabled} onClick={onSortByCaptureDate}>
          Sort by capture date
        </button>
        <button type="button" className="ghost" disabled={disabled} onClick={onJumpToMissingTitle}>
          Next missing title
        </button>
        <button type="button" className="ghost" disabled={disabled} onClick={onOpenDisplayPreview}>
          Display preview…
        </button>
      </div>
    </div>
  )
}
