import { useState } from "react"

type BulkTitleProps = {
  disabled?: boolean
  selectedCount: number
  rowCount: number
  onPrefix: (text: string) => void
  onSuffix: (text: string) => void
  onStripCameraPrefix: () => void
  onNumber: (start: number, pad: number) => void
}

export function BulkTitleTools({
  disabled,
  selectedCount,
  rowCount,
  onPrefix,
  onSuffix,
  onStripCameraPrefix,
  onNumber,
}: BulkTitleProps) {
  const [prefix, setPrefix] = useState("")
  const [suffix, setSuffix] = useState("")
  const [startNum, setStartNum] = useState("1")
  const [pad, setPad] = useState("0")

  if (rowCount < 2) return null

  const scope =
    selectedCount > 0 ? `${selectedCount} selected` : `all ${rowCount}`

  return (
    <div className="bulk-title-tools">
      <p className="bulk-title-tools__lead muted">
        Bulk titles for <strong>{scope}</strong>
      </p>
      <div className="bulk-title-tools__row">
        <label className="field bulk-title-tools__field">
          <span>Prefix</span>
          <input
            value={prefix}
            disabled={disabled}
            placeholder="e.g. Paris — "
            onChange={(e) => setPrefix(e.target.value)}
            autoComplete="off"
          />
        </label>
        <button
          type="button"
          disabled={disabled || !prefix.trim()}
          onClick={() => {
            onPrefix(prefix)
            setPrefix("")
          }}
        >
          Apply prefix
        </button>
        <label className="field bulk-title-tools__field">
          <span>Suffix</span>
          <input
            value={suffix}
            disabled={disabled}
            placeholder="e.g. (evening)"
            onChange={(e) => setSuffix(e.target.value)}
            autoComplete="off"
          />
        </label>
        <button
          type="button"
          disabled={disabled || !suffix.trim()}
          onClick={() => {
            onSuffix(suffix)
            setSuffix("")
          }}
        >
          Apply suffix
        </button>
        <button type="button" className="ghost" disabled={disabled} onClick={onStripCameraPrefix}>
          Strip DSC_/IMG_ prefixes
        </button>
        <label className="field bulk-title-tools__field bulk-title-tools__field--narrow">
          <span>Number from</span>
          <input
            type="number"
            min={1}
            value={startNum}
            disabled={disabled}
            onChange={(e) => setStartNum(e.target.value)}
          />
        </label>
        <label className="field bulk-title-tools__field bulk-title-tools__field--narrow">
          <span>Pad width</span>
          <input
            type="number"
            min={0}
            max={6}
            value={pad}
            disabled={disabled}
            onChange={(e) => setPad(e.target.value)}
          />
        </label>
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            const start = Math.max(1, Number(startNum) || 1)
            const padN = Math.max(0, Math.min(6, Number(pad) || 0))
            onNumber(start, padN)
          }}
        >
          Apply numbers
        </button>
      </div>
    </div>
  )
}
