import { appConvertFileSrc, appInvoke } from "../tauriBridge"
import type { SessionDefaults } from "./sessionDefaults"
import { EMPTY_SESSION_DEFAULTS } from "./sessionDefaults"

export const DRAFT_SESSION_VERSION = 2

export type DraftUploadRow = Omit<UploadRow, "previewSrc" | "destId" | "destExists">

import type { UploadRow } from "../types"

export type DraftSession = {
  version: number
  repoUrl: string
  branch: string
  commitMessage: string
  selectedRowIds: string[]
  rows: DraftUploadRow[]
  sessionDefaults?: SessionDefaults
  compactView?: boolean
}

export type LoadDraftSessionResult = {
  session: DraftSession | null
  skippedPaths: string[]
}

export function uploadRowToDraft(row: UploadRow): DraftUploadRow {
  const { previewSrc: _p, destId: _i, destExists: _e, ...draft } = row
  return draft
}

export function draftRowToUpload(row: DraftUploadRow): UploadRow {
  return {
    ...row,
    previewSrc: appConvertFileSrc(row.sourcePath),
    destId: "",
    destExists: false,
    preserveExifDisplay: row.preserveExifDisplay ?? null,
    editGalleryImagePath: row.editGalleryImagePath ?? null,
    editOriginalFilename: row.editOriginalFilename ?? null,
    replaceImageFile: row.replaceImageFile ?? false,
  }
}

export function buildDraftSession(
  repoUrl: string,
  branch: string,
  rows: UploadRow[],
  commitMessage: string,
  selectedRowIds: ReadonlySet<string>,
  sessionDefaults: SessionDefaults,
  compactView: boolean,
): DraftSession {
  return {
    version: DRAFT_SESSION_VERSION,
    repoUrl,
    branch,
    commitMessage,
    selectedRowIds: [...selectedRowIds],
    rows: rows.map(uploadRowToDraft),
    sessionDefaults,
    compactView,
  }
}

export async function loadDraftSession(): Promise<LoadDraftSessionResult> {
  return appInvoke<LoadDraftSessionResult>("load_draft_session")
}

export async function saveDraftSession(session: DraftSession): Promise<void> {
  await appInvoke("save_draft_session", { session })
}

export async function clearDraftSession(): Promise<void> {
  await appInvoke("clear_draft_session")
}

export function formatDraftRestoreMessage(
  restoredCount: number,
  skippedPaths: readonly string[],
): string | null {
  if (restoredCount === 0 && skippedPaths.length === 0) return null
  const parts: string[] = []
  if (restoredCount > 0) {
    parts.push(
      `Restored ${restoredCount} photo(s) from your last session (autosaved on this PC).`,
    )
  }
  if (skippedPaths.length > 0) {
    parts.push(
      `${skippedPaths.length} photo(s) were dropped because the source file is missing (moved or deleted).`,
    )
  }
  return parts.join(" ")
}

export async function loadUploadPreferences(): Promise<SessionDefaults | null> {
  try {
    const raw = await appInvoke<SessionDefaults | null>("load_upload_preferences")
    return raw ?? null
  } catch {
    return null
  }
}

export async function saveUploadPreferences(defaults: SessionDefaults): Promise<void> {
  await appInvoke("save_upload_preferences", { defaults })
}

export function normalizeSessionDefaults(
  raw: SessionDefaults | undefined | null,
): SessionDefaults {
  if (!raw) return { ...EMPTY_SESSION_DEFAULTS }
  return {
    tags: raw.tags ?? "",
    collectionSelect: raw.collectionSelect ?? "",
    hidden: raw.hidden ?? null,
    cameraSelect: raw.cameraSelect ?? "",
    lensSelect: raw.lensSelect ?? "",
    copyright: raw.copyright ?? "",
    location: raw.location ?? "",
    captureDate: raw.captureDate ?? "",
  }
}
