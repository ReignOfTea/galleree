import type { CSSProperties, KeyboardEvent } from 'react'
import {
  resolveHeaderPresentation,
  type SiteConfig,
} from '../lib/siteConfig'

/** `min(100%, …)` collapses inside shrink-wrapped parents; prefer viewport units. */
function logoMaxWidthCss(raw: string | undefined): string | undefined {
  if (!raw?.trim()) return undefined
  const t = raw.trim()
  if (t.includes('100%')) return 'min(92vw, 36rem)'
  return t
}

type Props = {
  config: SiteConfig
  /** Tighter intro when about copy sits in a side column. */
  compact?: boolean
  /** Logo / title — return to the main gallery and clear filters. */
  onHomeClick?: () => void
}

export function PortfolioHeader({
  config,
  compact = false,
  onHomeClick,
}: Props) {
  const { layout, logoSrc, logoAlt } = resolveHeaderPresentation(config)
  const showTitle = layout === 'title' || layout === 'both'
  const showLogo = logoSrc && (layout === 'logo' || layout === 'both')

  const logoStyle: CSSProperties = {}
  if (config.logoMaxHeight) logoStyle.maxHeight = config.logoMaxHeight
  const logoMaxW = logoMaxWidthCss(config.logoMaxWidth)
  if (logoMaxW) logoStyle.maxWidth = logoMaxW

  const onLogoKeyDown = (e: KeyboardEvent<HTMLImageElement>) => {
    if (!onHomeClick) return
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onHomeClick()
    }
  }

  return (
    <header
      className={`portfolio-header${compact ? ' portfolio-header-compact' : ''}`}
    >
      <p className="portfolio-kicker">{config.kicker?.trim() || 'Photography'}</p>

      <h1 className="portfolio-brand-heading">
        {showLogo ? (
          <img
            className={`portfolio-logo${onHomeClick ? ' portfolio-logo--home' : ''}`}
            src={logoSrc}
            alt={layout === 'logo' ? logoAlt : ''}
            decoding="async"
            draggable={false}
            style={Object.keys(logoStyle).length > 0 ? logoStyle : undefined}
            onClick={onHomeClick}
            onKeyDown={onLogoKeyDown}
            role={onHomeClick ? 'button' : undefined}
            tabIndex={onHomeClick ? 0 : undefined}
          />
        ) : null}
        {showTitle ? (
          <span className="portfolio-title-text">{config.title}</span>
        ) : null}
      </h1>

      {config.tagline ? (
        <p className="portfolio-tagline">{config.tagline}</p>
      ) : null}
      {!compact ? <div className="portfolio-rule" aria-hidden /> : null}
    </header>
  )
}
