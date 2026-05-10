import type { SiteConfig } from '../lib/siteConfig'

type Props = {
  config: SiteConfig
}

export function PortfolioFooter({ config }: Props) {
  const year = new Date().getFullYear()
  const links = config.social ?? []

  if (links.length === 0) {
    return (
      <footer className="portfolio-footer portfolio-footer-minimal">
        <p className="portfolio-credit">
          © {year} {config.title}
        </p>
      </footer>
    )
  }

  return (
    <footer className="portfolio-footer">
      <nav className="portfolio-social" aria-label="Social links">
        {links.map(({ label, url }) => (
          <a
            key={`${label}-${url}`}
            href={url}
            target={url.startsWith('mailto:') ? undefined : '_blank'}
            rel={
              url.startsWith('mailto:')
                ? undefined
                : 'noopener noreferrer'
            }
          >
            {label}
          </a>
        ))}
      </nav>
      <p className="portfolio-credit">
        © {year} {config.title}
      </p>
    </footer>
  )
}
