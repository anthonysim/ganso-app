import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'
import type { ReactNode } from 'react'
import { THEME_STORAGE_KEY, isDark, parseTheme } from '#/lib/theme'
import type { Theme } from '#/lib/theme'

interface ThemeContextValue {
  theme: Theme
  setTheme: (theme: Theme) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

function applyTheme(theme: Theme) {
  const dark = isDark(theme, matchMedia('(prefers-color-scheme: dark)').matches)
  const root = document.documentElement
  // Per-element color transitions would trail behind the page cross-fade, so switch
  // them off while the colors change.
  root.classList.add('theme-switching')
  root.classList.toggle('dark', dark)
  void root.offsetHeight // apply the new colors before transitions come back
  root.classList.remove('theme-switching')
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Server and first client render both use 'system'; real value is read after mount
  // (the inline head script already set the correct class, so there is no flash).
  const [theme, setThemeState] = useState<Theme>('system')

  useEffect(() => {
    try {
      setThemeState(parseTheme(localStorage.getItem(THEME_STORAGE_KEY)))
    } catch {
      // storage unavailable: stay on system
    }
  }, [])

  useEffect(() => {
    if (theme !== 'system') return
    const mq = matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => applyTheme('system')
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [theme])

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next)
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next)
    } catch {
      // ignore
    }
    // Cross-fade the whole page via the View Transitions API; fall back to an instant swap.
    const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduceMotion || !('startViewTransition' in document)) {
      applyTheme(next)
      return
    }
    document.startViewTransition(() => applyTheme(next))
  }, [])

  const value = useMemo(() => ({ theme, setTheme }), [theme, setTheme])
  return <ThemeContext value={value}>{children}</ThemeContext>
}

export function useTheme() {
  const ctx = use(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider')
  return ctx
}
