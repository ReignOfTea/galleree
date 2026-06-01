import type { RefObject } from 'react'
import type { GalleryEntry } from '../../hooks/useGalleryManifest'
import {
  AMBIENT_INTENSITY_MAX,
  AMBIENT_INTENSITY_MIN,
  prefersAmbientOffByDefault,
} from '../../lib/lightboxAmbient'
import {
  IconDownload,
  IconFullscreen,
  IconInfo,
  IconShare,
} from './LightboxIcons'

type Props = {
  photo: GalleryEntry
  metaParts: string[]
  zoomPercent: number
  shareOpen: boolean
  detailsOpen: boolean
  ambientOn: boolean
  ambientIntensity: number
  closeBtnRef: RefObject<HTMLButtonElement | null>
  shareBtnRef: RefObject<HTMLButtonElement | null>
  sharePanelRef: RefObject<HTMLDivElement | null>
  settingsDetailsRef: RefObject<HTMLDetailsElement | null>
  settingsTriggerRef: RefObject<HTMLElement | null>
  settingsPanelRef: RefObject<HTMLDivElement | null>
  onClose: () => void
  onZoomOut: () => void
  onZoomIn: () => void
  onResetView: () => void
  onShareToggle: () => void
  onShareSocials: () => void
  onCopyImageLink: () => void
  onCopyPageLink: () => void
  onCopyCollectionLink: () => void
  hasCollectionLink: boolean
  onFullscreen: () => void
  onDetailsToggle: () => void
  onAmbientChange: (enabled: boolean) => void
  onAmbientIntensityChange: (value: number) => void
}

export function LightboxToolbar({
  photo,
  metaParts,
  zoomPercent,
  shareOpen,
  detailsOpen,
  ambientOn,
  ambientIntensity,
  closeBtnRef,
  shareBtnRef,
  sharePanelRef,
  settingsDetailsRef,
  settingsTriggerRef,
  settingsPanelRef,
  onClose,
  onZoomOut,
  onZoomIn,
  onResetView,
  onShareToggle,
  onShareSocials,
  onCopyImageLink,
  onCopyPageLink,
  onCopyCollectionLink,
  hasCollectionLink,
  onFullscreen,
  onDetailsToggle,
  onAmbientChange,
  onAmbientIntensityChange,
}: Props) {
  return (
    <header className="lightbox-toolbar">
      <div className="lightbox-toolbar-cluster lightbox-toolbar-start">
        <button
          ref={closeBtnRef}
          type="button"
          className="lightbox-tool-icon"
          onClick={onClose}
          aria-label="Close"
        >
          <span aria-hidden="true">×</span>
        </button>
        <div className="lightbox-title-stack">
          <p id="lightbox-title" className="lightbox-title lightbox-title-primary">
            {photo.displayTitle ?? photo.file}
          </p>
          {metaParts.length > 0 ? (
            <p className="lightbox-title-meta" aria-label="Photo details">
              {metaParts.join(' · ')}
            </p>
          ) : null}
        </div>
        <span className="lightbox-zoom-readout" aria-live="polite">
          {zoomPercent}%
        </span>
      </div>

      <div
        className="lightbox-toolbar-cluster lightbox-toolbar-zoom"
        role="group"
        aria-label="Zoom"
      >
        <button
          type="button"
          className="lightbox-tool-icon"
          aria-label="Zoom out"
          onClick={onZoomOut}
        >
          −
        </button>
        <button type="button" className="lightbox-tool-quiet" onClick={onResetView}>
          Fit
        </button>
        <button
          type="button"
          className="lightbox-tool-icon"
          aria-label="Zoom in"
          onClick={onZoomIn}
        >
          +
        </button>
      </div>

      <div className="lightbox-toolbar-cluster lightbox-toolbar-end">
        <a
          className="lightbox-tool-icon lightbox-tool-save"
          href={photo.url}
          download={photo.file}
          aria-label="Save image"
          title="Save"
        >
          <IconDownload className="lightbox-tool-icon-svg" />
        </a>
        <div className="lightbox-share-anchor">
          <button
            ref={shareBtnRef}
            type="button"
            className={
              shareOpen
                ? 'lightbox-tool-icon lightbox-tool-quiet-active'
                : 'lightbox-tool-icon'
            }
            aria-label="Share"
            title="Share"
            aria-expanded={shareOpen}
            aria-haspopup="dialog"
            onClick={onShareToggle}
          >
            <IconShare className="lightbox-tool-icon-svg" />
          </button>
          {shareOpen ? (
            <div
              ref={sharePanelRef}
              className="lightbox-share-panel"
              role="dialog"
              aria-label="Share options"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                className="lightbox-menu-item"
                onClick={onShareSocials}
              >
                Share on socials
              </button>
              <button
                type="button"
                className="lightbox-menu-item"
                onClick={onCopyImageLink}
              >
                Copy image link
              </button>
              <button
                type="button"
                className="lightbox-menu-item"
                onClick={onCopyPageLink}
              >
                Copy page link
              </button>
              {hasCollectionLink ? (
                <button
                  type="button"
                  className="lightbox-menu-item"
                  onClick={onCopyCollectionLink}
                >
                  Copy collection link
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
        <button
          type="button"
          className="lightbox-tool-icon"
          onClick={onFullscreen}
          aria-label="Fullscreen"
          title="Fullscreen"
        >
          <IconFullscreen className="lightbox-tool-icon-svg" />
        </button>
        <button
          type="button"
          className={
            detailsOpen
              ? 'lightbox-tool-icon lightbox-tool-quiet-active'
              : 'lightbox-tool-icon'
          }
          aria-label="Photo details"
          title="Details"
          aria-expanded={detailsOpen}
          aria-controls="lightbox-details-panel"
          onClick={onDetailsToggle}
        >
          <IconInfo className="lightbox-tool-icon-svg" />
        </button>
        <details ref={settingsDetailsRef} className="lightbox-settings">
          <summary
            ref={settingsTriggerRef}
            className="lightbox-tool-icon lightbox-settings-trigger"
            aria-label="Viewer settings"
            title="Viewer settings"
          >
            <span className="lightbox-settings-icon" aria-hidden="true">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </span>
          </summary>
          <div
            ref={settingsPanelRef}
            className="lightbox-settings-panel"
            onClick={(e) => e.stopPropagation()}
          >
            <label className="lightbox-settings-toggle">
              <span className="lightbox-settings-label">Ambient glow</span>
              <input
                type="checkbox"
                className="lightbox-settings-checkbox"
                checked={ambientOn}
                onChange={(e) => onAmbientChange(e.target.checked)}
              />
            </label>
            {prefersAmbientOffByDefault() ? (
              <p className="lightbox-settings-hint">
                Off by default on this device for smoother performance. You can turn
                it on here.
              </p>
            ) : null}
            <div className="lightbox-settings-slider-row">
              <label
                className="lightbox-settings-label"
                htmlFor="lightbox-ambient-intensity"
              >
                Intensity
              </label>
              <input
                id="lightbox-ambient-intensity"
                type="range"
                className="lightbox-settings-range"
                min={AMBIENT_INTENSITY_MIN}
                max={AMBIENT_INTENSITY_MAX}
                step={1}
                value={ambientIntensity}
                disabled={!ambientOn}
                aria-valuemin={AMBIENT_INTENSITY_MIN}
                aria-valuemax={AMBIENT_INTENSITY_MAX}
                aria-valuenow={ambientIntensity}
                aria-valuetext={`${ambientIntensity} percent`}
                onChange={(e) =>
                  onAmbientIntensityChange(Number(e.target.value))
                }
              />
              <span className="lightbox-settings-value" aria-hidden="true">
                {ambientIntensity}
              </span>
            </div>
          </div>
        </details>
      </div>
    </header>
  )
}
