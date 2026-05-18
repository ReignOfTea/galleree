import { convertFileSrc } from "@tauri-apps/api/core"

/** True when running inside the Tauri webview (not a plain browser tab). */
export function isTauri(): boolean {
  return (
    typeof window !== "undefined" &&
    Object.prototype.hasOwnProperty.call(window, "__TAURI_INTERNALS__")
  )
}

export const TAURI_REQUIRED_MESSAGE =
  "This app must run in the desktop window. From tools/gallery-uploader, run: npm run tauri dev"

export async function appInvoke<T>(
  cmd: string,
  args?: Record<string, unknown>,
): Promise<T> {
  if (!isTauri()) {
    throw new Error(TAURI_REQUIRED_MESSAGE)
  }
  const { invoke } = await import("@tauri-apps/api/core")
  return invoke<T>(cmd, args)
}

export function appConvertFileSrc(path: string): string {
  if (!isTauri()) return ""
  return convertFileSrc(path)
}

export async function appPickImageFile(): Promise<string | null> {
  if (!isTauri()) {
    throw new Error(TAURI_REQUIRED_MESSAGE)
  }
  const { open } = await import("@tauri-apps/plugin-dialog")
  const picked = await open({
    multiple: false,
    filters: [
      {
        name: "Images",
        extensions: ["jpg", "jpeg", "png", "webp", "avif", "gif"],
      },
    ],
  })
  if (picked === null) return null
  return typeof picked === "string" ? picked : null
}

export async function appOpenFiles(): Promise<string[]> {
  if (!isTauri()) {
    throw new Error(TAURI_REQUIRED_MESSAGE)
  }
  const { open } = await import("@tauri-apps/plugin-dialog")
  const picked = await open({
    multiple: true,
    filters: [
      {
        name: "Images",
        extensions: ["jpg", "jpeg", "png", "webp", "avif", "gif"],
      },
    ],
  })
  if (picked === null) return []
  return Array.isArray(picked) ? picked : [picked]
}

export async function listenDragDropEvents(handlers: {
  onEnterOrOver?: () => void
  onLeaveOrDrop?: () => void
  onDrop?: (paths: string[]) => void
}): Promise<() => void> {
  if (!isTauri()) return () => undefined
  const { getCurrentWebview } = await import("@tauri-apps/api/webview")
  return getCurrentWebview().onDragDropEvent((e) => {
    const t = e.payload.type
    if (t === "enter" || t === "over") handlers.onEnterOrOver?.()
    if (t === "leave" || t === "drop") handlers.onLeaveOrDrop?.()
    if (t === "drop" && e.payload.paths.length > 0) {
      handlers.onDrop?.(e.payload.paths)
    }
  })
}
