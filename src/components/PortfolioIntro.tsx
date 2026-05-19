import { PortfolioAbout } from './PortfolioAbout'
import { PortfolioHeader } from './PortfolioHeader'
import type { SiteConfig } from '../lib/siteConfig'

type Props = {
  config: SiteConfig
  onHomeClick?: () => void
}

export function PortfolioIntro({ config, onHomeClick }: Props) {
  const hasAbout = Boolean(config.about?.trim())

  return (
    <div className={`portfolio-intro${hasAbout ? ' portfolio-intro-split' : ''}`}>
      <PortfolioHeader
        config={config}
        compact={hasAbout}
        onHomeClick={onHomeClick}
      />
      {hasAbout ? <PortfolioAbout config={config} variant="aside" /> : null}
    </div>
  )
}
