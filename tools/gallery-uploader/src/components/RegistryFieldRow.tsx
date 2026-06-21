import type { ReactNode } from "react"

export function RegistryFieldRow({
  label,
  select,
  onCreate,
  extra,
}: {
  label: string
  select: ReactNode
  onCreate: () => void
  extra?: ReactNode
}) {
  return (
    <div className="registry-field-block">
      <div className="field-with-action">
        <label className="field field-with-action__field">
          <span>{label}</span>
          {select}
        </label>
        <button type="button" className="ghost field-with-action__btn" onClick={onCreate}>
          New…
        </button>
      </div>
      {extra}
    </div>
  )
}
