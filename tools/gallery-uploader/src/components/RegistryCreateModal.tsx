import { useEffect, useMemo, useState } from "react"
import { collectionSlugFromTitle } from "@galleree/gallery-collection"
import { equipmentSlugFromLabel } from "@galleree/gallery-equipment"
import { appConvertFileSrc, appPickImageFile } from "../tauriBridge"
import {
  saveCameraRegistry,
  saveCollectionRegistry,
  saveLensRegistry,
} from "../registryService"
import type { CoverCandidate, GalleryRegistries, RegistryKind } from "../registryTypes"
import { SELECT_NONE } from "../registryTypes"

type Props = {
  kind: RegistryKind
  registries: GalleryRegistries
  coverCandidates: CoverCandidate[]
  onCreated: (slug: string) => void
  onClose: () => void
}

const TITLES: Record<RegistryKind, string> = {
  collection: "New collection",
  camera: "New camera",
  lens: "New lens",
}

export function RegistryCreateModal({
  kind,
  registries,
  coverCandidates,
  onCreated,
  onClose,
}: Props) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [coverImageId, setCoverImageId] = useState("")

  const [name, setName] = useState("")
  const [make, setMake] = useState("")
  const [model, setModel] = useState("")
  const [lensSlug, setLensSlug] = useState("")
  const [imagePath, setImagePath] = useState<string | null>(null)
  const [imagePreview, setImagePreview] = useState("")

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [busy, onClose])

  const collectionSlug = useMemo(
    () => (kind === "collection" ? collectionSlugFromTitle(title) : null),
    [kind, title],
  )

  const equipmentSlug = useMemo(
    () =>
      kind === "camera" || kind === "lens"
        ? equipmentSlugFromLabel(name)
        : null,
    [kind, name],
  )

  const slugExists = useMemo(() => {
    if (kind === "collection" && collectionSlug) {
      return registries.collections.some((c) => c.slug === collectionSlug)
    }
    if (kind === "camera" && equipmentSlug) {
      return registries.cameras.some((c) => c.slug === equipmentSlug)
    }
    if (kind === "lens" && equipmentSlug) {
      return registries.lenses.some((l) => l.slug === equipmentSlug)
    }
    return false
  }, [kind, collectionSlug, equipmentSlug, registries])

  const pickProductImage = async () => {
    setError(null)
    try {
      const path = await appPickImageFile()
      if (!path) return
      setImagePath(path)
      setImagePreview(appConvertFileSrc(path))
    } catch (e) {
      setError(String(e))
    }
  }

  const clearProductImage = () => {
    setImagePath(null)
    setImagePreview("")
  }

  const handleSave = async () => {
    setError(null)
    setBusy(true)
    try {
      let slug: string
      if (kind === "collection") {
        if (!title.trim()) {
          throw new Error("Collection title is required.")
        }
        if (!collectionSlug) {
          throw new Error("Could not derive a valid slug from that title.")
        }
        if (slugExists) {
          throw new Error(`A collection named “${title.trim()}” already exists.`)
        }
        slug = await saveCollectionRegistry({
          title: title.trim(),
          description,
          coverImageId: coverImageId || null,
        })
      } else if (kind === "camera") {
        if (!name.trim()) {
          throw new Error("Camera name is required.")
        }
        if (slugExists) {
          throw new Error(`A camera named “${name.trim()}” already exists.`)
        }
        slug = await saveCameraRegistry({
          name: name.trim(),
          make,
          model,
          description,
          imagePath,
          lensSlug: lensSlug || null,
        })
      } else {
        if (!name.trim()) {
          throw new Error("Lens name is required.")
        }
        if (slugExists) {
          throw new Error(`A lens named “${name.trim()}” already exists.`)
        }
        slug = await saveLensRegistry({
          name: name.trim(),
          make,
          model,
          description,
          imagePath,
          lensSlug: null,
        })
      }
      onCreated(slug)
    } catch (e) {
      setError(String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="registry-modal-root" role="dialog" aria-modal="true">
      <button
        type="button"
        className="registry-modal-backdrop"
        aria-label="Close"
        onClick={onClose}
        disabled={busy}
      />
      <div className="registry-modal-panel">
        <header className="registry-modal-header">
          <h2 className="registry-modal-title">{TITLES[kind]}</h2>
          <button
            type="button"
            className="registry-modal-close"
            aria-label="Close"
            onClick={onClose}
            disabled={busy}
          >
            ×
          </button>
        </header>

        <div className="registry-modal-body">
          {kind === "collection" ? (
            <>
              <label className="field">
                <span>Title</span>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Crewe Cult Protest"
                  autoComplete="off"
                  autoFocus
                />
              </label>
              {collectionSlug ? (
                <p className="registry-modal-hint muted">
                  Slug: <code>{collectionSlug}</code>
                </p>
              ) : title.trim() ? (
                <p className="registry-modal-hint muted warn">
                  Use letters and numbers so a valid slug can be generated.
                </p>
              ) : null}
              <label className="field">
                <span>Description (optional)</span>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  placeholder="Shown on the collection page"
                />
              </label>
              <label className="field">
                <span>Cover photo (optional)</span>
                <select
                  value={coverImageId}
                  onChange={(e) => setCoverImageId(e.target.value)}
                >
                  <option value="">No cover yet</option>
                  {coverCandidates.map((c) => (
                    <option key={`${c.source}-${c.id}`} value={c.id}>
                      {c.source === "upload" ? "This upload: " : "Gallery: "}
                      {c.label}
                    </option>
                  ))}
                </select>
              </label>
              <p className="registry-modal-hint muted">
                Cover uses a gallery image id. Pick a photo from this batch (needs a
                title) or one already in the repo. Upload the cover photo first if it
                is new.
              </p>
            </>
          ) : (
            <>
              <label className="field">
                <span>Name</span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={
                    kind === "camera" ? "e.g. Sony α7 IV" : "e.g. Tamron 28-200mm"
                  }
                  autoComplete="off"
                  autoFocus
                />
              </label>
              {equipmentSlug ? (
                <p className="registry-modal-hint muted">
                  Slug: <code>{equipmentSlug}</code>
                </p>
              ) : name.trim() ? (
                <p className="registry-modal-hint muted warn">
                  Use letters and numbers so a valid slug can be generated.
                </p>
              ) : null}
              <label className="field">
                <span>Make (optional)</span>
                <input
                  value={make}
                  onChange={(e) => setMake(e.target.value)}
                  autoComplete="off"
                />
              </label>
              <label className="field">
                <span>Model (optional)</span>
                <input
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  autoComplete="off"
                />
              </label>
              <label className="field">
                <span>Description (optional)</span>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                />
              </label>
              {kind === "camera" ? (
                <label className="field">
                  <span>Default lens (optional)</span>
                  <select
                    value={lensSlug}
                    onChange={(e) => setLensSlug(e.target.value)}
                  >
                    <option value={SELECT_NONE}>None</option>
                    {registries.lenses.map((l) => (
                      <option key={l.slug} value={l.slug}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              <div className="field">
                <span>Product image (optional)</span>
                <div className="registry-modal-image-row">
                  {imagePreview ? (
                    <img
                      src={imagePreview}
                      alt=""
                      className="registry-modal-image-preview"
                    />
                  ) : (
                    <span className="registry-modal-image-placeholder muted">
                      No image selected
                    </span>
                  )}
                  <div className="registry-modal-image-actions">
                    <button
                      type="button"
                      onClick={() => void pickProductImage()}
                      disabled={busy}
                    >
                      Choose image…
                    </button>
                    {imagePath ? (
                      <button
                        type="button"
                        className="ghost"
                        onClick={clearProductImage}
                        disabled={busy}
                      >
                        Remove
                      </button>
                    ) : null}
                  </div>
                </div>
                <p className="registry-modal-hint muted">
                  Saved as PNG under{" "}
                  <code>meta/{kind === "camera" ? "cameras" : "lenses"}/{"{slug}"}.png</code>
                  . Shown in equipment details on the site.
                </p>
              </div>
            </>
          )}

          {error ? <p className="registry-modal-error">{error}</p> : null}
        </div>

        <footer className="registry-modal-footer">
          <button type="button" className="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            className="primary"
            onClick={() => void handleSave()}
            disabled={busy || slugExists}
          >
            {busy ? "Saving…" : "Save to gallery project"}
          </button>
        </footer>
      </div>
    </div>
  )
}

