import { feedXmlHref, type SiteConfig } from '../lib/siteConfig'

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
  const hasContact = Boolean(contactEmail) || links.length > 0
  const feedHref = feedXmlHref()

  return (
    <footer className={`portfolio-footer${hasContact ? '' : ' portfolio-footer-minimal'}`}>
      <div className="portfolio-footer-inner">
        <nav
          className="portfolio-footer-nav"
          aria-label={hasContact ? 'Contact, social, and feed links' : 'Site links'}
        >
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
          <a href={feedHref} className="portfolio-footer-nav-link">
            RSS feed
          </a>
        </nav>
        <p className="portfolio-credit">
          © {year} {config.title}
          {config.copyright?.trim() ? (
            <>
              <span className="portfolio-credit-sep" aria-hidden>
                {' '}
                ·{' '}
              </span>
              <span className="portfolio-copyright">{config.copyright.trim()}</span>
            </>
          ) : null}
        </p>
      </div>
    </footer>
  )
}
