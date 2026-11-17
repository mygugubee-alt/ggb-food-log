import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../src/db/db'
import {
  addDayPhotos, clearAllData, currentGoal, ensureDay, getDay, getGoalChanges, isLogged, latestWeight, loadAll,
  loadDayBundle, moveMeal, purge, restore, saveMeal, saveReading, setGoal, softDelete, updateDay,
} from '../src/db/repo'
import type { NewPhoto } from '../src/models/types'
import { addDays, klParts, todayKL } from '../src/utils/dates'

const D = '2026-01-10'
const photo = (): NewPhoto => ({ image: new Uint8Array([1, 2, 3]).buffer, thumb: new Uint8Array([9]).buffer, width: 4, height: 3 })
const newMeal = (description: string, photos = 0) => saveMeal({
  date: D, meal_type: 'lunch', time: '12:30', description, calories_kcal: null,
  photos: Array.from({ length: photos }, (_, i) => ({ kind: 'new' as const, key: String(i), photo: photo() })),
})

beforeEach(async () => { await clearAllData() })

describe('days', () => {
  it('a day is created the first time something is logged', async () => {
    expect(await getDay(D)).toBeNull()
    await updateDay(D, { weight_kg: 71.8 })
    expect((await getDay(D))!.weight_kg).toBe(71.8)
  })
  it('an emptied day is removed', async () => {
    await updateDay(D, { weight_kg: 71.8, day_note: 'x' })
    await updateDay(D, { weight_kg: null })
    expect(await getDay(D)).not.toBeNull()
    await updateDay(D, { day_note: '  ' })
    expect(await getDay(D)).toBeNull()
    expect(await db.days.count()).toBe(0)
  })
  it('future dates cannot be logged', async () => {
    await expect(ensureDay(addDays(todayKL(), 1))).rejects.toThrow()
    await expect(updateDay(addDays(todayKL(), 1), { weight_kg: 70 })).rejects.toThrow()
    expect(await db.days.count()).toBe(0)
  })
  it('finds the latest weight', async () => {
    await updateDay('2026-01-08', { weight_kg: 72.1 })
    await updateDay(D, { weight_kg: 71.8 })
    await updateDay('2026-01-11', { day_note: 'no weight' })
    expect(await latestWeight('2026-12-31', true)).toEqual({ date: D, weight_kg: 71.8 })
    expect(await latestWeight(D, false)).toEqual({ date: '2026-01-08', weight_kg: 72.1 })
    expect(await latestWeight('2026-01-01', true)).toBeNull()
  })
})

describe('meals, photos and Undo', () => {
  it('saves a meal with photos and keeps Chinese text', async () => {
    await newMeal('烧鸡、西葫芦、小番茄', 2)
    const b = await loadDayBundle(D)
    expect(b.meals[0].description).toBe('烧鸡、西葫芦、小番茄')
    expect(b.photos).toHaveLength(2)
    expect(await db.images.count()).toBe(2)
    expect(isLogged(b)).toBe(true)
  })
  it('Undo brings a deleted meal and its photos back', async () => {
    const id = await newMeal('rice', 2)
    const stamp = await softDelete('meal', id)
    let b = await loadDayBundle(D)
    expect(b.meals).toHaveLength(0)
    expect(b.photos).toHaveLength(0)
    expect(isLogged(b)).toBe(false)
    await restore(stamp)
    b = await loadDayBundle(D)
    expect(b.meals).toHaveLength(1)
    expect(b.photos).toHaveLength(2)
  })
  it('without Undo the meal, its photos and the empty day are removed for good', async () => {
    const id = await newMeal('rice', 2)
    const stamp = await softDelete('meal', id)
    await purge(stamp)
    expect(await db.meals.count()).toBe(0)
    expect(await db.photos.count()).toBe(0)
    expect(await db.images.count()).toBe(0)
    expect(await db.thumbs.count()).toBe(0)
    expect(await db.days.count()).toBe(0)
  })
  it('purging one delete leaves another pending delete alone', async () => {
    const a = await newMeal('a', 1)
    const b = await newMeal('b', 1)
    const s1 = await softDelete('meal', a)
    await new Promise((r) => setTimeout(r, 5))
    const s2 = await softDelete('meal', b)
    await purge(s1)
    await restore(s2)
    expect((await loadDayBundle(D)).meals.map((m) => m.description)).toEqual(['b'])
    expect(await db.images.count()).toBe(1)
  })
  it('editing a meal can remove and reorder photos', async () => {
    const id = await newMeal('rice', 3)
    const before = (await loadDayBundle(D)).photos
    await saveMeal({
      id, date: D, meal_type: 'dinner', time: null, description: 'rice 2', calories_kcal: 500,
      photos: [{ kind: 'existing', id: before[2].id }, { kind: 'existing', id: before[0].id }],
    })
    const after = await loadDayBundle(D)
    expect(after.meals[0]).toMatchObject({ meal_type: 'dinner', calories_kcal: 500, description: 'rice 2' })
    expect(after.photos.map((p) => p.id)).toEqual([before[2].id, before[0].id])
    expect(await db.images.count()).toBe(2)
  })
  it('meals keep their order and can be moved', async () => {
    const a = await newMeal('a'); await newMeal('b'); const c = await newMeal('c')
    await moveMeal(c, -1)
    await moveMeal(a, -1) // already first: no change
    expect((await loadDayBundle(D)).meals.map((m) => m.description)).toEqual(['a', 'c', 'b'])
  })
  it('deleting a day hides everything, and Undo restores it', async () => {
    await updateDay(D, { weight_kg: 70 })
    await newMeal('rice', 1)
    await addDayPhotos(D, [photo()])
    await saveReading({ date: D, time: '07:00', entered: { value: 5.6, unit: 'mmol_l' }, context: 'fasting', note: '' })
    const stamp = await softDelete('day', (await getDay(D))!.id)
    expect(await getDay(D)).toBeNull()
    expect((await loadAll()).days).toHaveLength(0)
    await restore(stamp)
    const b = await loadDayBundle(D)
    expect([b.meals.length, b.photos.length, b.readings.length]).toEqual([1, 2, 1])
  })
  it('logging on a date whose deleted day is waiting for Undo starts a clean day', async () => {
    await newMeal('old', 1)
    await softDelete('day', (await getDay(D))!.id)
    await updateDay(D, { weight_kg: 70 })
    const b = await loadDayBundle(D)
    expect(b.day!.weight_kg).toBe(70)
    expect(b.meals).toHaveLength(0)
    expect(await db.images.count()).toBe(0)
  })
  it('opening the app clears leftovers', async () => {
    const id = await newMeal('rice', 1)
    await softDelete('meal', id)
    await db.images.add({ photo_id: 'orphan', image: new ArrayBuffer(1) })
    await purge()
    expect(await db.meals.count()).toBe(0)
    expect(await db.images.count()).toBe(0)
    expect(await db.days.count()).toBe(0)
  })
})

describe('blood sugar', () => {
  it('stores the typed value, the unit and a full-precision mmol/L value', async () => {
    const id = await saveReading({ date: D, time: '00:30', entered: { value: 126, unit: 'mg_dl' }, context: null, note: '' })
    const r = (await db.readings.get(id))!
    expect(r.entered_value).toBe(126)
    expect(r.entered_unit).toBe('mg_dl')
    expect(r.value_mmol).toBe(126 / 18.016)
    expect(klParts(r.measured_at)).toEqual({ date: D, time: '00:30' })
  })
  it('editing the time or note leaves the typed value untouched', async () => {
    const id = await saveReading({ date: D, time: '07:00', entered: { value: 126, unit: 'mg_dl' }, context: null, note: '' })
    await saveReading({ id, date: D, time: '08:15', context: 'fasting', note: 'after walk' })
    const r = (await db.readings.get(id))!
    expect(r).toMatchObject({ entered_value: 126, entered_unit: 'mg_dl', context: 'fasting', note: 'after walk' })
    expect(klParts(r.measured_at).time).toBe('08:15')
  })
})

describe('dream weight', () => {
  it('every change adds a line, including clearing', async () => {
    expect(await currentGoal()).toBeNull()
    expect(await setGoal(62)).toBe(true)
    expect(await setGoal(62)).toBe(false)
    expect(await setGoal(61.5)).toBe(true)
    expect(await currentGoal()).toBe(61.5)
    expect(await setGoal(null)).toBe(true)
    expect(await currentGoal()).toBeNull()
    expect((await getGoalChanges()).map((g) => g.dream_weight_kg)).toEqual([null, 61.5, 62])
  })
})
