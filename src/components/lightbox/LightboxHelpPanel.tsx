type Props = {
  open: boolean
  detailsOpen: boolean
  hasAdjacent: boolean
  onClose: () => void
}

export function LightboxHelpPanel({
  open,
  detailsOpen,
  hasAdjacent,
  onClose,
}: Props) {
  if (!open) return null

  return (
    <div
      className="lightbox-help-panel"
      role="dialog"
      aria-label="Keyboard shortcuts"
    >
      <button
        type="button"
        className="lightbox-help-close"
        aria-label="Close shortcuts"
        onClick={onClose}
      >
        ×
      </button>
      <h2 className="lightbox-help-title">Keyboard shortcuts</h2>
      <ul className="lightbox-help-list">
        <li>
          <kbd>Esc</kbd> Close viewer
          {detailsOpen ? ' / details' : ''}
        </li>
        {hasAdjacent ? (
          <li>
            <kbd>←</kbd> <kbd>→</kbd> Previous / next photo
          </li>
        ) : null}
        <li>
          <kbd>+</kbd> <kbd>−</kbd> Zoom in / out
        </li>
        <li>
          <kbd>0</kbd> Reset zoom
        </li>
        <li>
          <kbd>?</kbd> Toggle this help
        </li>
      </ul>
    </div>
  )
}
