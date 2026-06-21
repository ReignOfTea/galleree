import { SELECT_CUSTOM, SELECT_NONE } from "../registryTypes"
import type { GalleryRegistries } from "../registryTypes"
import type { SessionDefaults } from "../lib/sessionDefaults"
import { TagsInput } from "./TagsInput"

type Props = {
  defaults: SessionDefaults
  registries: GalleryRegistries
  knownTags: readonly string[]
  disabled?: boolean
  onChange: (patch: Partial<SessionDefaults>) => void
  onApplyToQueued: () => void
  onApplyToNewOnly: () => void
  queuedCount: number
  lastPrefsAvailable?: boolean
  onUseLastPrefs?: () => void
}

export function SessionDefaultsBar({
  defaults,
  registries,
  knownTags,
  disabled,
  onChange,
  onApplyToQueued,
  onApplyToNewOnly,
  queuedCount,
  lastPrefsAvailable,
  onUseLastPrefs,
}: Props) {
  return (
    <div className="session-defaults">
      <p className="session-defaults__lead muted">
        Defaults for <strong>new photos</strong> (applied on add). Use “Apply to queued” to update
        photos already in the list.
      </p>
      {lastPrefsAvailable && onUseLastPrefs ? (
        <div className="session-defaults__last-prefs">
          <button type="button" className="ghost" disabled={disabled} onClick={onUseLastPrefs}>
            Use last upload defaults
          </button>
        </div>
      ) : null}
      <div className="session-defaults__grid">
        <label className="field session-defaults__field">
          <span>Tags</span>
          <TagsInput
            value={defaults.tags}
            knownTags={knownTags}
            placeholder="photos, travel"
            onChange={(tags) => onChange({ tags })}
          />
        </label>
        <label className="field session-defaults__field">
          <span>Collection</span>
          <select
            value={defaults.collectionSelect}
            disabled={disabled}
            onChange={(e) => onChange({ collectionSelect: e.target.value })}
          >
            <option value={SELECT_NONE}>None</option>
            {registries.collections.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.title}
              </option>
            ))}
          </select>
        </label>
        <label className="field session-defaults__field">
          <span>Camera</span>
          <select
            value={defaults.cameraSelect}
            disabled={disabled}
            onChange={(e) => onChange({ cameraSelect: e.target.value })}
          >
            <option value={SELECT_NONE}>Not set</option>
            {registries.cameras.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name}
              </option>
            ))}
            <option value={SELECT_CUSTOM}>Custom…</option>
          </select>
        </label>
        <label className="field session-defaults__field">
          <span>Lens</span>
          <select
            value={defaults.lensSelect}
            disabled={disabled}
            onChange={(e) => onChange({ lensSelect: e.target.value })}
          >
            <option value={SELECT_NONE}>Not set</option>
            {registries.lenses.map((l) => (
              <option key={l.slug} value={l.slug}>
                {l.name}
              </option>
            ))}
            <option value={SELECT_CUSTOM}>Custom…</option>
          </select>
        </label>
        <label className="field session-defaults__field">
          <span>Location</span>
          <input
            value={defaults.location}
            disabled={disabled}
            placeholder="City, UK"
            onChange={(e) => onChange({ location: e.target.value })}
            autoComplete="off"
          />
        </label>
        <label className="field session-defaults__field">
          <span>Copyright</span>
          <input
            value={defaults.copyright}
            disabled={disabled}
            onChange={(e) => onChange({ copyright: e.target.value })}
            autoComplete="off"
          />
        </label>
        <label className="field session-defaults__field">
          <span>Hidden</span>
          <select
            value={defaults.hidden === null ? "" : defaults.hidden ? "1" : "0"}
            disabled={disabled}
            onChange={(e) => {
              const v = e.target.value
              onChange({ hidden: v === "" ? null : v === "1" })
            }}
          >
            <option value="">Don&apos;t set</option>
            <option value="0">Visible</option>
            <option value="1">Hidden</option>
          </select>
        </label>
      </div>
      <div className="actions session-defaults__actions">
        <button
          type="button"
          disabled={disabled || queuedCount === 0}
          onClick={onApplyToQueued}
        >
          Apply to queued ({queuedCount})
        </button>
        <button type="button" className="ghost" disabled={disabled} onClick={onApplyToNewOnly}>
          New photos only
        </button>
      </div>
    </div>
  )
}
