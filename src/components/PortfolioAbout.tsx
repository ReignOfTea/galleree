import type { SiteConfig } from '../lib/siteConfig'

type Props = {
  config: SiteConfig
  variant?: 'stacked' | 'aside'
}

export function PortfolioAbout({ config, variant = 'stacked' }: Props) {
  const about = config.about?.trim()
  if (!about) return null

  const paragraphs = about.split(/\n\n+/).filter(Boolean)

  return (
    <section
      className={`portfolio-about portfolio-about-${variant}`}
      aria-labelledby="portfolio-about-heading"
    >
      <h2
        id="portfolio-about-heading"
        className={`portfolio-about-heading${variant === 'aside' ? ' portfolio-about-heading-sr' : ''}`}
      >
        About
      </h2>
      {paragraphs.map((p) => (
        <p key={p.slice(0, 40)} className="portfolio-about-text">
          {p}
        </p>
      ))}
    </section>
  )
}
