import { useState } from "react"
import type { GalleryRegistries } from "../registryTypes"
import { SELECT_NONE } from "../registryTypes"
import { TagsInput } from "./TagsInput"

const COLLECTION_NO_CHANGE = "__no_change__"
const COLLECTION_CLEAR = "__clear__"
const FIELD_NO_CHANGE = "__no_change__"

export type BatchEditPatch = {
  mergeTags?: string
  collectionSelect?: string
  hidden?: boolean
  cameraSelect?: string
  lensSelect?: string
  copyright?: string
  location?: string
}

export type CopyFromFirstField =
  | "tags"
  | "location"
  | "description"
  | "collection"
  | "camera"
  | "lens"
  | "copyright"

type Props = {
  rowCount: number
  selectedCount: number
  registries: GalleryRegistries
  knownTags: readonly string[]
  disabled?: boolean
  onApply: (patch: BatchEditPatch) => void
  onCopyFromFirst: (fields: CopyFromFirstField[]) => void
  onSelectAll: () => void
  onClearSelection: () => void
}

export function BatchEditBar({
  rowCount,
  selectedCount,
  registries,
  knownTags,
  disabled,
  onApply,
  onCopyFromFirst,
  onSelectAll,
  onClearSelection,
}: Props) {
  const [tags, setTags] = useState("")
  const [collection, setCollection] = useState(COLLECTION_NO_CHANGE)
  const [hidden, setHidden] = useState<boolean | null>(null)
  const [camera, setCamera] = useState(FIELD_NO_CHANGE)
  const [lens, setLens] = useState(FIELD_NO_CHANGE)
  const [copyright, setCopyright] = useState("")
  const [location, setLocation] = useState("")
  const [copyrightMode, setCopyrightMode] = useState<"no_change" | "set" | "clear">("no_change")
  const [locationMode, setLocationMode] = useState<"no_change" | "set" | "clear">("no_change")

  if (rowCount < 2) return null

  const targetLabel =
    selectedCount > 0 ? `${selectedCount} selected` : `all ${rowCount} photos`

  const canApply =
    tags.trim() ||
    collection !== COLLECTION_NO_CHANGE ||
    hidden !== null ||
    camera !== FIELD_NO_CHANGE ||
    lens !== FIELD_NO_CHANGE ||
    copyrightMode !== "no_change" ||
    locationMode !== "no_change"

  return (
    <div className="batch-edit">
      <p className="batch-edit__lead muted">
        Batch edit applies to <strong>{targetLabel}</strong>.
        {selectedCount === 0 ? " Select rows below, or leave none selected to edit all." : null}
      </p>
      <div className="batch-edit__row">
        <label className="field batch-edit__field">
          <span>Add tags (comma-separated)</span>
          <TagsInput
            value={tags}
            knownTags={knownTags}
            placeholder="e.g. travel, 2026"
            onChange={setTags}
          />
        </label>
        <label className="field batch-edit__field">
          <span>Collection</span>
          <select
            value={collection}
            disabled={disabled}
            onChange={(e) => setCollection(e.target.value)}
          >
            <option value={COLLECTION_NO_CHANGE}>— no change —</option>
            <option value={COLLECTION_CLEAR}>Clear collection</option>
            {registries.collections.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.title}
              </option>
            ))}
          </select>
        </label>
        <label className="field batch-edit__field batch-edit__field--inline">
          <span>Hidden</span>
          <select
            value={hidden === null ? "" : hidden ? "1" : "0"}
            disabled={disabled}
            onChange={(e) => {
              const v = e.target.value
              setHidden(v === "" ? null : v === "1")
            }}
          >
            <option value="">— no change —</option>
            <option value="0">Visible</option>
            <option value="1">Hidden</option>
          </select>
        </label>
        <label className="field batch-edit__field">
          <span>Camera</span>
          <select value={camera} disabled={disabled} onChange={(e) => setCamera(e.target.value)}>
            <option value={FIELD_NO_CHANGE}>— no change —</option>
            <option value={SELECT_NONE}>Clear</option>
            {registries.cameras.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field batch-edit__field">
          <span>Lens</span>
          <select value={lens} disabled={disabled} onChange={(e) => setLens(e.target.value)}>
            <option value={FIELD_NO_CHANGE}>— no change —</option>
            <option value={SELECT_NONE}>Clear</option>
            {registries.lenses.map((l) => (
              <option key={l.slug} value={l.slug}>
                {l.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field batch-edit__field">
          <span>Location</span>
          <select
            value={locationMode}
            disabled={disabled}
            onChange={(e) => setLocationMode(e.target.value as typeof locationMode)}
          >
            <option value="no_change">— no change —</option>
            <option value="set">Set to…</option>
            <option value="clear">Clear</option>
          </select>
          {locationMode === "set" ? (
            <input
              value={location}
              disabled={disabled}
              placeholder="City, UK"
              onChange={(e) => setLocation(e.target.value)}
              autoComplete="off"
            />
          ) : null}
        </label>
        <label className="field batch-edit__field">
          <span>Copyright</span>
          <select
            value={copyrightMode}
            disabled={disabled}
            onChange={(e) => setCopyrightMode(e.target.value as typeof copyrightMode)}
          >
            <option value="no_change">— no change —</option>
            <option value="set">Set to…</option>
            <option value="clear">Clear</option>
          </select>
          {copyrightMode === "set" ? (
            <input
              value={copyright}
              disabled={disabled}
              onChange={(e) => setCopyright(e.target.value)}
              autoComplete="off"
            />
          ) : null}
        </label>
      </div>
      <div className="batch-edit__copy-row">
        <span className="batch-edit__copy-label muted">Copy from first selected:</span>
        <button
          type="button"
          className="ghost"
          disabled={disabled || selectedCount === 0}
          onClick={() => onCopyFromFirst(["collection", "tags", "location"])}
        >
          Collection + tags + location
        </button>
        <button
          type="button"
          className="ghost"
          disabled={disabled || selectedCount === 0}
          onClick={() => onCopyFromFirst(["camera", "lens"])}
        >
          Camera + lens
        </button>
        <button
          type="button"
          className="ghost"
          disabled={disabled || selectedCount === 0}
          onClick={() => onCopyFromFirst(["description", "copyright"])}
        >
          Description + copyright
        </button>
      </div>
      <div className="actions batch-edit__actions">
        <button
          type="button"
          disabled={disabled || !canApply}
          onClick={() => {
            const patch: BatchEditPatch = {}
            if (tags.trim()) patch.mergeTags = tags.trim()
            if (collection !== COLLECTION_NO_CHANGE) {
              patch.collectionSelect =
                collection === COLLECTION_CLEAR ? SELECT_NONE : collection
            }
            if (hidden !== null) patch.hidden = hidden
            if (camera !== FIELD_NO_CHANGE) patch.cameraSelect = camera
            if (lens !== FIELD_NO_CHANGE) patch.lensSelect = lens
            if (locationMode === "set") patch.location = location
            if (locationMode === "clear") patch.location = ""
            if (copyrightMode === "set") patch.copyright = copyright
            if (copyrightMode === "clear") patch.copyright = ""
            onApply(patch)
            setTags("")
            setCollection(COLLECTION_NO_CHANGE)
            setHidden(null)
            setCamera(FIELD_NO_CHANGE)
            setLens(FIELD_NO_CHANGE)
            setCopyright("")
            setLocation("")
            setCopyrightMode("no_change")
            setLocationMode("no_change")
          }}
        >
          Apply batch
        </button>
        <button type="button" className="ghost" disabled={disabled} onClick={onSelectAll}>
          Select all
        </button>
        {selectedCount > 0 ? (
          <button type="button" className="ghost" disabled={disabled} onClick={onClearSelection}>
            Clear selection
          </button>
        ) : null}
      </div>
    </div>
  )
}
