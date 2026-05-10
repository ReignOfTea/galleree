import type { ReactNode } from 'react'

type Props = {
  idPrefix: string
  /** Short heading (e.g. “Locations”) */
  title: string
  /** Current selection summary when collapsed */
  summary: string
  open: boolean
  onOpenChange: (open: boolean) => void
  children: ReactNode
}

export function CollapsibleFilterSection({
  idPrefix,
  title,
  summary,
  open,
  onOpenChange,
  children,
}: Props) {
  const triggerId = `${idPrefix}-trigger`
  const panelId = `${idPrefix}-panel`

  return (
    <div className="filter-collapsible">
      <button
        type="button"
        id={triggerId}
        className={`filter-collapsible-trigger${open ? ' filter-collapsible-trigger-open' : ''}`}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => onOpenChange(!open)}
      >
        <span className="filter-collapsible-title">{title}</span>
        <span className="filter-collapsible-summary">{summary}</span>
        <span className="filter-collapsible-chevron" aria-hidden />
      </button>
      <div
        id={panelId}
        role="region"
        aria-labelledby={triggerId}
        hidden={!open}
        className="filter-collapsible-panel"
      >
        {children}
      </div>
    </div>
  )
}
