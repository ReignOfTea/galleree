import { useCallback, useEffect, useState } from 'react'
import {
  applyTheme,
  getStoredTheme,
  resolveTheme,
  setStoredTheme,
  type ThemeMode,
} from '../lib/theme'

export function ThemeToggle() {
  const [mode, setMode] = useState<ThemeMode>(() =>
    typeof window !== 'undefined' ? resolveTheme() : 'light',
  )

  useEffect(() => {
    const sync = () => setMode(resolveTheme())
    window.addEventListener('storage', sync)
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onMq = () => {
      if (!getStoredTheme()) sync()
    }
    mq.addEventListener('change', onMq)
    return () => {
      window.removeEventListener('storage', sync)
      mq.removeEventListener('change', onMq)
    }
  }, [])

  const pick = useCallback((t: ThemeMode) => {
    setStoredTheme(t)
    applyTheme(t)
    setMode(t)
  }, [])

  return (
    <div className="theme-toggle" role="group" aria-label="Color theme">
      <button
        type="button"
        className={
          mode === 'light'
            ? 'theme-toggle-option theme-toggle-option-active'
            : 'theme-toggle-option'
        }
        onClick={() => pick('light')}
        aria-pressed={mode === 'light'}
        aria-label="Light theme"
        title="Light theme"
      >
        <span className="theme-toggle-icon" aria-hidden="true">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
          >
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
          </svg>
        </span>
        <span className="theme-toggle-label">Light</span>
      </button>
      <button
        type="button"
        className={
          mode === 'dark'
            ? 'theme-toggle-option theme-toggle-option-active'
            : 'theme-toggle-option'
        }
        onClick={() => pick('dark')}
        aria-pressed={mode === 'dark'}
        aria-label="Dark theme"
        title="Dark theme"
      >
        <span className="theme-toggle-icon" aria-hidden="true">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
          >
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
          </svg>
        </span>
        <span className="theme-toggle-label">Dark</span>
      </button>
    </div>
  )
}
