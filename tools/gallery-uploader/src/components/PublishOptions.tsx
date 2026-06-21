import {
  DEFAULT_PUBLISH_MODE,
  PUBLISH_MODE_OPTIONS,
  type PublishMode,
} from "../lib/publishModes"

type Props = {
  mode: PublishMode
  disabled?: boolean
  highlight?: boolean
  onChange: (mode: PublishMode) => void
}

export function PublishOptions({
  mode,
  disabled,
  highlight,
  onChange,
}: Props) {
  const selected =
    PUBLISH_MODE_OPTIONS.find((o) => o.id === mode) ??
    PUBLISH_MODE_OPTIONS.find((o) => o.id === DEFAULT_PUBLISH_MODE)!

  return (
    <div
      className={`publish-options${highlight ? " publish-options--highlight" : ""}`}
    >
      <p className="publish-options__lead">
        <strong>How to publish to GitHub</strong> — pick what should happen when you
        upload (or retry after an error).
      </p>
      <fieldset className="publish-options__fieldset" disabled={disabled}>
        <legend className="visually-hidden">Publish strategy</legend>
        {PUBLISH_MODE_OPTIONS.map((opt) => (
          <label
            key={opt.id}
            className={`publish-options__choice${opt.risky ? " publish-options__choice--risky" : ""}`}
          >
            <input
              type="radio"
              name="publish-mode"
              value={opt.id}
              checked={mode === opt.id}
              onChange={() => onChange(opt.id)}
            />
            <span className="publish-options__choice-text">
              <span className="publish-options__choice-label">{opt.label}</span>
              <span className="publish-options__choice-summary muted">{opt.summary}</span>
            </span>
          </label>
        ))}
      </fieldset>
      <p className="publish-options__detail muted">
        {selected.detail}
        {selected.risky ? (
          <span className="publish-options__risk-note">
            {" "}
            This option can overwrite work on GitHub — read the summary before using it.
          </span>
        ) : null}
      </p>
    </div>
  )
}
