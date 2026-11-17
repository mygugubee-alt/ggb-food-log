import { beforeEach, describe, expect, it } from 'vitest'
import { ACTIVITY_TYPES, activityType, estimateKcal } from '../src/data/activities'
import { FOODS, searchFoods } from '../src/data/foods'
import { db } from '../src/db/db'
import { burnedKcal, clearAllData, getDay, loadAll, loadDayBundle, isLogged, purge, restore, saveActivity, softDelete, updateDay, weightFor } from '../src/db/repo'
import { buildExportZip, prepareImport, runImport } from '../src/services/exportImport'
import { computeWeeklyReport } from '../src/services/report'
import { weekDates } from '../src/utils/dates'

beforeEach(async () => { await clearAllData() })
const D = '2026-01-10'
const walk = (minutes: number, kcal: number | null = 126) =>
  saveActivity({ date: D, activity_type: 'walking', name: 'Walking', minutes, kcal, kcal_auto: true })

describe('calorie estimate for an activity', () => {
  it('is MET x weight x hours, rounded', () => {
    expect(estimateKcal(3.5, 72, 30)).toBe(126)
    expect(estimateKcal(7.0, 60, 45)).toBe(315)
    expect(estimateKcal(9.8, 71.8, 20)).toBe(235)
  })
  it('cannot be estimated without a weight, a MET value or minutes', () => {
    expect(estimateKcal(3.5, null, 30)).toBeNull()
    expect(estimateKcal(null, 70, 30)).toBeNull()
    expect(estimateKcal(3.5, 70, 0)).toBeNull()
  })
  it('every listed activity has a sensible MET value, except Other', () => {
    for (const t of ACTIVITY_TYPES) {
      if (t.id === 'other') expect(t.met).toBeNull()
      else expect(t.met).toBeGreaterThan(1.5)
    }
    expect(activityType('unknown').id).toBe('other')
  })
  it('uses the weight of that day, else the latest before it, else the earliest after', async () => {
    expect(await weightFor(D)).toBeNull()
    await updateDay('2026-01-20', { weight_kg: 70 })
    expect(await weightFor(D)).toBe(70)
    await updateDay('2026-01-05', { weight_kg: 72 })
    expect(await weightFor(D)).toBe(72)
    await updateDay(D, { weight_kg: 71.5 })
    expect(await weightFor(D)).toBe(71.5)
  })
})

describe('activities in a day', () => {
  it('logging an activity creates the day, and the total ignores missing figures', async () => {
    await walk(30, 126)
    await walk(20, null)
    await saveActivity({ date: D, activity_type: 'other', name: '太极', minutes: 40, kcal: 150, kcal_auto: false })
    const b = await loadDayBundle(D)
    expect(isLogged(b)).toBe(true)
    expect(b.activities.map((a) => a.name)).toEqual(['Walking', 'Walking', '太极'])
    expect(burnedKcal(b.activities)).toBe(276)
    expect(burnedKcal([])).toBeNull()
  })
  it('delete can be undone, and removing the last one removes the empty day', async () => {
    const id = await walk(30)
    let stamp = await softDelete('activity', id)
    expect((await loadDayBundle(D)).activities).toHaveLength(0)
    await restore(stamp)
    expect((await loadDayBundle(D)).activities).toHaveLength(1)
    stamp = await softDelete('activity', id)
    await purge(stamp)
    expect(await db.activities.count()).toBe(0)
    expect(await getDay(D)).toBeNull()
  })
  it('deleting the day takes its activities with it', async () => {
    await walk(30)
    const stamp = await softDelete('day', (await getDay(D))!.id)
    expect((await loadAll()).activities).toHaveLength(0)
    await purge(stamp)
    expect(await db.activities.count()).toBe(0)
  })
  it('the weekly report totals minutes and calories burned', async () => {
    await saveActivity({ date: '2026-11-09', activity_type: 'walking', name: 'Walking', minutes: 30, kcal: 126, kcal_auto: true })
    await saveActivity({ date: '2026-11-09', activity_type: 'yoga', name: 'Yoga', minutes: 45, kcal: null, kcal_auto: false })
    await saveActivity({ date: '2026-11-12', activity_type: 'jogging', name: 'Jogging', minutes: 20, kcal: 168, kcal_auto: true })
    await updateDay('2026-11-13', { activity_note: 'gardening a bit' })
    const all = await loadAll()
    const r = computeWeeklyReport(weekDates('2026-11-09'), all.days, all.meals, all.readings, all.photos, all.activities)
    expect(r.activity).toEqual({ days: 2, count: 3, minutes: 95, kcal: 294 })
    expect(r.loggedDays).toBe(2)
  })
  it('is exported and imported', async () => {
    await walk(30, 126)
    const zip = await buildExportZip()
    await clearAllData()
    await runImport(zip, await prepareImport(zip), 'skip', async () => new ArrayBuffer(1))
    const b = await loadDayBundle(D)
    expect(b.activities.map((a) => [a.name, a.minutes, a.kcal, a.kcal_auto])).toEqual([['Walking', 30, 126, true]])
    await runImport(zip, await prepareImport(zip), 'replace', async () => new ArrayBuffer(1))
    expect(await db.activities.count()).toBe(1)
  })
})

describe('built-in food list', () => {
  it('finds foods by English, Malay or Chinese text', () => {
    expect(searchFoods('nasi lemak').map((f) => f.name)).toContain('Nasi lemak (basic)')
    expect(searchFoods('鸡饭')[0].name).toBe('Chicken rice')
    expect(searchFoods('TEH TARIK')[0].kcal).toBe(130)
    expect(searchFoods('zzzz')).toEqual([])
    expect(searchFoods('  ')).toEqual([])
  })
  it('has unique names and plausible calories', () => {
    expect(new Set(FOODS.map((f) => f.name)).size).toBe(FOODS.length)
    for (const f of FOODS) {
      expect(f.kcal).toBeGreaterThanOrEqual(0)
      expect(f.kcal).toBeLessThanOrEqual(1000)
      expect(f.serving).not.toBe('')
    }
  })
})
