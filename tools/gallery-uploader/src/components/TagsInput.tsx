import { useEffect, useId, useRef, useState } from "react"
import {
  applySuggestedTag,
  filterTagSuggestions,
  tagFragmentAt,
} from "../lib/tagSuggest"

type Props = {
  value: string
  onChange: (value: string) => void
  knownTags: readonly string[]
  placeholder?: string
}

export function TagsInput({ value, onChange, knownTags, placeholder }: Props) {
  const listId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [caret, setCaret] = useState(0)
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)

  const suggestions = filterTagSuggestions(knownTags, value, caret)
  const showList = open && suggestions.length > 0

  useEffect(() => {
    setActiveIndex(0)
  }, [value, caret, suggestions.length])

  const pick = (tag: string) => {
    const el = inputRef.current
    const pos = el?.selectionStart ?? caret
    const next = applySuggestedTag(value, pos, tag)
    onChange(next.value)
    setCaret(next.caret)
    setOpen(true)
    requestAnimationFrame(() => {
      el?.focus()
      el?.setSelectionRange(next.caret, next.caret)
    })
  }

  const syncCaret = () => {
    const el = inputRef.current
    if (!el) return
    setCaret(el.selectionStart ?? value.length)
    setOpen(true)
  }

  return (
    <div className="tags-input">
      <input
        ref={inputRef}
        type="text"
        className="tags-input__field"
        value={value}
        placeholder={placeholder}
        autoComplete="off"
        aria-autocomplete="list"
        aria-controls={showList ? listId : undefined}
        aria-expanded={showList}
        onChange={(e) => {
          onChange(e.target.value)
          setCaret(e.target.selectionStart ?? e.target.value.length)
          setOpen(true)
        }}
        onFocus={syncCaret}
        onClick={syncCaret}
        onKeyUp={syncCaret}
        onKeyDown={(e) => {
          if (!showList) return
          if (e.key === "ArrowDown") {
            e.preventDefault()
            setActiveIndex((i) => (i + 1) % suggestions.length)
          } else if (e.key === "ArrowUp") {
            e.preventDefault()
            setActiveIndex((i) => (i - 1 + suggestions.length) % suggestions.length)
          } else if (e.key === "Enter" || e.key === "Tab") {
            if (suggestions[activeIndex]) {
              e.preventDefault()
              pick(suggestions[activeIndex])
            }
          } else if (e.key === "Escape") {
            setOpen(false)
          }
        }}
        onBlur={() => {
          window.setTimeout(() => setOpen(false), 120)
        }}
      />
      {showList ? (
        <ul id={listId} className="tags-input__suggestions" role="listbox">
          {suggestions.map((tag, i) => (
            <li key={tag} role="presentation">
              <button
                type="button"
                role="option"
                aria-selected={i === activeIndex}
                className={`tags-input__option${i === activeIndex ? " tags-input__option-active" : ""}`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(tag)}
              >
                {highlightMatch(tag, tagFragmentAt(value, caret).fragment.trim())}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

function highlightMatch(tag: string, fragment: string) {
  if (!fragment) return tag
  const lower = tag.toLowerCase()
  const frag = fragment.toLowerCase()
  if (!lower.startsWith(frag)) return tag
  return (
    <>
      <span className="tags-input__match">{tag.slice(0, fragment.length)}</span>
      {tag.slice(fragment.length)}
    </>
  )
}
