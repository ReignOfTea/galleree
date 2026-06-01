import { useCallback, useEffect, useState } from "react"
import { normalizeSiteConfig, type SiteConfig } from "@galleree/site-config"
import { mergeSiteConfigIntoRaw } from "../lib/siteJsonEdit"
import { appInvoke } from "../tauriBridge"

type Props = {
  disabled?: boolean
  /** Bump after “Sync gallery project” so site.json is re-read from the clone. */
  reloadKey?: number
  /** Called after site.json is saved (refresh photo copyright defaults). */
  onSaved?: () => void
}

const emptyDraft = (): SiteConfig => ({
  title: "",
  tagline: "",
})

function parseSiteJsonRaw(raw: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(raw || "{}")
    if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>
    }
  } catch {
    /* fall through */
  }
  return {}
}

export function SiteConfigPanel({ disabled = false, reloadKey = 0, onSaved }: Props) {
  const [draft, setDraft] = useState<SiteConfig>(emptyDraft)
  const [loaded, setLoaded] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setStatus(null)
    try {
      const raw = await appInvoke<string>("read_site_json")
      const parsed = parseSiteJsonRaw(raw)
      setDraft(normalizeSiteConfig(parsed))
      setLoaded(true)
    } catch (e) {
      setLoaded(false)
      setStatus(String(e))
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load, reloadKey])

  const save = async () => {
    setBusy(true)
    setStatus(null)
    try {
      const raw = await appInvoke<string>("read_site_json")
      const base = parseSiteJsonRaw(raw)
      const merged = mergeSiteConfigIntoRaw(base, draft)
      const normalized = normalizeSiteConfig(merged)
      await appInvoke("write_site_json", {
        json: `${JSON.stringify(merged, null, 2)}\n`,
      })
      setDraft(normalized)
      setLoaded(true)
      setStatus(
        "Saved site.json (form fields updated; logo, social links, and other keys were kept). Included on the next Upload / publish.",
      )
      onSaved?.()
    } catch (e) {
      setStatus(String(e))
    } finally {
      setBusy(false)
    }
  }

  if (!loaded) {
    return (
      <div className="site-config-panel">
        <p className="muted">Loading site settings…</p>
        {status ? <p className="status status--error">{status}</p> : null}
        <div className="actions">
          <button type="button" className="ghost" onClick={() => void load()} disabled={disabled}>
            Retry load
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="site-config-panel">
      <p className="muted site-config-panel__lede">
        Edit <code>public/site.json</code> in your local gallery checkout. Logo, social links, and
        filter labels are kept when you save; only the fields below are changed. After syncing the
        project, click <strong>Reload</strong> if values look empty.
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
      {status ? (
        <p className={status.includes("failed") || status.includes("not found") ? "status status--error" : "muted"}>
          {status}
        </p>
      ) : null}
    </div>
  )
}
