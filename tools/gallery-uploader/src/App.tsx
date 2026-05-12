import { convertFileSrc, invoke } from "@tauri-apps/api/core"
import { getCurrentWebview } from "@tauri-apps/api/webview"
import { open } from "@tauri-apps/plugin-dialog"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  buildGalleryFilename,
  isAllowedImagePath,
  normalizeExtensionFromPath,
} from "./buildFilename"
import { PhotoPanels } from "./PhotoPanels"
import type { UploadRow } from "./types"
import "./App.css"

type AppConfig = {
  repoUrl: string
  branch: string
  workdir: string
}

type ImageHints = {
  description: string | null
  dateTimeOriginalIso: string | null
  make: string | null
  model: string | null
}

function parseLocalDateTime(iso: string | null): { local: string; date: Date } | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  const pad = (n: number) => String(n).padStart(2, "0")
  const local = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  return { local, date: d }
}

function rowFieldsFromRow(r: UploadRow) {
  const raw = r.dateTimeLocal.trim()
  const captured =
    raw.length >= 16 ? new Date(raw.length === 16 ? `${raw}:00` : raw) : null
  const tags = r.tags
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean)
  return {
    title: r.title,
    tags,
    location: r.location,
    capturedAt: captured && !Number.isNaN(captured.getTime()) ? captured : null,
    dateOnly: r.dateOnly,
    camera: r.camera,
    event: r.event,
  }
}

function destPreviewForRow(r: UploadRow): string | null {
  if (!r.title.trim()) return null
  return buildGalleryFilename(rowFieldsFromRow(r), r.extension)
}

function newRowFromPath(path: string): UploadRow {
  return {
    id: crypto.randomUUID(),
    sourcePath: path,
    previewSrc: convertFileSrc(path),
    title: "",
    tags: "photos",
    location: "",
    dateTimeLocal: "",
    dateOnly: false,
    camera: "",
    event: "",
    extension: normalizeExtensionFromPath(path),
    destFilename: "",
    destExists: false,
  }
}

export default function App() {
  const [config, setConfig] = useState<AppConfig | null>(null)
  const [repoUrl, setRepoUrl] = useState("https://github.com/")
  const [branch, setBranch] = useState("master")
  const [pat, setPat] = useState("")
  const [hasPatState, setHasPatState] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [repoPreparing, setRepoPreparing] = useState(false)
  const [dragOverWindow, setDragOverWindow] = useState(false)
  const [rows, setRows] = useState<UploadRow[]>([])
  const rowsRef = useRef(rows)
  rowsRef.current = rows
  const [commitMessage, setCommitMessage] = useState("")
  /** Multi-line trace for the last failed upload (shown in expandable details). */
  const [errorDetail, setErrorDetail] = useState<string | null>(null)
  const repoPrepareLock = useRef(false)
  const uploadBusyRef = useRef(false)

  const allTitlesOk = useMemo(
    () => rows.length > 0 && rows.every((r) => r.title.trim().length > 0),
    [rows],
  )

  const load = useCallback(async () => {
    const c = await invoke<AppConfig | null>("load_config")
    if (c) {
      setConfig(c)
      setRepoUrl(c.repoUrl)
      setBranch(c.branch)
    } else {
      setConfig(null)
    }
    setHasPatState(await invoke<boolean>("has_pat"))
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const needsSetup = config === null

  const ingestPaths = useCallback(async (paths: string[]) => {
    const unique = [...new Set(paths)]
    const filtered = unique.filter(isAllowedImagePath)
    if (filtered.length === 0) {
      setStatus("No supported images in that drop (jpg, png, webp, avif, gif).")
      return
    }
    setBusy(true)
    setStatus(null)
    setErrorDetail(null)
    try {
      const nextRows: UploadRow[] = []
      for (const p of filtered) {
        const row = newRowFromPath(p)
        const hints = await invoke<ImageHints>("read_image_hints", { path: p })
        const parsed = parseLocalDateTime(hints.dateTimeOriginalIso)
        if (parsed) {
          row.dateTimeLocal = parsed.local
        }
        const camParts = [hints.make, hints.model].filter(Boolean) as string[]
        if (camParts.length) row.camera = camParts.join(" ")
        nextRows.push(row)
      }
      const have = new Set(rowsRef.current.map((x) => x.sourcePath))
      const add = nextRows.filter((row) => !have.has(row.sourcePath))
      if (add.length > 0) {
        setRows((r) => [...r, ...add])
      }
      if (add.length === 0 && nextRows.length > 0) {
        setStatus("Those files are already in the list.")
      } else if (add.length > 0) {
        setStatus(`Added ${add.length} file(s). Enter a title for each, then upload when you are ready.`)
      }
    } catch (e) {
      setStatus(String(e))
    } finally {
      setBusy(false)
    }
  }, [])

  useEffect(() => {
    let unlisten: (() => void) | undefined
    let cancelled = false
    void getCurrentWebview()
      .onDragDropEvent((e) => {
        const t = e.payload.type
        if (t === "enter" || t === "over") setDragOverWindow(true)
        if (t === "leave" || t === "drop") setDragOverWindow(false)
        if (t === "drop" && e.payload.paths.length > 0) {
          void ingestPaths(e.payload.paths)
        }
      })
      .then((fn) => {
        if (cancelled) {
          fn()
          return
        }
        unlisten = fn
      })
    return () => {
      cancelled = true
      unlisten?.()
    }
  }, [ingestPaths])

  const runRepoPrepare = useCallback(async (context: "manual" | "after-save") => {
    if (repoPrepareLock.current) return
    repoPrepareLock.current = true
    setRepoPreparing(true)
    if (context === "after-save") {
      setStatus("Settings saved. Preparing repository…")
    } else {
      setStatus(null)
    }
    try {
      const msg = await invoke<string>("ensure_repo_ready")
      if (context === "after-save") {
        setStatus(`Settings saved. ${msg}`)
      } else {
        setStatus(msg)
      }
    } catch (e) {
      const err = String(e)
      if (context === "after-save") {
        setStatus(`Settings saved, but the repository could not be prepared: ${err}`)
      } else {
        setStatus(err)
      }
    } finally {
      repoPrepareLock.current = false
      setRepoPreparing(false)
    }
  }, [])

  const saveSettings = async () => {
    setBusy(true)
    setStatus(null)
    let ok = false
    try {
      const next: AppConfig = { repoUrl, branch, workdir: "" }
      await invoke("save_config", { config: next })
      if (pat.trim()) {
        await invoke("save_pat", { pat: pat.trim() })
        setPat("")
      }
      await load()
      ok = true
    } catch (e) {
      setStatus(String(e))
    } finally {
      setBusy(false)
    }
    if (ok) void runRepoPrepare("after-save")
  }

  const prepareRepo = () => {
    void runRepoPrepare("manual")
  }

  const addFiles = async () => {
    const picked = await open({
      multiple: true,
      filters: [
        {
          name: "Images",
          extensions: ["jpg", "jpeg", "png", "webp", "avif", "gif"],
        },
      ],
    })
    const paths =
      picked === null
        ? []
        : Array.isArray(picked)
          ? picked
          : [picked]
    if (paths.length === 0) return
    await ingestPaths(paths)
  }

  const destKey = useMemo(
    () =>
      rows
        .map((r) =>
          [
            r.id,
            r.title,
            r.tags,
            r.location,
            r.dateTimeLocal,
            r.dateOnly ? "1" : "0",
            r.camera,
            r.event,
            r.extension,
          ].join("\x1e"),
        )
        .join("\x1f"),
    [rows],
  )

  const enrichRowsWithDest = useCallback(async (list: UploadRow[]): Promise<UploadRow[]> => {
    const updated: UploadRow[] = []
    for (const r of list) {
      const dest = r.title.trim() ? buildGalleryFilename(rowFieldsFromRow(r), r.extension) : ""
      let destExists = false
      if (dest) {
        try {
          destExists = await invoke<boolean>("gallery_dest_exists", {
            destFilename: dest,
          })
        } catch {
          destExists = false
        }
      }
      updated.push({ ...r, destFilename: dest, destExists })
    }
    return updated
  }, [])

  useEffect(() => {
    if (rows.length === 0) return
    const id = setTimeout(() => {
      void (async () => {
        const list = rowsRef.current
        if (list.length === 0) return
        const updated = await enrichRowsWithDest(list)
        setRows((cur) => {
          if (cur.length !== updated.length) return cur
          if (!cur.every((r, i) => r.id === updated[i].id)) return cur
          const unchanged = cur.every(
            (r, i) =>
              r.destFilename === updated[i].destFilename && r.destExists === updated[i].destExists,
          )
          if (unchanged) return cur
          return cur.map((r, i) => ({
            ...r,
            destFilename: updated[i].destFilename,
            destExists: updated[i].destExists,
          }))
        })
      })()
    }, 450)
    return () => clearTimeout(id)
  }, [destKey, rows.length, enrichRowsWithDest])

  const clearRows = () => {
    setRows([])
    setStatus(null)
    setErrorDetail(null)
  }

  const updateRow = (id: string, patch: Partial<UploadRow>) => {
    setRows((list) => list.map((x) => (x.id === id ? { ...x, ...patch } : x)))
  }

  const canUpload =
    allTitlesOk && rows.length > 0 && !busy && !repoPreparing && !rows.some((r) => r.destExists)

  const uploadPics = async () => {
    if (!allTitlesOk) {
      setStatus("Enter a title for every photo before uploading.")
      setErrorDetail(null)
      return
    }
    if (rows.length === 0) return
    if (uploadBusyRef.current) return
    uploadBusyRef.current = true
    setBusy(true)
    setErrorDetail(null)
    const lines: string[] = []
    const trace = (s: string) => {
      lines.push(s)
    }
    setStatus("Checking filenames…")
    try {
      trace(`Filenames: ${rows.length} photo(s) queued.`)
      const ready = await enrichRowsWithDest(rows)
      if (ready.some((r) => r.destExists)) {
        const clash = ready.filter((r) => r.destExists).map((r) => r.destFilename)
        trace(`Conflict check: these names already exist in the repo: ${clash.join(", ")}`)
        setRows(ready)
        setStatus(
          "A file with the same name is already in this gallery. Change titles or tags so each name is unique, then try again.",
        )
        setErrorDetail(lines.join("\n"))
        return
      }
      setRows(ready)
      trace(`Planned files:\n${ready.map((r) => `${r.destFilename}  <=  ${r.sourcePath}`).join("\n")}`)
      setStatus("Copying photos into the gallery…")
      await invoke("stage_gallery_files", {
        items: ready.map((r) => ({
          sourcePath: r.sourcePath,
          destFilename: r.destFilename,
        })),
      })
      trace("Copy into public/gallery completed (stage_gallery_files OK).")
      setStatus("Publishing…")
      const msg = await invoke<string>("git_commit_and_push", {
        message: commitMessage.trim() || "Add photos",
      })
      trace(`git_commit_and_push returned: ${msg}`)
      if (/nothing to commit/i.test(msg)) {
        trace(
          "Hint: gallery images are usually gitignored; the app uses “git add -f”. If you still see this, update the uploader or check the repo .gitignore.",
        )
        setStatus("Upload copied files, but Git reported nothing new to publish. See technical details below.")
        setErrorDetail(lines.join("\n"))
        return
      }
      setRows([])
      setErrorDetail(null)
      setStatus(msg || "Upload finished. Your photos should appear on the site after the next deploy.")
    } catch (e) {
      const err = String(e)
      trace(`Error: ${err}`)
      setStatus("Upload failed. See technical details below.")
      setErrorDetail(lines.join("\n"))
    } finally {
      setBusy(false)
      uploadBusyRef.current = false
    }
  }

  const clearToken = async () => {
    setBusy(true)
    try {
      await invoke("clear_pat")
      await load()
      setStatus("Saved token removed from this PC.")
    } catch (e) {
      setStatus(String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={`app${dragOverWindow ? " drag-over-window" : ""}`}>
      <header className="header">
        <div>
          <h1>Galleree upload</h1>
          <p className="lede">
            Add photos with drag-and-drop or Add files, fill in titles and details, then choose Upload pics. Files go
            under <code>public/gallery/</code> on your gallery site repository. Git must be installed and on PATH.
          </p>
        </div>
      </header>

      {needsSetup ? (
        <section className="card">
          <h2>First-time setup</h2>
          <label className="field">
            <span>HTTPS repository URL</span>
            <input
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              placeholder="https://github.com/you/galleree.git"
              autoComplete="off"
            />
          </label>
          <label className="field">
            <span>Branch</span>
            <input value={branch} onChange={(e) => setBranch(e.target.value)} />
          </label>
          <label className="field">
            <span>GitHub personal access token (repo scope)</span>
            <input
              type="password"
              value={pat}
              onChange={(e) => setPat(e.target.value)}
              placeholder={hasPatState ? "Token already saved — enter to replace" : "ghp_…"}
              autoComplete="off"
            />
          </label>
          <div className="actions">
            <button type="button" onClick={() => void saveSettings()} disabled={busy}>
              Save settings
            </button>
            {hasPatState ? (
              <button type="button" className="ghost" onClick={() => void clearToken()} disabled={busy}>
                Remove saved token
              </button>
            ) : null}
          </div>
        </section>
      ) : (
        <>
          <section className="card">
            <h2>Gallery project</h2>
            <p className="muted">
              <code>{config?.repoUrl}</code> · branch <code>{config?.branch}</code>
              <br />
              Local copy: <code>{config?.workdir}</code>
            </p>
            {repoPreparing ? <p className="muted">Syncing…</p> : null}
            <div className="actions">
              <button type="button" onClick={() => void prepareRepo()} disabled={busy || repoPreparing}>
                Sync gallery project
              </button>
              <button
                type="button"
                className="ghost"
                onClick={() => {
                  if (config) {
                    setRepoUrl(config.repoUrl)
                    setBranch(config.branch)
                  }
                  setConfig(null)
                }}
                disabled={busy || repoPreparing}
              >
                Edit settings…
              </button>
            </div>
          </section>

          <section className="card">
            <h2>Photos</h2>
            <div className="actions">
              <button type="button" onClick={() => void addFiles()} disabled={busy}>
                Add files…
              </button>
              <button type="button" className="ghost" onClick={clearRows} disabled={busy || rows.length === 0}>
                Clear list
              </button>
            </div>

            {rows.length > 0 ? (
              <PhotoPanels rows={rows} updateRow={updateRow} getDestPreview={destPreviewForRow} />
            ) : (
              <p className="muted">No files yet.</p>
            )}

            <label className="field">
              <span>Optional note for this upload</span>
              <input
                value={commitMessage}
                onChange={(e) => setCommitMessage(e.target.value)}
                placeholder="e.g. Crewe protest, March 2026"
                autoComplete="off"
              />
            </label>
            <div className="actions">
              <button type="button" className="primary" onClick={() => void uploadPics()} disabled={!canUpload}>
                Upload pics
              </button>
            </div>
          </section>
        </>
      )}

      {status ? (
        <div className={`status${errorDetail ? " status--error" : ""}`}>{status}</div>
      ) : null}
      {errorDetail ? (
        <details className="error-log">
          <summary>Technical details</summary>
          <pre className="error-log__pre">{errorDetail}</pre>
        </details>
      ) : null}
    </div>
  )
}
