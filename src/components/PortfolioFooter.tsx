import type { SiteConfig } from '../lib/siteConfig'

type Props = {
  config: SiteConfig
}

function isDuplicateMailto(url: string, contactEmail: string): boolean {
  if (!url.startsWith('mailto:')) return false
  try {
    return (
      decodeURIComponent(url.slice(7)).trim().toLowerCase() ===
      contactEmail.trim().toLowerCase()
    )
  } catch {
    return url.slice(7).trim().toLowerCase() === contactEmail.trim().toLowerCase()
  }
}

export function PortfolioFooter({ config }: Props) {
  const year = new Date().getFullYear()
  const contactEmail = config.contactEmail?.trim()
  const links = (config.social ?? []).filter(
    (link) => !contactEmail || !isDuplicateMailto(link.url, contactEmail),
  )
  const hasNav = Boolean(contactEmail) || links.length > 0

  return (
    <footer className={`portfolio-footer${hasNav ? '' : ' portfolio-footer-minimal'}`}>
      <div className="portfolio-footer-inner">
        {hasNav ? (
          <nav className="portfolio-footer-nav" aria-label="Contact and social links">
            {contactEmail ? (
              <a
                href={`mailto:${contactEmail}`}
                className="portfolio-footer-nav-link portfolio-footer-nav-email"
              >
                {contactEmail}
              </a>
            ) : null}
            {links.map(({ label, url }) => (
              <a
                key={`${label}-${url}`}
                href={url}
                className="portfolio-footer-nav-link"
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
        ) : null}
        <p className="portfolio-credit">
          © {year} {config.title}
        </p>
      </div>
    </footer>
  )
}
