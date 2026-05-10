export const THEME_STORAGE_KEY = 'galleree-theme'

export type ThemeMode = 'light' | 'dark'

export function getStoredTheme(): ThemeMode | null {
  try {
    const v = localStorage.getItem(THEME_STORAGE_KEY)
    if (v === 'light' || v === 'dark') return v
  } catch {
    /* private mode */
  }
  return null
}

/** Prefer saved choice; otherwise OS preference. */
export function resolveTheme(): ThemeMode {
  const s = getStoredTheme()
  if (s) return s
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light'
}

const META_THEME_ID = 'meta-theme-color'
const META_COLOR_SCHEME_ID = 'meta-color-scheme'

/** Hint scrollbars / form controls; helps some extensions respect “light only”. */
function syncColorSchemeMeta(theme: ThemeMode): void {
  const meta = document.getElementById(META_COLOR_SCHEME_ID) as HTMLMetaElement | null
  if (meta) {
    meta.content = theme === 'dark' ? 'only dark' : 'only light'
  }
}

export function applyTheme(theme: ThemeMode): void {
  document.documentElement.setAttribute('data-theme', theme)
  const meta = document.getElementById(META_THEME_ID) as HTMLMetaElement | null
  if (meta) meta.content = theme === 'dark' ? '#141413' : '#ffffff'
  syncColorSchemeMeta(theme)
}

export function setStoredTheme(theme: ThemeMode): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme)
  } catch {
    /* ignore */
  }
}
