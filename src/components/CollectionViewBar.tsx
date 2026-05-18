type Props = {
  title: string
  description: string | null
  linkCopied: boolean
  onCopyLink: () => void
}

export function CollectionViewBar({
  title,
  description,
  linkCopied,
  onCopyLink,
}: Props) {
  return (
    <header className="collection-view-bar" aria-label="Current collection">
      <div className="collection-view-bar-main">
        <h2 className="collection-view-bar-title">{title}</h2>
        {description ? (
          <p className="collection-view-bar-description">{description}</p>
        ) : null}
      </div>
      <button type="button" className="collection-share-btn" onClick={onCopyLink}>
        {linkCopied ? 'Link copied' : 'Copy link'}
      </button>
    </header>
  )
}
