import { useCallback, useEffect, useState } from "react"
import { normalizeSiteConfig, type SiteConfig } from "@galleree/site-config"
import { appInvoke } from "../tauriBridge"

type Props = {
  disabled?: boolean
}

const emptyDraft = (): SiteConfig => ({
  title: "",
  tagline: "",
})

export function SiteConfigPanel({ disabled = false }: Props) {
  const [draft, setDraft] = useState<SiteConfig>(emptyDraft)
  const [loaded, setLoaded] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      const raw = await appInvoke<string>("read_site_json")
      setDraft(normalizeSiteConfig(JSON.parse(raw || "{}")))
      setLoaded(true)
    } catch (e) {
      setStatus(String(e))
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const save = async () => {
    setBusy(true)
    setStatus(null)
    try {
      const normalized = normalizeSiteConfig(draft)
      await appInvoke("write_site_json", {
        json: `${JSON.stringify(normalized, null, 2)}\n`,
      })
      setDraft(normalized)
      setStatus("Saved site.json in the gallery project. It will be included on the next Upload / publish.")
    } catch (e) {
      setStatus(String(e))
    } finally {
      setBusy(false)
    }
  }

  if (!loaded) {
    return <p className="muted">Loading site settings…</p>
  }

  return (
    <div className="site-config-panel">
      <p className="muted site-config-panel__lede">
        Edit <code>public/site.json</code> in your local gallery checkout. Logo and other assets in{" "}
        <code>public/</code> are still edited on disk; this form saves JSON only.
      </p>
      <label className="field">
        <span>Site title</span>
        <input
          value={draft.title}
          onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
          disabled={disabled || busy}
        />
      </label>
      <label className="field">
        <span>Kicker</span>
        <input
          value={draft.kicker ?? ""}
          onChange={(e) => setDraft((d) => ({ ...d, kicker: e.target.value }))}
          placeholder="Photography"
          disabled={disabled || busy}
        />
      </label>
      <label className="field">
        <span>Tagline</span>
        <input
          value={draft.tagline ?? ""}
          onChange={(e) => setDraft((d) => ({ ...d, tagline: e.target.value }))}
          disabled={disabled || busy}
        />
      </label>
      <label className="field">
        <span>About</span>
        <textarea
          value={draft.about ?? ""}
          onChange={(e) => setDraft((d) => ({ ...d, about: e.target.value }))}
          rows={4}
          disabled={disabled || busy}
        />
      </label>
      <label className="field">
        <span>Site URL</span>
        <input
          value={draft.siteUrl ?? ""}
          onChange={(e) => setDraft((d) => ({ ...d, siteUrl: e.target.value }))}
          placeholder="https://gallery.example.com"
          disabled={disabled || busy}
        />
      </label>
      <label className="field">
        <span>Language (BCP 47)</span>
        <input
          value={draft.lang ?? ""}
          onChange={(e) => setDraft((d) => ({ ...d, lang: e.target.value }))}
          placeholder="en-GB"
          disabled={disabled || busy}
        />
      </label>
      <label className="field">
        <span>Contact email</span>
        <input
          value={draft.contactEmail ?? ""}
          onChange={(e) => setDraft((d) => ({ ...d, contactEmail: e.target.value }))}
          disabled={disabled || busy}
        />
      </label>
      <label className="field">
        <span>Footer copyright</span>
        <input
          value={draft.copyright ?? ""}
          onChange={(e) => setDraft((d) => ({ ...d, copyright: e.target.value }))}
          disabled={disabled || busy}
        />
      </label>
      <div className="actions">
        <button type="button" onClick={() => void save()} disabled={disabled || busy}>
          Save site.json
        </button>
        <button type="button" className="ghost" onClick={() => void load()} disabled={disabled || busy}>
          Reload
        </button>
      </div>
      {status ? <p className="muted">{status}</p> : null}
    </div>
  )
}
