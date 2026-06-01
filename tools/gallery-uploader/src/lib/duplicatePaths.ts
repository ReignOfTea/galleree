export type PathDuplicate = {
  path: string
  matchKind: "gallery" | "queue" | "batch"
  existingId: string | null
  existingTitle: string
  existingPath: string
}

export type CheckDuplicatePathsResult = {
  okPaths: string[]
  duplicates: PathDuplicate[]
  galleryImageCount: number
}

function basename(filePath: string): string {
  const s = filePath.replace(/\\/g, "/")
  const i = s.lastIndexOf("/")
  return i >= 0 ? s.slice(i + 1) : s
}

export function formatDuplicateSkipMessage(duplicates: readonly PathDuplicate[]): string {
  if (duplicates.length === 0) return ""
  const lines = duplicates.slice(0, 8).map((d) => {
    const file = basename(d.path)
    if (d.matchKind === "gallery") {
      const id = d.existingId ? `${d.existingId.slice(0, 8)}…` : d.existingPath
      return `${file} — already in gallery as “${d.existingTitle}” (${id})`
    }
    if (d.matchKind === "queue") {
      return `${file} — same image already in the upload list (${d.existingPath})`
    }
    return `${file} — same image as ${d.existingPath} in this selection`
  })
  const more =
    duplicates.length > lines.length
      ? `\n… and ${duplicates.length - lines.length} more duplicate(s).`
      : ""
  return `Skipped ${duplicates.length} duplicate(s) (SHA-256 match):\n${lines.join("\n")}${more}`
}
