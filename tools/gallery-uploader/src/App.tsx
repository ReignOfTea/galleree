import {
  appConvertFileSrc,
  appInvoke,
  appOpenFiles,
  isTauri,
  listenDragDropEvents,
  TAURI_REQUIRED_MESSAGE,
} from "./tauriBridge"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  galleryMetaFromUploadFields,
  randomGalleryImageFilename,
  serializeGalleryMeta,
} from "@galleree/gallery-meta"
import { isAllowedImagePath, normalizeExtensionFromPath } from "./imageExtensions"
import { matchEquipmentSlug } from "./matchRegistry"
import { RegistryCreateModal } from "./components/RegistryCreateModal"
import { PhotoPanels } from "./PhotoPanels"
import { fetchGalleryImages } from "./registryService"
import {
  resolveCameraValue,
  resolveCollectionSlug,
  resolveLensValue,
} from "./registryUpload"
import type {
  CoverCandidate,
  GalleryImageRef,
  GalleryRegistries,
  RegistryModalRequest,
} from "./registryTypes"
import { SELECT_CUSTOM, SELECT_NONE } from "./registryTypes"
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

function parseIsoToCaptureDate(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function rowFieldsFromRow(r: UploadRow) {
  const raw = r.captureDate.trim()
  let captured: Date | null = null
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const [y, mo, day] = raw.split("-").map(Number)
    const d = new Date(y, mo - 1, day, 0, 0, 0)
    captured = Number.isNaN(d.getTime()) ? null : d
  }
  const tags = r.tags
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean)
  const sortRaw = r.sortOrder.trim()
  let sortOrder: number | null = null
  if (sortRaw) {
    const n = Number(sortRaw)
    if (Number.isFinite(n)) sortOrder = n
  }
  return {
    title: r.title,
    description: r.description,
    tags,
    location: r.location,
    capturedAt: captured,
    camera: resolveCameraValue(r),
    lens: resolveLensValue(r),
    collectionSlug: resolveCollectionSlug(r),
    alt: r.alt,
    hidden: r.hidden,
    sortOrder,
    copyright: r.copyright,
  }
}

function destPreviewForRow(
  r: UploadRow,
  takenNames: ReadonlySet<string>,
): { id: string; file: string } | null {
  if (!r.title.trim()) return null
  return randomGalleryImageFilename(r.extension, takenNames)
}

function newRowFromPath(path: string): UploadRow {
  return {
    id: crypto.randomUUID(),
    sourcePath: path,
    previewSrc: appConvertFileSrc(path),
    title: "",
    description: "",
    tags: "photos",
    location: "",
    captureDate: "",
    cameraSelect: SELECT_NONE,
    cameraCustom: "",
    lensSelect: SELECT_NONE,
    lensCustom: "",
    collectionSelect: SELECT_NONE,
    alt: "",
    hidden: false,
    sortOrder: "",
    copyright: "",
    extension: normalizeExtensionFromPath(path),
    destId: "",
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
  const [registries, setRegistries] = useState<GalleryRegistries>({
    collections: [],
    cameras: [],
    lenses: [],
  })
  const [registryModal, setRegistryModal] = useState<RegistryModalRequest | null>(null)
  const [galleryImages, setGalleryImages] = useState<GalleryImageRef[]>([])
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

  const getDestPreview = useCallback(
    (r: UploadRow) => {
      const taken = new Set<string>()
      for (const row of rows) {
        if (row.id === r.id) continue
        if (row.destFilename) taken.add(row.destFilename.toLowerCase())
      }
      return destPreviewForRow(r, taken)
    },
    [rows],
  )

  const refreshRegistries = useCallback(async () => {
    if (!config) return
    try {
      const next = await appInvoke<GalleryRegistries>("list_gallery_registries")
      setRegistries(next)
    } catch {
      setRegistries({ collections: [], cameras: [], lenses: [] })
    }
  }, [config])

  const loadGalleryImages = useCallback(async () => {
    if (!config) return
    try {
      setGalleryImages(await fetchGalleryImages())
    } catch {
      setGalleryImages([])
    }
  }, [config])

  const coverCandidates = useMemo((): CoverCandidate[] => {
    const fromUpload = rows
      .filter((r) => r.destId && r.title.trim())
      .map((r) => ({
        id: r.destId,
        label: r.title.trim(),
        source: "upload" as const,
      }))
    const fromGallery = galleryImages.map((img) => ({
      id: img.id,
      label: img.title?.trim() || img.id.slice(0, 8),
      source: "gallery" as const,
    }))
    return [...fromUpload, ...fromGallery]
  }, [rows, galleryImages])

  useEffect(() => {
    if (registryModal?.kind === "collection") void loadGalleryImages()
  }, [registryModal?.kind, loadGalleryImages])

  const load = useCallback(async () => {
    const c = await appInvoke<AppConfig | null>("load_config")
    if (c) {
      setConfig(c)
      setRepoUrl(c.repoUrl)
      setBranch(c.branch)
    } else {
      setConfig(null)
    }
    setHasPatState(await appInvoke<boolean>("has_pat"))
  }, [])

  useEffect(() => {
    if (!isTauri()) {
      setStatus(TAURI_REQUIRED_MESSAGE)
      return
    }
    void load()
  }, [load])

  useEffect(() => {
    if (config) void refreshRegistries()
  }, [config, refreshRegistries])

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
        const hints = await appInvoke<ImageHints>("read_image_hints", { path: p })
        const parsed = parseIsoToCaptureDate(hints.dateTimeOriginalIso)
        if (parsed) {
          row.captureDate = parsed
        }
        const camParts = [hints.make, hints.model].filter(Boolean) as string[]
        if (camParts.length) {
          const label = camParts.join(" ")
          const slug = matchEquipmentSlug(label, registries.cameras)
          if (slug) {
            row.cameraSelect = slug
          } else {
            row.cameraSelect = SELECT_CUSTOM
            row.cameraCustom = label
          }
        }
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
  }, [registries.cameras])

  useEffect(() => {
    if (!isTauri()) return
    let unlisten: (() => void) | undefined
    let cancelled = false
    void listenDragDropEvents({
      onEnterOrOver: () => setDragOverWindow(true),
      onLeaveOrDrop: () => setDragOverWindow(false),
      onDrop: (paths) => void ingestPaths(paths),
    }).then((fn) => {
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
      const msg = await appInvoke<string>("ensure_repo_ready")
      if (context === "after-save") {
        setStatus(`Settings saved. ${msg}`)
      } else {
        setStatus(msg)
      }
      await refreshRegistries()
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
  }, [refreshRegistries])

  const saveSettings = async () => {
    setBusy(true)
    setStatus(null)
    let ok = false
    try {
      const next: AppConfig = { repoUrl, branch, workdir: "" }
      await appInvoke("save_config", { config: next })
      if (pat.trim()) {
        await appInvoke("save_pat", { pat: pat.trim() })
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
    const paths = await appOpenFiles()
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
            r.captureDate,
            r.cameraSelect,
            r.lensSelect,
            r.collectionSelect,
            r.description,
            r.hidden,
            r.sortOrder,
            r.extension,
          ].join("\x1e"),
        )
        .join("\x1f"),
    [rows],
  )

  const enrichRowsWithDest = useCallback(async (list: UploadRow[]): Promise<UploadRow[]> => {
    const taken = new Set<string>()
    const updated: UploadRow[] = []
    for (const r of list) {
      const dest = destPreviewForRow(r, taken)
      if (dest) taken.add(dest.file.toLowerCase())
      let destExists = false
      if (dest) {
        try {
          destExists = await appInvoke<boolean>("gallery_dest_exists", {
            destFilename: dest.file,
          })
        } catch {
          destExists = false
        }
      }
      updated.push({
        ...r,
        destId: dest?.id ?? "",
        destFilename: dest?.file ?? "",
        destExists,
      })
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
              r.destId === updated[i].destId &&
              r.destFilename === updated[i].destFilename &&
              r.destExists === updated[i].destExists,
          )
          if (unchanged) return cur
          return cur.map((r, i) => ({
            ...r,
            destId: updated[i].destId,
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

  const handleRegistryCreated = useCallback(
    (slug: string) => {
      const req = registryModal
      if (req?.rowId && req.field) {
        const patch: Partial<UploadRow> =
          req.field === "collectionSelect"
            ? { collectionSelect: slug }
            : req.field === "cameraSelect"
              ? { cameraSelect: slug }
              : { lensSelect: slug }
        updateRow(req.rowId, patch)
      }
      setRegistryModal(null)
      void refreshRegistries()
    },
    [registryModal, refreshRegistries],
  )

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
          "A file with the same name is already in this gallery. Change a title so each name is unique, then try again.",
        )
        setErrorDetail(lines.join("\n"))
        return
      }
      setRows(ready)
      trace(`Planned files:\n${ready.map((r) => `${r.destFilename}  <=  ${r.sourcePath}`).join("\n")}`)

      setStatus("Copying photos into the gallery…")
      await appInvoke("stage_gallery_files", {
        items: ready.map((r) => ({
          sourcePath: r.sourcePath,
          destFilename: r.destFilename,
          metaJson: serializeGalleryMeta(
            galleryMetaFromUploadFields(rowFieldsFromRow(r), r.destId),
          ),
        })),
      })
      trace("Copy into public/gallery completed (stage_gallery_files OK).")
      setStatus("Publishing…")
      const msg = await appInvoke<string>("git_commit_and_push", {
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
      await appInvoke("clear_pat")
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
            Add photos with drag-and-drop or Add files, fill in titles and details, then choose Upload pics. Each photo
            is saved under <code>public/gallery/</code> with a matching{" "}
            <code>public/gallery/meta/*.json</code> sidecar on your gallery site repository. Files over GitHub’s
            per-file limit
            (~100 MiB) are resized before staging so pushes are accepted. Git must be installed and on PATH.
          </p>
        </div>
      </header>

      {!isTauri() ? (
        <div className="status status--error" role="alert">
          {TAURI_REQUIRED_MESSAGE}
        </div>
      ) : null}

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
            <p className="muted registry-project-hint">
              Create collections, cameras, and lenses before uploading so you can assign them to
              photos. Equipment can include a product image; collections can pick a cover photo.
            </p>
            <div className="actions registry-project-actions">
              <button
                type="button"
                className="ghost"
                onClick={() => setRegistryModal({ kind: "collection" })}
                disabled={busy || repoPreparing}
              >
                New collection…
              </button>
              <button
                type="button"
                className="ghost"
                onClick={() => setRegistryModal({ kind: "camera" })}
                disabled={busy || repoPreparing}
              >
                New camera…
              </button>
              <button
                type="button"
                className="ghost"
                onClick={() => setRegistryModal({ kind: "lens" })}
                disabled={busy || repoPreparing}
              >
                New lens…
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
              <PhotoPanels
                rows={rows}
                registries={registries}
                updateRow={updateRow}
                getDestPreview={getDestPreview}
                onOpenRegistryCreate={setRegistryModal}
              />
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

      {registryModal ? (
        <RegistryCreateModal
          kind={registryModal.kind}
          registries={registries}
          coverCandidates={coverCandidates}
          onCreated={handleRegistryCreated}
          onClose={() => setRegistryModal(null)}
        />
      ) : null}
    </div>
  )
}
