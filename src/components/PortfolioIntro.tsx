import { PortfolioAbout } from './PortfolioAbout'
import { PortfolioHeader } from './PortfolioHeader'
import type { SiteConfig } from '../lib/siteConfig'

type Props = {
  config: SiteConfig
}

export function PortfolioIntro({ config }: Props) {
  const hasAbout = Boolean(config.about?.trim())

  return (
    <div className={`portfolio-intro${hasAbout ? ' portfolio-intro-split' : ''}`}>
      <PortfolioHeader config={config} compact={hasAbout} />
      {hasAbout ? <PortfolioAbout config={config} variant="aside" /> : null}
    </div>
  )
}
