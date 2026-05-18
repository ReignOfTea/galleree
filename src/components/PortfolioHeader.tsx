import type { CSSProperties } from 'react'
import {
  resolveHeaderPresentation,
  type SiteConfig,
} from '../lib/siteConfig'

type Props = {
  config: SiteConfig
  /** Tighter intro when about copy sits in a side column. */
  compact?: boolean
}

export function PortfolioHeader({ config, compact = false }: Props) {
  const { layout, logoSrc, logoAlt } = resolveHeaderPresentation(config)
  const showTitle = layout === 'title' || layout === 'both'
  const showLogo = logoSrc && (layout === 'logo' || layout === 'both')

  const logoStyle: CSSProperties = {}
  if (config.logoMaxHeight) logoStyle.maxHeight = config.logoMaxHeight
  if (config.logoMaxWidth) logoStyle.maxWidth = config.logoMaxWidth

  return (
    <header
      className={`portfolio-header${compact ? ' portfolio-header-compact' : ''}`}
    >
      <p className="portfolio-kicker">{config.kicker?.trim() || 'Photography'}</p>

      <h1 className="portfolio-brand-heading">
        {showLogo ? (
          <img
            className="portfolio-logo"
            src={logoSrc}
            alt={layout === 'logo' ? logoAlt : ''}
            decoding="async"
            draggable={false}
            style={Object.keys(logoStyle).length > 0 ? logoStyle : undefined}
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
