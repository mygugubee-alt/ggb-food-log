import { describe, expect, it } from 'vitest'
import { computeWeeklyReport } from '../src/services/report'
import { dayCalories } from '../src/services/calories'
import type { DayEntry, Meal, MealType, Photo, Reading, SugarContext, SugarUnit } from '../src/models/types'
import { klToUtcIso, weekDates } from '../src/utils/dates'
import { toMmol } from '../src/utils/units'

const T = '2026-11-01T00:00:00.000Z'
let n = 0
const day = (date: string, p: Partial<DayEntry> = {}): DayEntry => ({
  id: `d-${date}`, date, weight_kg: null, activity_note: '', calories_kcal: null, day_note: '',
  created_at: T, updated_at: T, deleted_at: null, ...p,
})
const meal = (date: string, meal_type: MealType, calories_kcal: number | null): Meal => ({
  id: `m-${++n}`, day_id: `d-${date}`, meal_type, time: null, description: '', calories_kcal, sort_order: n,
  created_at: T, updated_at: T, deleted_at: null,
})
const reading = (date: string, time: string, value: number, context: SugarContext | null, unit: SugarUnit = 'mmol_l'): Reading => ({
  id: `r-${++n}`, day_id: `d-${date}`, measured_at: klToUtcIso(date, time), value_mmol: toMmol(value, unit),
  entered_value: value, entered_unit: unit, context, note: '', created_at: T, updated_at: T, deleted_at: null,
})
const photo = (date: string, meal_id: string | null): Photo => ({
  id: `p-${++n}`, day_id: `d-${date}`, meal_id, width: 10, height: 10, sort_order: 0, created_at: T, deleted_at: null,
})

const dates = weekDates('2026-11-09') // Monday 9 Nov to Sunday 15 Nov 2026
const days = [
  day('2026-11-09', { weight_kg: 72.4, calories_kcal: 1800, activity_note: '30 min walk', day_note: '今天很好' }),
  day('2026-11-10'),
  day('2026-11-11', { weight_kg: 72.0, calories_kcal: 2000 }),
  day('2026-11-13', { weight_kg: 71.8 }),
  day('2026-11-14'),
  day('2026-11-16', { weight_kg: 60.0, calories_kcal: 9000 }), // next week: must be ignored
]
const meals = [
  meal('2026-11-10', 'breakfast', 400),
  meal('2026-11-10', 'lunch', 600),
  meal('2026-11-11', 'dinner', 500), // the day total (2000) wins, this is not added
  meal('2026-11-13', 'snack', null),
  meal('2026-11-16', 'lunch', 700),
]
const readings = [
  reading('2026-11-09', '07:00', 5.6, 'fasting'),
  reading('2026-11-09', '13:30', 8.0, 'after_meal'),
  reading('2026-11-14', '07:10', 6.0, 'fasting'),
  reading('2026-11-14', '22:00', 126, null, 'mg_dl'),
  reading('2026-11-16', '07:00', 20.0, 'fasting'),
]
const photos = [photo('2026-11-10', meals[0].id), photo('2026-11-10', meals[1].id), photo('2026-11-13', null), photo('2026-11-16', null)]

describe('weekly report', () => {
  const r = computeWeeklyReport(dates, days, meals, readings, photos)

  it('counts logged days', () => {
    expect(r.loggedDays).toBe(5)
  })
  it('weight: first, last, change, average, range, days used', () => {
    expect(r.weight).not.toBeNull()
    expect(r.weight!.first).toEqual({ date: '2026-11-09', value: 72.4 })
    expect(r.weight!.last).toEqual({ date: '2026-11-13', value: 71.8 })
    expect(r.weight!.change).toBeCloseTo(-0.6, 9)
    expect(r.weight!.average).toBeCloseTo((72.4 + 72.0 + 71.8) / 3, 9)
    expect(r.weight!.min).toBe(71.8)
    expect(r.weight!.max).toBe(72.4)
    expect(r.weight!.daysUsed).toBe(3)
  })
  it('blood sugar: every reading counts once, with averages by context', () => {
    const mg = 126 / 18.016
    expect(r.sugar!.count).toBe(4)
    expect(r.sugar!.average).toBeCloseTo((5.6 + 8.0 + 6.0 + mg) / 4, 9)
    expect(r.sugar!.min.value_mmol).toBe(5.6)
    expect(r.sugar!.max.value_mmol).toBe(8.0)
    expect(r.sugar!.daysWith).toBe(2)
    expect(r.sugar!.byContext.map((c) => c.context)).toEqual(['fasting', 'after_meal', 'none'])
    expect(r.sugar!.byContext[0]).toMatchObject({ count: 2 })
    expect(r.sugar!.byContext[0].average).toBeCloseTo(5.8, 9)
    expect(r.sugar!.byContext[2].average).toBeCloseTo(mg, 9)
  })
  it('food: meal counts and days with photos', () => {
    expect(r.food!.mealCount).toBe(4)
    expect(r.food!.byType).toEqual({ breakfast: 1, lunch: 1, dinner: 1, snack: 1 })
    expect(r.food!.daysWithPhotos).toBe(2)
    expect(r.food!.days.map((d) => d.date)).toEqual(['2026-11-10', '2026-11-11', '2026-11-13'])
  })
  it('calories come from the meals only; an old day total is ignored', () => {
    expect(r.food!.calories).toEqual({ total: 1000 + 500, average: 750, daysUsed: 2, daysFromMeals: 2 })
  })
  it('activity and notes', () => {
    expect(r.activity).toBeNull() // an old activity note no longer counts
    expect(r.notes).toEqual([{ date: '2026-11-09', note: '今天很好' }])
  })
  it('an empty week has no data in any section, not zeros', () => {
    const empty = computeWeeklyReport(weekDates('2026-10-05'), days, meals, readings, photos)
    expect(empty).toMatchObject({ loggedDays: 0, weight: null, sugar: null, food: null, activity: null, notes: [] })
  })
  it('one weight in the week gives no change', () => {
    const one = computeWeeklyReport(dates, [days[0]], [], [], [])
    expect(one.weight!.change).toBeNull()
    expect(one.weight!.daysUsed).toBe(1)
  })
  it('a different week start changes the range', () => {
    const sundayWeek = computeWeeklyReport(weekDates('2026-11-15'), days, meals, readings, photos)
    expect(sundayWeek.weight!.series).toEqual([{ date: '2026-11-16', value: 60.0 }])
  })
})

describe('day calories', () => {
  it('is the sum of the meal calories', () => {
    expect(dayCalories({ calories_kcal: null }, [meals[0], meals[1]])).toEqual({ value: 1000, fromMeals: true })
  })
  it('ignores a day total stored by an older version', () => {
    expect(dayCalories({ calories_kcal: 2000 }, [meals[2]])).toEqual({ value: 500, fromMeals: true })
    expect(dayCalories({ calories_kcal: 2000 }, [])).toBeNull()
  })
  it('is empty when no meal has calories', () => {
    expect(dayCalories({ calories_kcal: null }, [meals[3]])).toBeNull()
    expect(dayCalories(null, [])).toBeNull()
  })
})
