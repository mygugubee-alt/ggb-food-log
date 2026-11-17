// The six colour themes. The CSS for each lives in app.css under :root[data-theme="..."].
export const THEMES = [
  { id: 'pink', label: 'Strawberry pink', swatch: '#e8799a' },
  { id: 'peach', label: 'Peach', swatch: '#f08a5d' },
  { id: 'lavender', label: 'Lavender', swatch: '#8f7ee0' },
  { id: 'mint', label: 'Mint', swatch: '#3fae8c' },
  { id: 'sky', label: 'Sky blue', swatch: '#4d9be6' },
  { id: 'butter', label: 'Butter yellow', swatch: '#e0a81f' },
] as const

export type ThemeName = (typeof THEMES)[number]['id']
export const DEFAULT_THEME: ThemeName = 'pink'
export const isThemeName = (x: unknown): x is ThemeName => THEMES.some((t) => t.id === x)

const CACHE_KEY = 'theme'

/** Applies a theme to the page, and remembers it so the next launch starts in the right colour. */
export function applyTheme(theme: ThemeName): void {
  document.documentElement.dataset.theme = theme
  try { localStorage.setItem(CACHE_KEY, theme) } catch { /* private mode: the setting still applies */ }
}
/** Called before the first paint, so the app does not flash the default colour. */
export function applyCachedTheme(): void {
  let cached: string | null = null
  try { cached = localStorage.getItem(CACHE_KEY) } catch { /* ignore */ }
  document.documentElement.dataset.theme = isThemeName(cached) ? cached : DEFAULT_THEME
}
