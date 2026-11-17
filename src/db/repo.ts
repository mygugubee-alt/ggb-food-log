import { db } from './db'
import {
  DEFAULT_SETTINGS, type A1cResult, type Activity, type DayBundle, type DayEntry, type GoalChange, type Meal, type MealType, type NewPhoto,
  type Photo, type Reading, type Settings, type SugarContext, type SugarUnit,
} from '../models/types'
import { klToUtcIso, todayKL } from '../utils/dates'
import { toMmol } from '../utils/units'
import { DEFAULT_THEME, isThemeName } from '../theme/themes'

const nowIso = (): string => new Date().toISOString()

export function uuid(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  const b = crypto.getRandomValues(new Uint8Array(16))
  b[6] = (b[6] & 0x0f) | 0x40
  b[8] = (b[8] & 0x3f) | 0x80
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}

const DATA_TABLES = () => [db.days, db.meals, db.photos, db.images, db.thumbs, db.readings, db.a1c, db.activities]
/** Every multi-table change runs in one transaction. */
const tx = <R>(fn: () => Promise<R>): Promise<R> => db.transaction('rw', DATA_TABLES(), fn)

const live = <T extends { deleted_at: string | null }>(rows: T[]): T[] => rows.filter((r) => !r.deleted_at)

// ---------- Days ----------

export async function getDay(date: string): Promise<DayEntry | null> {
  const d = await db.days.where('date').equals(date).first()
  return d && !d.deleted_at ? d : null
}

export async function hardDeleteDay(dayId: string): Promise<void> {
  const photoIds = await db.photos.where('day_id').equals(dayId).primaryKeys()
  await db.images.bulkDelete(photoIds)
  await db.thumbs.bulkDelete(photoIds)
  await db.photos.where('day_id').equals(dayId).delete()
  await db.meals.where('day_id').equals(dayId).delete()
  await db.readings.where('day_id').equals(dayId).delete()
  await db.activities.where('day_id').equals(dayId).delete()
  await db.days.delete(dayId)
}

/** Returns the day for a date, creating it the first time anything is logged. */
export function ensureDay(date: string): Promise<DayEntry> {
  if (date > todayKL()) return Promise.reject(new Error('Future dates cannot be logged'))
  return tx(async () => {
    const existing = await db.days.where('date').equals(date).first()
    if (existing && !existing.deleted_at) return existing
    if (existing) await hardDeleteDay(existing.id) // a deleted day still waiting for Undo
    const t = nowIso()
    const day: DayEntry = {
      id: uuid(), date, weight_kg: null, activity_note: '', calories_kcal: null, day_note: '',
      created_at: t, updated_at: t, deleted_at: null,
    }
    await db.days.add(day)
    return day
  })
}

// The activity note and the day calorie total were removed from the app in v1.6.
// Values stored by an older version stay in the database but no longer count as content.
export const dayHasOwnContent = (d: DayEntry): boolean => d.weight_kg != null || d.day_note.trim() !== ''

/** Removes a day row that has no content and nothing under it (not even items waiting for Undo). */
async function cleanupEmptyDay(dayId: string): Promise<void> {
  const day = await db.days.get(dayId)
  if (!day || day.deleted_at || dayHasOwnContent(day)) return
  const children =
    (await db.meals.where('day_id').equals(dayId).count()) +
    (await db.readings.where('day_id').equals(dayId).count()) +
    (await db.photos.where('day_id').equals(dayId).count()) +
    (await db.activities.where('day_id').equals(dayId).count())
  if (children === 0) await db.days.delete(dayId)
}

export type DayPatch = Partial<Pick<DayEntry, 'weight_kg' | 'activity_note' | 'calories_kcal' | 'day_note'>>

export function updateDay(date: string, patch: DayPatch): Promise<void> {
  return tx(async () => {
    const day = await ensureDay(date)
    await db.days.update(day.id, { ...patch, updated_at: nowIso() })
    await cleanupEmptyDay(day.id)
  })
}

const sortMeals = (m: Meal[]): Meal[] => m.sort((a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at))
const sortPhotos = (p: Photo[]): Photo[] => p.sort((a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at))
const sortActivities = (a: Activity[]): Activity[] => a.sort((x, y) => x.created_at.localeCompare(y.created_at))
const sortReadings = (r: Reading[]): Reading[] => r.sort((a, b) => a.measured_at.localeCompare(b.measured_at))

export async function loadDayBundle(date: string): Promise<DayBundle> {
  const day = await getDay(date)
  if (!day) return { day: null, meals: [], readings: [], photos: [], activities: [] }
  const [meals, readings, photos] = await Promise.all([
    db.meals.where('day_id').equals(day.id).toArray(),
    db.readings.where('day_id').equals(day.id).toArray(),
    db.photos.where('day_id').equals(day.id).toArray(),
  ])
  const liveMeals = sortMeals(live(meals))
  const mealIds = new Set(liveMeals.map((m) => m.id))
  const activities = sortActivities(live(await db.activities.where('day_id').equals(day.id).toArray()))
  return {
    day,
    activities,
    meals: liveMeals,
    readings: sortReadings(live(readings)),
    photos: sortPhotos(live(photos).filter((p) => p.meal_id == null || mealIds.has(p.meal_id))),
  }
}

export const isLogged = (b: DayBundle): boolean =>
  !!b.day && (dayHasOwnContent(b.day) || b.meals.length > 0 || b.readings.length > 0 || b.photos.length > 0 || b.activities.length > 0)

export interface RangeData { days: DayEntry[]; meals: Meal[]; readings: Reading[]; photos: Photo[]; activities: Activity[] }

function tidy(days: DayEntry[], meals: Meal[], readings: Reading[], photos: Photo[], activities: Activity[]): RangeData {
  const liveDays = live(days).sort((a, b) => a.date.localeCompare(b.date))
  const dayIds = new Set(liveDays.map((d) => d.id))
  const liveMeals = sortMeals(live(meals).filter((m) => dayIds.has(m.day_id)))
  const mealIds = new Set(liveMeals.map((m) => m.id))
  return {
    days: liveDays,
    meals: liveMeals,
    readings: sortReadings(live(readings).filter((r) => dayIds.has(r.day_id))),
    photos: sortPhotos(live(photos).filter((p) => dayIds.has(p.day_id) && (p.meal_id == null || mealIds.has(p.meal_id)))),
    activities: sortActivities(live(activities).filter((a) => dayIds.has(a.day_id))),
  }
}

/** Live rows for an inclusive date range. No image data. */
export async function loadRange(from: string, to: string): Promise<RangeData> {
  const days = await db.days.where('date').between(from, to, true, true).toArray()
  const ids = days.map((d) => d.id)
  const [meals, readings, photos, activities] = await Promise.all([
    db.meals.where('day_id').anyOf(ids).toArray(),
    db.readings.where('day_id').anyOf(ids).toArray(),
    db.photos.where('day_id').anyOf(ids).toArray(),
    db.activities.where('day_id').anyOf(ids).toArray(),
  ])
  return tidy(days, meals, readings, photos, activities)
}

/** Every live row. No image data. */
export async function loadAll(): Promise<RangeData> {
  const [days, meals, readings, photos, activities] = await Promise.all([
    db.days.toArray(), db.meals.toArray(), db.readings.toArray(), db.photos.toArray(), db.activities.toArray(),
  ])
  return tidy(days, meals, readings, photos, activities)
}

export interface WeightPoint { date: string; weight_kg: number }

/** The most recent logged weight on or before `date` (or strictly before it). */
export async function latestWeight(date: string, inclusive: boolean): Promise<WeightPoint | null> {
  const d = await db.days.orderBy('date').reverse()
    .filter((x) => !x.deleted_at && x.weight_kg != null && (inclusive ? x.date <= date : x.date < date))
    .first()
  return d ? { date: d.date, weight_kg: d.weight_kg as number } : null
}

// ---------- Meals and photos ----------

async function insertPhoto(dayId: string, mealId: string | null, p: NewPhoto, sortOrder: number): Promise<string> {
  const id = uuid()
  await db.photos.add({
    id, day_id: dayId, meal_id: mealId, width: p.width, height: p.height, sort_order: sortOrder,
    created_at: nowIso(), deleted_at: null,
  })
  await db.images.add({ photo_id: id, image: p.image })
  await db.thumbs.add({ photo_id: id, thumb: p.thumb })
  return id
}

async function removePhotosForGood(ids: string[]): Promise<void> {
  await db.images.bulkDelete(ids)
  await db.thumbs.bulkDelete(ids)
  await db.photos.bulkDelete(ids)
}

/** A photo in the Meal editor: one already stored, or a new one not stored yet. */
export type DraftPhoto = { kind: 'existing'; id: string } | { kind: 'new'; key: string; photo: NewPhoto }

export interface MealInput {
  id?: string
  date: string
  meal_type: MealType
  time: string | null
  description: string
  calories_kcal: number | null
  photos: DraftPhoto[]
}

export function saveMeal(input: MealInput): Promise<string> {
  return tx(async () => {
    const t = nowIso()
    let mealId = input.id
    let dayId: string
    const fields = {
      meal_type: input.meal_type, time: input.time, description: input.description.trim(),
      calories_kcal: input.calories_kcal, updated_at: t,
    }
    if (mealId) {
      const existing = await db.meals.get(mealId)
      if (!existing) throw new Error('Meal not found')
      dayId = existing.day_id
      await db.meals.update(mealId, fields)
    } else {
      const day = await ensureDay(input.date)
      dayId = day.id
      const others = await db.meals.where('day_id').equals(dayId).toArray()
      mealId = uuid()
      await db.meals.add({
        id: mealId, day_id: dayId, ...fields,
        sort_order: others.reduce((m, x) => Math.max(m, x.sort_order), -1) + 1,
        created_at: t, deleted_at: null,
      })
    }
    const keep = new Set(input.photos.flatMap((p) => (p.kind === 'existing' ? [p.id] : [])))
    const current = live(await db.photos.where('meal_id').equals(mealId).toArray())
    await removePhotosForGood(current.filter((p) => !keep.has(p.id)).map((p) => p.id))
    for (let i = 0; i < input.photos.length; i++) {
      const p = input.photos[i]
      if (p.kind === 'existing') await db.photos.update(p.id, { sort_order: i })
      else await insertPhoto(dayId, mealId, p.photo, i)
    }
    return mealId
  })
}

/** Moves a meal one place up (-1) or down (+1) within its day. */
export function moveMeal(mealId: string, direction: -1 | 1): Promise<void> {
  return tx(async () => {
    const meal = await db.meals.get(mealId)
    if (!meal) return
    const meals = sortMeals(live(await db.meals.where('day_id').equals(meal.day_id).toArray()))
    const i = meals.findIndex((m) => m.id === mealId)
    const j = i + direction
    if (i < 0 || j < 0 || j >= meals.length) return
    ;[meals[i], meals[j]] = [meals[j], meals[i]]
    await Promise.all(meals.map((m, k) => db.meals.update(m.id, { sort_order: k })))
  })
}

/** Adds photos to the day itself (not tied to a meal). */
export function addDayPhotos(date: string, photos: NewPhoto[]): Promise<void> {
  return tx(async () => {
    const day = await ensureDay(date)
    const own = (await db.photos.where('day_id').equals(day.id).toArray()).filter((p) => p.meal_id == null)
    let next = own.reduce((m, x) => Math.max(m, x.sort_order), -1) + 1
    for (const p of photos) await insertPhoto(day.id, null, p, next++)
  })
}

// ---------- Blood sugar ----------

export interface ReadingInput {
  id?: string
  date: string
  time: string // HH:mm, Malaysia time
  /** Leave undefined when editing without changing the value, so the typed value stays untouched. */
  entered?: { value: number; unit: SugarUnit }
  context: SugarContext | null
  note: string
}

export function saveReading(input: ReadingInput): Promise<string> {
  return tx(async () => {
    const t = nowIso()
    const measured_at = klToUtcIso(input.date, input.time)
    const value = input.entered
      ? { entered_value: input.entered.value, entered_unit: input.entered.unit, value_mmol: toMmol(input.entered.value, input.entered.unit) }
      : {}
    if (input.id) {
      await db.readings.update(input.id, { measured_at, context: input.context, note: input.note.trim(), updated_at: t, ...value })
      return input.id
    }
    if (!input.entered) throw new Error('A new reading needs a value')
    const day = await ensureDay(input.date)
    const id = uuid()
    await db.readings.add({
      id, day_id: day.id, measured_at, context: input.context, note: input.note.trim(),
      entered_value: input.entered.value, entered_unit: input.entered.unit,
      value_mmol: toMmol(input.entered.value, input.entered.unit),
      created_at: t, updated_at: t, deleted_at: null,
    })
    return id
  })
}

// ---------- Deleting and Undo ----------

export type DeleteKind = 'day' | 'meal' | 'reading' | 'photo' | 'a1c' | 'activity'

/** Marks a row and everything under it as deleted. Returns the stamp that Undo uses. */
export function softDelete(kind: DeleteKind, id: string): Promise<string> {
  return tx(async () => {
    const stamp = nowIso()
    const mark = { deleted_at: stamp }
    const isLive = (r: { deleted_at: string | null }) => !r.deleted_at
    if (kind === 'photo') await db.photos.update(id, mark)
    if (kind === 'reading') await db.readings.update(id, mark)
    if (kind === 'a1c') await db.a1c.update(id, mark)
    if (kind === 'activity') await db.activities.update(id, mark)
    if (kind === 'meal') {
      await db.meals.update(id, mark)
      await db.photos.where('meal_id').equals(id).filter(isLive).modify(mark)
    }
    if (kind === 'day') {
      await db.days.update(id, mark)
      await db.meals.where('day_id').equals(id).filter(isLive).modify(mark)
      await db.readings.where('day_id').equals(id).filter(isLive).modify(mark)
      await db.activities.where('day_id').equals(id).filter(isLive).modify(mark)
      await db.photos.where('day_id').equals(id).filter(isLive).modify(mark)
    }
    return stamp
  })
}

/** Undo: brings back everything deleted with this stamp. */
export function restore(stamp: string): Promise<void> {
  return tx(async () => {
    const match = (r: { deleted_at: string | null }) => r.deleted_at === stamp
    const back = { deleted_at: null }
    await db.days.filter(match).modify(back)
    await db.meals.filter(match).modify(back)
    await db.readings.filter(match).modify(back)
    await db.photos.filter(match).modify(back)
    await db.a1c.filter(match).modify(back)
    await db.activities.filter(match).modify(back)
  })
}

/**
 * Removes soft-deleted rows for good, with their image data. With a stamp, only that
 * delete; without one, everything left over (run each time the app opens).
 */
export function purge(stamp?: string): Promise<void> {
  return tx(async () => {
    const match = (r: { deleted_at: string | null }) => (stamp ? r.deleted_at === stamp : !!r.deleted_at)
    const touched = new Set<string>()
    for (const day of await db.days.filter(match).toArray()) await hardDeleteDay(day.id)
    const photos = await db.photos.filter(match).toArray()
    photos.forEach((p) => touched.add(p.day_id))
    await removePhotosForGood(photos.map((p) => p.id))
    for (const meal of await db.meals.filter(match).toArray()) {
      touched.add(meal.day_id)
      await removePhotosForGood(await db.photos.where('meal_id').equals(meal.id).primaryKeys())
      await db.meals.delete(meal.id)
    }
    const readings = await db.readings.filter(match).toArray()
    readings.forEach((r) => touched.add(r.day_id))
    await db.readings.bulkDelete(readings.map((r) => r.id))
    const acts = await db.activities.filter(match).toArray()
    acts.forEach((a) => touched.add(a.day_id))
    await db.activities.bulkDelete(acts.map((a) => a.id))
    await db.a1c.bulkDelete(await db.a1c.filter(match).primaryKeys())
    if (!stamp) {
      // Image data with no photo row (for example from an interrupted import).
      const known = new Set(await db.photos.toCollection().primaryKeys())
      await db.images.bulkDelete((await db.images.toCollection().primaryKeys()).filter((k) => !known.has(k)))
      await db.thumbs.bulkDelete((await db.thumbs.toCollection().primaryKeys()).filter((k) => !known.has(k)))
    }
    for (const dayId of touched) await cleanupEmptyDay(dayId)
  })
}

// ---------- Activities ----------

/** The weight used to estimate calories for a date: that day's or the latest before it, else the earliest after. */
export async function weightFor(date: string): Promise<number | null> {
  const before = await latestWeight(date, true)
  if (before) return before.weight_kg
  const after = await db.days.orderBy('date').filter((d) => !d.deleted_at && d.weight_kg != null).first()
  return after?.weight_kg ?? null
}

export interface ActivityInput {
  id?: string
  date: string
  activity_type: string
  name: string
  minutes: number
  kcal: number | null
  kcal_auto: boolean
}

export function saveActivity(input: ActivityInput): Promise<string> {
  return tx(async () => {
    const t = nowIso()
    const fields = { activity_type: input.activity_type, name: input.name.trim(), minutes: input.minutes, kcal: input.kcal, kcal_auto: input.kcal_auto, updated_at: t }
    if (input.id) {
      await db.activities.update(input.id, fields)
      return input.id
    }
    const day = await ensureDay(input.date)
    const id = uuid()
    await db.activities.add({ id, day_id: day.id, ...fields, created_at: t, deleted_at: null })
    return id
  })
}

/** Total estimated calories burned, ignoring activities with no figure. */
export const burnedKcal = (activities: Activity[]): number | null => {
  const withValue = activities.filter((a) => a.kcal != null)
  return withValue.length ? withValue.reduce((s, a) => s + (a.kcal as number), 0) : null
}

// ---------- HbA1c ----------

/** Live HbA1c results, newest test first. */
export async function listA1c(): Promise<A1cResult[]> {
  return live(await db.a1c.toArray()).sort((a, b) => b.test_date.localeCompare(a.test_date) || b.created_at.localeCompare(a.created_at))
}

export interface A1cInput { id?: string; test_date: string; value_percent: number; note: string }

export async function saveA1c(input: A1cInput): Promise<string> {
  if (input.test_date > todayKL()) throw new Error('The test date cannot be in the future')
  const t = nowIso()
  const fields = { test_date: input.test_date, value_percent: input.value_percent, note: input.note.trim(), updated_at: t }
  if (input.id) {
    await db.a1c.update(input.id, fields)
    return input.id
  }
  const id = uuid()
  await db.a1c.add({ id, ...fields, created_at: t, deleted_at: null })
  return id
}

// ---------- Goal ----------

export const getGoalChanges = (): Promise<GoalChange[]> => db.goalChanges.orderBy('changed_at').reverse().toArray()

export async function currentGoal(): Promise<number | null> {
  return (await db.goalChanges.orderBy('changed_at').last())?.dream_weight_kg ?? null
}

/** Adds a line to the goal history. Returns false if the value did not change. */
export async function setGoal(value: number | null): Promise<boolean> {
  return db.transaction('rw', db.goalChanges, async () => {
    const last = await db.goalChanges.orderBy('changed_at').last()
    if ((last?.dream_weight_kg ?? null) === value) return false
    let changed_at = nowIso()
    if (last && changed_at <= last.changed_at) changed_at = new Date(Date.parse(last.changed_at) + 1).toISOString()
    await db.goalChanges.add({ id: uuid(), dream_weight_kg: value, changed_at })
    return true
  })
}

// ---------- Settings ----------

const PROFILE_KEY = 'profile_photo'

/** The user's own photo (a small square JPEG), or null. */
export async function getProfilePhoto(): Promise<ArrayBuffer | null> {
  const row = await db.settings.get(PROFILE_KEY)
  return row?.value instanceof ArrayBuffer ? row.value : null
}
export async function setProfilePhoto(image: ArrayBuffer | null): Promise<void> {
  if (image) await db.settings.put({ key: PROFILE_KEY, value: image })
  else await db.settings.delete(PROFILE_KEY)
}

export async function getSettings(): Promise<Settings> {
  const rows = await db.settings.toArray()
  const s = { ...DEFAULT_SETTINGS, ...Object.fromEntries(rows.filter((r) => r.key !== PROFILE_KEY).map((r) => [r.key, r.value])) } as Settings
  return isThemeName(s.theme) ? s : { ...s, theme: DEFAULT_THEME }
}
export async function setSetting<K extends keyof Settings>(key: K, value: Settings[K]): Promise<void> {
  await db.settings.put({ key, value })
}

export async function hasAnyData(): Promise<boolean> {
  return (await db.days.count()) > 0 || (await db.goalChanges.count()) > 0 || (await db.a1c.count()) > 0
}

export function clearAllData(): Promise<void> {
  return db.transaction('rw', db.tables, async () => {
    await Promise.all(db.tables.map((t) => t.clear()))
  })
}
