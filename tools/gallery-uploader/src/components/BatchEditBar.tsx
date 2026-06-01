import { useState } from "react"
import type { GalleryRegistries } from "../registryTypes"
import { SELECT_NONE } from "../registryTypes"
import { TagsInput } from "./TagsInput"

const COLLECTION_NO_CHANGE = "__no_change__"
const COLLECTION_CLEAR = "__clear__"

type Props = {
  rowCount: number
  selectedCount: number
  registries: GalleryRegistries
  knownTags: readonly string[]
  disabled?: boolean
  onApply: (patch: {
    mergeTags?: string
    collectionSelect?: string
    hidden?: boolean
  }) => void
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
  onSelectAll,
  onClearSelection,
}: Props) {
  const [tags, setTags] = useState("")
  const [collection, setCollection] = useState(COLLECTION_NO_CHANGE)
  const [hidden, setHidden] = useState<boolean | null>(null)

  if (rowCount < 2) return null

  const targetLabel =
    selectedCount > 0 ? `${selectedCount} selected` : `all ${rowCount} photos`

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
      </div>
      <div className="actions batch-edit__actions">
        <button
          type="button"
          disabled={
            disabled ||
            (!tags.trim() &&
              collection === COLLECTION_NO_CHANGE &&
              hidden === null)
          }
          onClick={() => {
            onApply({
              mergeTags: tags.trim() || undefined,
              collectionSelect:
                collection === COLLECTION_NO_CHANGE
                  ? undefined
                  : collection === COLLECTION_CLEAR
                    ? SELECT_NONE
                    : collection,
              hidden: hidden === null ? undefined : hidden,
            })
            setTags("")
            setCollection(COLLECTION_NO_CHANGE)
            setHidden(null)
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
