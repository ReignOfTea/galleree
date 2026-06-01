import {
  appConvertFileSrc,
  appInvoke,
  appOpenFiles,
  appOpenFolder,
  isTauri,
  listenDragDropEvents,
  TAURI_REQUIRED_MESSAGE,
} from "./tauriBridge"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  galleryMetaFromUploadFields,
  isValidGalleryImageId,
  normalizeImageExtension,
  randomGalleryImageFilename,
  serializeGalleryMeta,
} from "@galleree/gallery-meta"
import { isAllowedImagePath, normalizeExtensionFromPath } from "./imageExtensions"
import { RegistryCreateModal } from "./components/RegistryCreateModal"
import { RegistryListsPanel } from "./components/RegistryListsPanel"
import { PhotoPanels } from "./PhotoPanels"
import {
  fetchGalleryImages,
  fetchGalleryTags,
  setCollectionCoverPhoto,
} from "./registryService"
import { applyImageHints } from "./lib/applyImageHints"
import { uploadRowFromGalleryEdit } from "./lib/galleryEditRow"
import { normalizeKnownTags, parseTagList } from "./lib/tagSuggest"
import { BatchEditBar } from "./components/BatchEditBar"
import { SiteConfigPanel } from "./components/SiteConfigPanel"
import { titleFromFilename } from "./lib/titleFromFilename"
import { fetchSiteCopyrightDefault } from "./lib/siteCopyrightDefault"
import {
  formatDuplicateSkipMessage,
  type CheckDuplicatePathsResult,
} from "./lib/duplicatePaths"
import {
  buildDraftSession,
  clearDraftSession,
  draftRowToUpload,
  formatDraftRestoreMessage,
  loadDraftSession,
  saveDraftSession,
} from "./lib/draftSession"
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
import { SELECT_NONE } from "./registryTypes"
import type { GalleryPhotoEdit, UploadRow } from "./types"
import "./App.css"

type AppConfig = {
  repoUrl: string
  branch: string
  workdir: string
}

function captureDateFromRow(r: UploadRow): Date | null {
  const iso = r.captureDateTimeIso.trim()
  if (iso) {
    const d = new Date(iso)
    if (!Number.isNaN(d.getTime())) return d
  }
  const raw = r.captureDate.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const [y, mo, day] = raw.split("-").map(Number)
    const d = new Date(y, mo - 1, day, 0, 0, 0)
    return Number.isNaN(d.getTime()) ? null : d
  }
  return null
}

function rowFieldsFromRow(r: UploadRow) {
  const captured = captureDateFromRow(r)
  const tags = parseTagList(r.tags)
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
  if (r.editExistingId && r.destFilename) {
    return { id: r.editExistingId, file: r.destFilename }
  }
  if (!r.title.trim()) return null
  const ext = normalizeImageExtension(r.extension)
  if (isValidGalleryImageId(r.destId)) {
    const file = `${r.destId}${ext}`
    if (!takenNames.has(file.toLowerCase())) {
      return { id: r.destId, file }
    }
  }
  return randomGalleryImageFilename(r.extension, takenNames)
}

function newRowFromPath(path: string, copyrightDefault = ""): UploadRow {
  return {
    id: crypto.randomUUID(),
    sourcePath: path,
    previewSrc: appConvertFileSrc(path),
    title: "",
    description: "",
    tags: "photos",
    location: "",
    captureDate: "",
    captureDateTimeIso: "",
    cameraSelect: SELECT_NONE,
    cameraCustom: "",
    lensSelect: SELECT_NONE,
    lensCustom: "",
    collectionSelect: SELECT_NONE,
    collectionSetCover: false,
    alt: "",
    hidden: false,
    sortOrder: "",
    copyright: copyrightDefault,
    extension: normalizeExtensionFromPath(path),
    destId: "",
    destFilename: "",
    destExists: false,
    editExistingId: null,
    preserveUploadedAt: null,
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
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(() => new Set())
  const [updateNotice, setUpdateNotice] = useState<string | null>(null)
  const [repoSyncKey, setRepoSyncKey] = useState(0)
  const [registries, setRegistries] = useState<GalleryRegistries>({
    collections: [],
    cameras: [],
    lenses: [],
  })
  const [registryModal, setRegistryModal] = useState<RegistryModalRequest | null>(null)
  const [galleryImages, setGalleryImages] = useState<GalleryImageRef[]>([])
  const [galleryTags, setGalleryTags] = useState<string[]>([])
  const rowsRef = useRef(rows)
  rowsRef.current = rows
  const [commitMessage, setCommitMessage] = useState("")
  /** Multi-line trace for the last failed upload (shown in expandable details). */
  const [errorDetail, setErrorDetail] = useState<string | null>(null)
  const repoPrepareLock = useRef(false)
  const uploadBusyRef = useRef(false)
  const defaultCopyrightRef = useRef("")
  const [copyrightPlaceholder, setCopyrightPlaceholder] = useState("")
  const persistReadyRef = useRef(false)
  const restoringDraftRef = useRef(false)
  const selectedRowIdsKey = useMemo(
    () => [...selectedRowIds].sort().join("\u0001"),
    [selectedRowIds],
  )

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

  const loadGalleryTags = useCallback(async () => {
    if (!config) return
    try {
      setGalleryTags(await fetchGalleryTags())
    } catch {
      setGalleryTags([])
    }
  }, [config])

  const knownTags = useMemo(() => {
    const merged: string[] = [...galleryTags]
    for (const row of rows) {
      merged.push(...parseTagList(row.tags))
    }
    return normalizeKnownTags(merged)
  }, [galleryTags, rows])

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

  const refreshSiteCopyrightDefault = useCallback(async () => {
    const value = await fetchSiteCopyrightDefault()
    defaultCopyrightRef.current = value
    setCopyrightPlaceholder(value)
  }, [])

  useEffect(() => {
    if (config) {
      void refreshRegistries()
      void loadGalleryTags()
      void loadGalleryImages()
      void refreshSiteCopyrightDefault()
      setRepoSyncKey((k) => k + 1)
    }
  }, [config, refreshRegistries, loadGalleryTags, loadGalleryImages, refreshSiteCopyrightDefault])

  useEffect(() => {
    if (!config) return
    void refreshSiteCopyrightDefault()
  }, [config, repoSyncKey, refreshSiteCopyrightDefault])

  useEffect(() => {
    if (!config || !isTauri()) return
    let cancelled = false
    void (async () => {
      try {
        const info = await appInvoke<{
          currentVersion: string
          latestVersion: string | null
          downloadUrl: string | null
          notes: string | null
          updateAvailable: boolean
        }>("check_for_app_update")
        if (cancelled || !info.updateAvailable || !info.latestVersion) return
        const url = info.downloadUrl ?? "GitHub Releases"
        setUpdateNotice(
          `Update available: v${info.latestVersion} (you have v${info.currentVersion}). Download from ${url}.`,
        )
      } catch {
        /* offline or non-GitHub repo — ignore */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [config])

  const clearPersistedDraft = useCallback(async () => {
    try {
      await clearDraftSession()
    } catch {
      /* ignore */
    }
  }, [])

  const restoreDraft = useCallback(async () => {
    if (!config) return
    restoringDraftRef.current = true
    persistReadyRef.current = false
    try {
      const { session, skippedPaths } = await loadDraftSession()
      if (
        !session ||
        session.repoUrl !== config.repoUrl ||
        session.branch !== config.branch
      ) {
        return
      }
      const restored = session.rows.map(draftRowToUpload)
      setRows(restored)
      setCommitMessage(session.commitMessage)
      const ids = new Set(restored.map((r) => r.id))
      setSelectedRowIds(
        new Set(session.selectedRowIds.filter((id) => ids.has(id))),
      )
      const msg = formatDraftRestoreMessage(restored.length, skippedPaths)
      if (msg) setStatus(msg)
    } catch {
      /* corrupt or missing draft file */
    } finally {
      restoringDraftRef.current = false
      persistReadyRef.current = true
    }
  }, [config])

  useEffect(() => {
    if (!config) {
      persistReadyRef.current = false
      return
    }
    void restoreDraft()
  }, [config?.repoUrl, config?.branch, restoreDraft])

  useEffect(() => {
    if (!config || !persistReadyRef.current || restoringDraftRef.current) return
    const timer = window.setTimeout(() => {
      void saveDraftSession(
        buildDraftSession(
          config.repoUrl,
          config.branch,
          rowsRef.current,
          commitMessage,
          selectedRowIds,
        ),
      ).catch(() => {
        /* ignore */
      })
    }, 500)
    return () => window.clearTimeout(timer)
  }, [rows, commitMessage, selectedRowIdsKey, config])

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
      let pathsToAdd = filtered
      let duplicateNote = ""
      if (config) {
        try {
          const dup = await appInvoke<CheckDuplicatePathsResult>("check_duplicate_paths", {
            paths: filtered,
            queuedPaths: rowsRef.current.map((r) => r.sourcePath),
          })
          pathsToAdd = dup.okPaths
          if (dup.duplicates.length > 0) {
            duplicateNote = formatDuplicateSkipMessage(dup.duplicates)
          }
        } catch (e) {
          setStatus(
            `Could not check for duplicates (${String(e)}). Add files anyway, or sync the gallery project and retry.`,
          )
          return
        }
      }

      if (pathsToAdd.length === 0) {
        setStatus(
          duplicateNote || "Every selected file is already in the gallery or the upload list.",
        )
        return
      }

      const nextRows: UploadRow[] = []
      const copyrightDefault = defaultCopyrightRef.current
      for (const p of pathsToAdd) {
        const row = newRowFromPath(p, copyrightDefault)
        const hints = await appInvoke<{
          description: string | null
          dateTimeOriginalIso: string | null
          make: string | null
          model: string | null
          lensModel: string | null
        }>("read_image_hints", { path: p })
        applyImageHints(
          row,
          {
            description: hints.description,
            dateTimeOriginalIso: hints.dateTimeOriginalIso,
            make: hints.make,
            model: hints.model,
            lensModel: hints.lensModel,
          },
          registries,
        )
        if (!row.title.trim()) {
          row.title = titleFromFilename(p)
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
        const added = `Added ${add.length} file(s). Enter a title for each, then upload when you are ready.`
        setStatus(duplicateNote ? `${added}\n\n${duplicateNote}` : added)
      } else if (duplicateNote) {
        setStatus(duplicateNote)
      }
    } catch (e) {
      setStatus(String(e))
    } finally {
      setBusy(false)
    }
  }, [config, registries.cameras])

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
      await loadGalleryTags()
      await refreshSiteCopyrightDefault()
      setRepoSyncKey((k) => k + 1)
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
  }, [refreshRegistries, loadGalleryTags, refreshSiteCopyrightDefault])

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

  const addFolder = async () => {
    const dir = await appOpenFolder()
    if (!dir) return
    setBusy(true)
    try {
      const paths = await appInvoke<string[]>("list_images_in_directory", { dir })
      if (paths.length === 0) {
        setStatus("No supported images in that folder.")
        return
      }
      await ingestPaths(paths)
    } catch (e) {
      setStatus(String(e))
    } finally {
      setBusy(false)
    }
  }

  const applyBatchEdit = (patch: {
    mergeTags?: string
    collectionSelect?: string
    hidden?: boolean
  }) => {
    const extraTags = patch.mergeTags ? parseTagList(patch.mergeTags) : []
    setRows((list) =>
      list.map((r) => {
        const inScope =
          selectedRowIds.size === 0 || selectedRowIds.has(r.id)
        if (!inScope) return r
        const next: UploadRow = { ...r }
        if (extraTags.length > 0) {
          next.tags = normalizeKnownTags([...parseTagList(r.tags), ...extraTags]).join(
            ", ",
          )
        }
        if (patch.collectionSelect !== undefined) {
          next.collectionSelect = patch.collectionSelect
          if (patch.collectionSelect === SELECT_NONE) {
            next.collectionSetCover = false
          }
        }
        if (patch.hidden !== undefined) {
          next.hidden = patch.hidden
        }
        return next
      }),
    )
    setStatus(
      selectedRowIds.size > 0
        ? `Batch edits applied to ${selectedRowIds.size} photo(s).`
        : `Batch edits applied to all ${rows.length} photo(s).`,
    )
  }

  /** Recompute gallery ids only when title is added/cleared, extension changes, or rows change — not on every title keystroke. */
  const destKey = useMemo(
    () =>
      rows
        .map((r) =>
          [
            r.id,
            r.destId,
            r.extension,
            r.editExistingId ?? "",
            r.title.trim() ? "titled" : "",
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
    setSelectedRowIds(new Set())
    setStatus(null)
    setErrorDetail(null)
    void clearPersistedDraft()
  }

  const resetSavedDraft = () => {
    if (
      !window.confirm(
        "Discard autosaved upload work? The photo list and commit note on this screen will be cleared. This cannot be undone.",
      )
    ) {
      return
    }
    clearRows()
    setStatus("Autosaved draft discarded.")
  }

  const addEditPhoto = async () => {
    if (galleryImages.length === 0) {
      await loadGalleryImages()
    }
    const list =
      galleryImages.length > 0 ? galleryImages : await fetchGalleryImages()
    if (list.length === 0) {
      setStatus("No photos in the gallery project to edit.")
      return
    }
    const pick = window.prompt(
      `Edit which photo? Enter id or title substring:\n\n${list
        .slice(0, 12)
        .map((img) => `${img.id.slice(0, 8)}…  ${img.title}`)
        .join("\n")}${list.length > 12 ? `\n… and ${list.length - 12} more` : ""}`,
      list[0]?.id ?? "",
    )
    if (!pick?.trim()) return
    const needle = pick.trim().toLowerCase()
    const match =
      list.find((img) => img.id === needle) ??
      list.find((img) => img.title.toLowerCase().includes(needle))
    if (!match) {
      setStatus("No matching gallery photo.")
      return
    }
    setBusy(true)
    try {
      const photo = await appInvoke<GalleryPhotoEdit>("get_gallery_photo_for_edit", {
        id: match.id,
      })
      const row = uploadRowFromGalleryEdit(photo, registries)
      if (!row.copyright.trim()) {
        row.copyright = defaultCopyrightRef.current
      }
      if (rowsRef.current.some((r) => r.editExistingId === row.editExistingId)) {
        setStatus("That photo is already in the list.")
        return
      }
      setRows((r) => [...r, row])
      setStatus(`Loaded “${row.title}” for editing.`)
    } catch (e) {
      setStatus(String(e))
    } finally {
      setBusy(false)
    }
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
    allTitlesOk &&
    rows.length > 0 &&
    !busy &&
    !repoPreparing &&
    !rows.some((r) => r.destExists && !r.editExistingId)

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
    let unlistenProgress: (() => void) | undefined
    if (isTauri()) {
      const { listen } = await import("@tauri-apps/api/event")
      unlistenProgress = await listen<{ message: string }>("upload-progress", (event) => {
        setStatus(event.payload.message)
      })
    }
    try {
      trace(`Filenames: ${rows.length} photo(s) queued.`)
      const ready = await enrichRowsWithDest(rows)
      if (ready.some((r) => r.destExists && !r.editExistingId)) {
        const clash = ready
          .filter((r) => r.destExists && !r.editExistingId)
          .map((r) => r.destFilename)
        trace(`Conflict check: these names already exist in the repo: ${clash.join(", ")}`)
        setRows(ready)
        setStatus(
          "A planned gallery file id already exists in the repo. Remove that photo from the list or use Edit existing… to update it.",
        )
        setErrorDetail(lines.join("\n"))
        return
      }
      setRows(ready)
      trace(`Planned files:\n${ready.map((r) => `${r.destFilename}  <=  ${r.sourcePath}`).join("\n")}`)

      const coverMissingId = ready.find(
        (r) => r.collectionSetCover && r.collectionSelect !== SELECT_NONE && !r.destId,
      )
      if (coverMissingId) {
        throw new Error(
          "“Make cover photo” needs a title on that photo so it has a gallery id.",
        )
      }

      setStatus("Copying photos into the gallery…")
      await appInvoke("stage_gallery_files", {
        items: ready.map((r) => ({
          sourcePath: r.sourcePath,
          destFilename: r.destFilename,
          skipImageCopy: Boolean(r.editExistingId),
          metaJson: serializeGalleryMeta(
            galleryMetaFromUploadFields(
              rowFieldsFromRow(r),
              r.destId,
              r.editExistingId ? r.preserveUploadedAt ?? undefined : undefined,
            ),
          ),
        })),
      })
      trace("Copy into public/gallery completed (stage_gallery_files OK).")

      const coverBySlug = new Map<string, string>()
      for (const r of ready) {
        if (
          r.collectionSetCover &&
          r.collectionSelect !== SELECT_NONE &&
          r.destId
        ) {
          coverBySlug.set(r.collectionSelect, r.destId)
        }
      }
      if (coverBySlug.size > 0) {
        setStatus("Updating collection cover photos…")
        for (const [slug, coverId] of coverBySlug) {
          await setCollectionCoverPhoto(slug, coverId, registries)
          trace(`Collection cover: ${slug} → ${coverId}`)
        }
      }

      setStatus("Publishing…")
      const msg = await appInvoke<string>("git_commit_and_push", {
        message: commitMessage.trim() || "Add photos",
      })
      trace(`git_commit_and_push returned: ${msg}`)
      if (/nothing to commit/i.test(msg)) {
        trace(
          "Hint: files on disk may already match the last commit, or the repo workdir path is wrong. Check technical details and public/gallery/ on disk.",
        )
        setStatus("Upload copied files, but Git reported nothing new to publish. See technical details below.")
        setErrorDetail(lines.join("\n"))
        return
      }
      setRows([])
      setSelectedRowIds(new Set())
      void clearPersistedDraft()
      setErrorDetail(null)
      setStatus(msg || "Upload finished. Your photos should appear on the site after the next deploy.")
    } catch (e) {
      const err = String(e)
      trace(`Error: ${err}`)
      setStatus("Upload failed. See technical details below.")
      setErrorDetail(lines.join("\n"))
    } finally {
      unlistenProgress?.()
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
            <details
              className="site-config-details"
              onToggle={(e) => {
                if ((e.currentTarget as HTMLDetailsElement).open) {
                  setRepoSyncKey((k) => k + 1)
                }
              }}
            >
              <summary>Site settings (site.json)</summary>
              <SiteConfigPanel
                reloadKey={repoSyncKey}
                disabled={busy || repoPreparing}
                onSaved={() => void refreshSiteCopyrightDefault()}
              />
            </details>
            <p className="muted registry-project-hint">
              Manage collections, cameras, and lenses below, then assign them when uploading.
              Equipment can include a product image; collections can pick a cover photo.
            </p>
            <RegistryListsPanel
              registries={registries}
              disabled={busy || repoPreparing}
              onEdit={(kind, slug) => setRegistryModal({ kind, editSlug: slug })}
              onNew={(kind) => setRegistryModal({ kind })}
            />
          </section>

          <section className="card">
            <h2>Photos</h2>
            <p className="muted photos-autosave-hint">
              Your photo list and commit note are autosaved on this PC until you upload or reset.
            </p>
            {updateNotice ? (
              <p className="update-notice muted" role="status">
                {updateNotice}
              </p>
            ) : null}
            <div className="actions">
              <button type="button" onClick={() => void addFiles()} disabled={busy}>
                Add files…
              </button>
              <button type="button" className="ghost" onClick={() => void addFolder()} disabled={busy}>
                Add folder…
              </button>
              <button
                type="button"
                className="ghost"
                onClick={() => void addEditPhoto()}
                disabled={busy || repoPreparing}
              >
                Edit existing…
              </button>
              <button type="button" className="ghost" onClick={clearRows} disabled={busy || rows.length === 0}>
                Clear list
              </button>
              <button
                type="button"
                className="ghost"
                onClick={resetSavedDraft}
                disabled={busy || (rows.length === 0 && !commitMessage.trim())}
              >
                Reset autosave…
              </button>
            </div>

            {rows.length > 0 ? (
              <>
                <BatchEditBar
                  rowCount={rows.length}
                  selectedCount={selectedRowIds.size}
                  registries={registries}
                  knownTags={knownTags}
                  disabled={busy}
                  onApply={applyBatchEdit}
                  onSelectAll={() => setSelectedRowIds(new Set(rows.map((r) => r.id)))}
                  onClearSelection={() => setSelectedRowIds(new Set())}
                />
                <PhotoPanels
                  rows={rows}
                  registries={registries}
                  knownTags={knownTags}
                  copyrightPlaceholder={copyrightPlaceholder}
                  selectedIds={selectedRowIds}
                  onToggleSelect={(id, selected) => {
                    setSelectedRowIds((prev) => {
                      const next = new Set(prev)
                      if (selected) next.add(id)
                      else next.delete(id)
                      return next
                    })
                  }}
                  updateRow={updateRow}
                  getDestPreview={getDestPreview}
                  onOpenRegistryCreate={setRegistryModal}
                />
              </>
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
          editSlug={registryModal.editSlug}
          registries={registries}
          coverCandidates={coverCandidates}
          onCreated={handleRegistryCreated}
          onClose={() => setRegistryModal(null)}
        />
      ) : null}
    </div>
  )
}
