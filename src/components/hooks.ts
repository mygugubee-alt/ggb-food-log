import { useLiveQuery } from 'dexie-react-hooks'
import { getSettings, hasAnyData } from '../db/repo'
import { DEFAULT_SETTINGS, type Settings } from '../models/types'

export const useSettings = (): Settings => useLiveQuery(getSettings) ?? DEFAULT_SETTINGS

export const EXPORT_PROMPT_DAYS = 14
const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Whether the export prompt is due: there is data, and 14 days have passed since
 * the last export (or since first use, if there has never been one).
 * `days` is whole days since the last export, or null if never exported.
 */
export function useExportDue(): { due: boolean; days: number | null } {
  const settings = useSettings()
  const hasData = useLiveQuery(hasAnyData) ?? false
  const since = settings.last_export_at ?? settings.first_use_at
  const elapsed = since ? Math.floor((Date.now() - Date.parse(since)) / DAY_MS) : 0
  return {
    due: hasData && elapsed >= EXPORT_PROMPT_DAYS,
    days: settings.last_export_at ? elapsed : null,
  }
}
