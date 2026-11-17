import { Unzip, UnzipInflate, Zip, ZipDeflate, ZipPassThrough, strFromU8, strToU8 } from 'fflate'
import { db } from '../db/db'
import { getProfilePhoto, getSettings, hardDeleteDay, hasAnyData, listA1c, loadAll, setProfilePhoto, setSetting, uuid } from '../db/repo'
import {
  MEAL_TYPES, SUGAR_CONTEXTS, type A1cResult, type Activity, type DayEntry, type GoalChange, type Meal, type Photo, type Reading, type Settings,
} from '../models/types'
import { isValidDate, todayKL } from '../utils/dates'
import { isThemeName } from '../theme/themes'

export const SCHEMA_VERSION = 1
/** The user's own photo, if set. Optional in an export. */
export const PROFILE_FILE = 'profile.jpg'

// The export format. Field names match section 4 of the spec. Soft-deleted rows are never exported.
export type ExportDay = Omit<DayEntry, 'deleted_at'>
export type ExportMeal = Omit<Meal, 'deleted_at'>
export type ExportReading = Omit<Reading, 'deleted_at'>
export type ExportPhoto = Omit<Photo, 'deleted_at'> & { file: string } // photos/<photo id>.jpg
export type ExportA1c = Omit<A1cResult, 'deleted_at'>
export type ExportActivity = Omit<Activity, 'deleted_at'>
export interface ExportFile {
  schema_version: number
  app: 'food-log'
  exported_at: string
  settings: Pick<Settings, 'sugar_unit' | 'week_start' | 'hide_sugar'> & Partial<Pick<Settings, 'theme' | 'range_mode' | 'custom_before_max' | 'custom_after_max'>>
  days: ExportDay[]
  meals: ExportMeal[]
  readings: ExportReading[]
  goal_changes: GoalChange[]
  photos: ExportPhoto[]
  /** HbA1c results. Optional: exports made before this was added do not have it. */
  a1c_results?: ExportA1c[]
  /** Activities. Optional for the same reason. */
  activities?: ExportActivity[]
}

export const exportFileName = (): string => `foodlog-export-${todayKL()}.zip`

const strip = <T extends { deleted_at: string | null }>(row: T): Omit<T, 'deleted_at'> => {
  const { deleted_at: _unused, ...rest } = row
  return rest
}

export async function collectExportData(): Promise<ExportFile> {
  const [all, settings, goal_changes, imageKeys] = await Promise.all([
    loadAll(), getSettings(), db.goalChanges.orderBy('changed_at').toArray(), db.images.toCollection().primaryKeys(),
  ])
  const hasImage = new Set(imageKeys)
  return {
    schema_version: SCHEMA_VERSION,
    app: 'food-log',
    exported_at: new Date().toISOString(),
    settings: { sugar_unit: settings.sugar_unit, week_start: settings.week_start, hide_sugar: settings.hide_sugar, theme: settings.theme,
      range_mode: settings.range_mode, custom_before_max: settings.custom_before_max, custom_after_max: settings.custom_after_max,
    },
    days: all.days.map(strip),
    meals: all.meals.map(strip),
    readings: all.readings.map(strip),
    goal_changes,
    photos: all.photos.filter((p) => hasImage.has(p.id)).map((p) => ({ ...strip(p), file: `photos/${p.id}.jpg` })),
    a1c_results: (await listA1c()).map(strip),
    activities: all.activities.map(strip),
  }
}

/** Builds the export ZIP one photo at a time, so the whole archive is never held as one buffer. */
export async function buildExportZip(): Promise<Blob> {
  const data = await collectExportData()
  let blob = new Blob([], { type: 'application/zip' })
  let parts: Uint8Array[] = []
  let pending = 0
  const flush = () => {
    blob = new Blob([blob, ...(parts as BlobPart[])], { type: 'application/zip' })
    parts = []
    pending = 0
  }
  let failed: unknown = null
  const zip = new Zip((err, chunk) => {
    if (err) { failed = err; return }
    parts.push(chunk)
    pending += chunk.length
  })
  const json = new ZipDeflate('data.json', { level: 6 })
  zip.add(json)
  json.push(strToU8(JSON.stringify(data)), true)
  const profile = await getProfilePhoto()
  if (profile) {
    const entry = new ZipPassThrough(PROFILE_FILE)
    zip.add(entry)
    entry.push(new Uint8Array(profile), true)
  }
  for (const p of data.photos) {
    const row = await db.images.get(p.id)
    if (!row) continue
    const entry = new ZipPassThrough(p.file) // JPEG is already compressed
    zip.add(entry)
    entry.push(new Uint8Array(row.image), true)
    if (pending > 8 * 1024 * 1024) flush()
    if (failed) throw failed
  }
  zip.end()
  if (failed) throw failed
  flush()
  return blob
}

// ---------- Reading an export ----------

async function streamZip(
  file: Blob, want: (name: string) => boolean, onFile: (name: string, bytes: Uint8Array) => Promise<void>,
): Promise<void> {
  const queue: { name: string; bytes: Uint8Array }[] = []
  let failed: unknown = null
  const unzip = new Unzip()
  unzip.register(UnzipInflate)
  unzip.onfile = (entry) => {
    if (!want(entry.name)) return
    const chunks: Uint8Array[] = []
    entry.ondata = (err, chunk, final) => {
      if (err) { failed = err; return }
      chunks.push(chunk)
      if (!final) return
      const bytes = new Uint8Array(chunks.reduce((s, c) => s + c.length, 0))
      let offset = 0
      for (const c of chunks) { bytes.set(c, offset); offset += c.length }
      queue.push({ name: entry.name, bytes })
    }
    entry.start()
  }
  const reader = (file.stream() as ReadableStream<Uint8Array>).getReader()
  for (;;) {
    const { value, done } = await reader.read()
    unzip.push(value ?? new Uint8Array(0), done)
    if (failed) throw failed
    while (queue.length) {
      const next = queue.shift()!
      await onFile(next.name, next.bytes)
    }
    if (done) break
  }
}

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x)
const isStr = (x: unknown): x is string => typeof x === 'string'
const isNum = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x)
const numOrNull = (x: unknown): boolean => x === null || isNum(x)
const strOrNull = (x: unknown): boolean => x === null || isStr(x)

/** Checks the whole file before anything is written. Throws an Error with a plain message. */
export function validateExport(raw: unknown): ExportFile {
  const bad = (why: string): never => { throw new Error(`This file is not a valid GGB Food Log export (${why}).`) }
  if (!isObj(raw)) return bad('data.json is not an object')
  if (!isNum(raw.schema_version)) return bad('no schema_version')
  if (raw.schema_version > SCHEMA_VERSION) {
    throw new Error('This export was made by a newer version of the app. Update the app, then import again.')
  }
  const list = (key: string): Record<string, unknown>[] => {
    const v = raw[key]
    if (!Array.isArray(v) || !v.every(isObj)) return bad(`${key} is missing`)
    return v as Record<string, unknown>[]
  }
  const days = list('days'), meals = list('meals'), readings = list('readings'), goals = list('goal_changes'), photos = list('photos')
  const dayIds = new Set<string>(), dates = new Set<string>(), mealIds = new Set<string>()
  for (const d of days) {
    if (!isStr(d.id) || !isStr(d.date) || !isValidDate(d.date)) return bad('a day has no valid date')
    if (dates.has(d.date) || dayIds.has(d.id)) return bad('a day appears twice')
    if (!numOrNull(d.weight_kg) || !numOrNull(d.calories_kcal) || !isStr(d.activity_note) || !isStr(d.day_note)) return bad('a day has a wrong field')
    dayIds.add(d.id); dates.add(d.date)
  }
  for (const m of meals) {
    if (!isStr(m.id) || !isStr(m.day_id) || !dayIds.has(m.day_id)) return bad('a meal has no day')
    if (!MEAL_TYPES.includes(m.meal_type as never) || !strOrNull(m.time) || !isStr(m.description) || !numOrNull(m.calories_kcal) || !isNum(m.sort_order)) return bad('a meal has a wrong field')
    mealIds.add(m.id)
  }
  for (const r of readings) {
    if (!isStr(r.id) || !isStr(r.day_id) || !dayIds.has(r.day_id)) return bad('a reading has no day')
    if (!isStr(r.measured_at) || Number.isNaN(Date.parse(r.measured_at)) || !isNum(r.value_mmol) || !isNum(r.entered_value)) return bad('a reading has a wrong field')
    if (r.entered_unit !== 'mmol_l' && r.entered_unit !== 'mg_dl') return bad('a reading has a wrong unit')
    if (r.context !== null && !SUGAR_CONTEXTS.includes(r.context as never)) return bad('a reading has a wrong context')
    if (!isStr(r.note)) return bad('a reading has a wrong field')
  }
  for (const g of goals) {
    if (!isStr(g.id) || !numOrNull(g.dream_weight_kg) || !isStr(g.changed_at)) return bad('a goal change has a wrong field')
  }
  for (const p of photos) {
    if (!isStr(p.id) || !isStr(p.day_id) || !dayIds.has(p.day_id) || !isStr(p.file)) return bad('a photo has no day')
    if (p.meal_id !== null && (!isStr(p.meal_id) || !mealIds.has(p.meal_id))) return bad('a photo has no meal')
    if (!isNum(p.width) || !isNum(p.height) || !isNum(p.sort_order)) return bad('a photo has a wrong field')
  }
  if (raw.activities !== undefined) {
    for (const a of list('activities')) {
      if (!isStr(a.day_id) || !dayIds.has(a.day_id)) return bad('an activity has no day')
      if (!isStr(a.activity_type) || !isStr(a.name) || !isNum(a.minutes) || !numOrNull(a.kcal)) return bad('an activity has a wrong field')
    }
  }
  if (raw.a1c_results !== undefined) {
    for (const a of list('a1c_results')) {
      if (!isStr(a.test_date) || !isValidDate(a.test_date) || !isNum(a.value_percent) || !isStr(a.note)) return bad('an HbA1c result has a wrong field')
    }
  }
  return raw as unknown as ExportFile
}

export interface ImportPlan { data: ExportFile; conflicts: string[]; newDays: number }

/** Step 1: read and validate data.json, and find the dates that already exist on this device. */
export async function prepareImport(file: Blob): Promise<ImportPlan> {
  let json: string | null = null
  try {
    await streamZip(file, (name) => name === 'data.json', async (_name, bytes) => { json = strFromU8(bytes) })
  } catch {
    throw new Error('This file could not be read as a ZIP export.')
  }
  if (json == null) throw new Error('This file is not a GGB Food Log export (data.json is missing).')
  let parsed: unknown
  try { parsed = JSON.parse(json) } catch { throw new Error('This file is not a valid GGB Food Log export (data.json is damaged).') }
  const data = validateExport(parsed)
  const existing = new Set((await loadAll()).days.map((d) => d.date))
  const conflicts = data.days.map((d) => d.date).filter((d) => existing.has(d)).sort()
  return { data, conflicts, newDays: data.days.length - conflicts.length }
}

export interface ImportResult { daysAdded: number; daysReplaced: number; daysSkipped: number; photos: number }
export type MakeThumb = (image: ArrayBuffer) => Promise<ArrayBuffer>

/**
 * Step 2: import. Photos are stored first under fresh ids (invisible until their rows
 * exist), then all rows are written in one transaction. If anything fails, the stored
 * photos are removed again and nothing else has changed.
 */
export async function runImport(file: Blob, plan: ImportPlan, mode: 'skip' | 'replace', makeThumb: MakeThumb): Promise<ImportResult> {
  const { data } = plan
  const conflicts = new Set(plan.conflicts)
  const wasEmpty = !(await hasAnyData())
  const days = data.days.filter((d) => mode === 'replace' || !conflicts.has(d.date))
  // Fresh ids for everything except goal changes (which merge by id), so nothing can collide.
  const dayId = new Map(days.map((d) => [d.id, uuid()]))
  const meals = data.meals.filter((m) => dayId.has(m.day_id))
  const mealId = new Map(meals.map((m) => [m.id, uuid()]))
  const readings = data.readings.filter((r) => dayId.has(r.day_id))
  const photos = data.photos.filter((p) => dayId.has(p.day_id) && (p.meal_id == null || mealId.has(p.meal_id)))
  const photoIdByFile = new Map(photos.map((p) => [p.file, uuid()]))

  const staged: string[] = []
  let profile: ArrayBuffer | null = null
  try {
    await streamZip(file, (name) => photoIdByFile.has(name) || (wasEmpty && name === PROFILE_FILE), async (name, bytes) => {
      const image = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
      if (name === PROFILE_FILE) { profile = image; return }
      const id = photoIdByFile.get(name)!
      const thumb = await makeThumb(image)
      staged.push(id)
      await db.images.put({ photo_id: id, image })
      await db.thumbs.put({ photo_id: id, thumb })
    })
    const stagedSet = new Set(staged)
    await db.transaction('rw', db.tables, async () => {
      const importDates = new Set(days.map((d) => d.date))
      // Anything already on those dates goes: replaced days, or deleted days still waiting for Undo.
      for (const old of await db.days.filter((d) => importDates.has(d.date)).toArray()) await hardDeleteDay(old.id)
      await db.days.bulkAdd(days.map((d) => ({ ...d, id: dayId.get(d.id)!, deleted_at: null })))
      await db.meals.bulkAdd(meals.map((m) => ({ ...m, id: mealId.get(m.id)!, day_id: dayId.get(m.day_id)!, deleted_at: null })))
      await db.readings.bulkAdd(readings.map((r) => ({ ...r, id: uuid(), day_id: dayId.get(r.day_id)!, deleted_at: null })))
      await db.activities.bulkAdd((data.activities ?? []).filter((a) => dayId.has(a.day_id)).map((a) => ({ ...a, kcal_auto: a.kcal_auto === true, id: uuid(), day_id: dayId.get(a.day_id)!, deleted_at: null })))
      await db.photos.bulkAdd(
        photos.filter((p) => stagedSet.has(photoIdByFile.get(p.file)!)).map(({ file: f, ...p }) => ({
          ...p, id: photoIdByFile.get(f)!, day_id: dayId.get(p.day_id)!,
          meal_id: p.meal_id == null ? null : mealId.get(p.meal_id)!, deleted_at: null,
        })),
      )
      const knownGoals = new Set(await db.goalChanges.toCollection().primaryKeys())
      await db.goalChanges.bulkAdd(data.goal_changes.filter((g) => !knownGoals.has(g.id)))
      // HbA1c results: add the ones not already here (same test date and value).
      const haveA1c = new Set((await db.a1c.toArray()).filter((a) => !a.deleted_at).map((a) => `${a.test_date}|${a.value_percent}`))
      await db.a1c.bulkAdd((data.a1c_results ?? []).filter((a) => !haveA1c.has(`${a.test_date}|${a.value_percent}`)).map((a) => ({ ...a, id: uuid(), deleted_at: null })))
      if (wasEmpty && data.settings) {
        await setSetting('sugar_unit', data.settings.sugar_unit === 'mg_dl' ? 'mg_dl' : 'mmol_l')
        await setSetting('week_start', data.settings.week_start === 0 ? 0 : 1)
        await setSetting('hide_sugar', data.settings.hide_sugar === true)
        if (isThemeName(data.settings.theme)) await setSetting('theme', data.settings.theme)
        const rm = data.settings.range_mode
        if (rm === 'off' || rm === 'general' || rm === 'diabetes' || rm === 'custom') await setSetting('range_mode', rm)
        if (isNum(data.settings.custom_before_max)) await setSetting('custom_before_max', data.settings.custom_before_max)
        if (isNum(data.settings.custom_after_max)) await setSetting('custom_after_max', data.settings.custom_after_max)
      }
      // Like settings, the profile photo only comes along into an empty install.
      if (wasEmpty && profile) {
        await setProfilePhoto(profile)
      }
    })
  } catch (e) {
    await db.images.bulkDelete(staged)
    await db.thumbs.bulkDelete(staged)
    throw e
  }
  const replaced = mode === 'replace' ? plan.conflicts.length : 0
  return {
    daysAdded: days.length - replaced,
    daysReplaced: replaced,
    daysSkipped: mode === 'skip' ? plan.conflicts.length : 0,
    photos: staged.length,
  }
}
