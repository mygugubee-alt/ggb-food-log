import type { Activity, DayEntry, Meal, MealType, Photo, Reading, SugarContext } from '../models/types'
import { dayCalories } from './calories'
import { dayHasOwnContent } from '../db/repo'

export interface WeightPoint { date: string; value: number }
export type ContextKey = SugarContext | 'none'

export interface WeeklyReport {
  dates: string[]
  loggedDays: number
  weight: null | {
    first: WeightPoint
    last: WeightPoint
    /** last minus first; null when only one weight was logged */
    change: number | null
    average: number
    min: number
    max: number
    daysUsed: number
    series: WeightPoint[]
  }
  sugar: null | {
    count: number
    average: number
    min: Reading
    max: Reading
    byContext: { context: ContextKey; average: number; count: number }[]
    daysWith: number
    readings: Reading[]
  }
  food: null | {
    mealCount: number
    byType: Record<MealType, number>
    daysWithPhotos: number
    calories: null | { total: number; average: number; daysUsed: number; daysFromMeals: number }
    days: { date: string; meals: Meal[] }[]
  }
  /** days = days with at least one activity; kcal sums the activities that have a figure */
  activity: null | { days: number; count: number; minutes: number; kcal: number }
  notes: { date: string; note: string }[]
}

const CONTEXT_ORDER: ContextKey[] = ['fasting', 'after_meal', 'before_meal', 'bedtime', 'other', 'none']
const mean = (xs: number[]): number => xs.reduce((s, x) => s + x, 0) / xs.length

/**
 * Plain arithmetic over one week of live rows. Empty fields are ignored, never
 * counted as zero. Values are returned unrounded; rounding happens at display.
 */
export function computeWeeklyReport(
  dates: string[], days: DayEntry[], meals: Meal[], readings: Reading[], photos: Photo[], activities: Activity[] = [],
): WeeklyReport {
  const inWeek = days.filter((d) => dates.includes(d.date)).sort((a, b) => a.date.localeCompare(b.date))
  const dateOf = new Map(inWeek.map((d) => [d.id, d.date]))
  const wkMeals = meals.filter((m) => dateOf.has(m.day_id))
  const mealIds = new Set(wkMeals.map((m) => m.id))
  const wkReadings = readings.filter((r) => dateOf.has(r.day_id)).sort((a, b) => a.measured_at.localeCompare(b.measured_at))
  const wkPhotos = photos.filter((p) => dateOf.has(p.day_id) && (p.meal_id == null || mealIds.has(p.meal_id)))
  const mealsOf = (dayId: string) => wkMeals.filter((m) => m.day_id === dayId).sort((a, b) => a.sort_order - b.sort_order)

  const wkActs = activities.filter((a) => dateOf.has(a.day_id))
  const withChildren = new Set([...wkMeals, ...wkReadings, ...wkPhotos, ...wkActs].map((x) => x.day_id))
  const loggedDays = inWeek.filter((d) => dayHasOwnContent(d) || withChildren.has(d.id)).length

  // Weight
  const series: WeightPoint[] = inWeek.filter((d) => d.weight_kg != null).map((d) => ({ date: d.date, value: d.weight_kg as number }))
  const weight = series.length === 0 ? null : {
    first: series[0],
    last: series[series.length - 1],
    change: series.length >= 2 ? series[series.length - 1].value - series[0].value : null,
    average: mean(series.map((p) => p.value)),
    min: Math.min(...series.map((p) => p.value)),
    max: Math.max(...series.map((p) => p.value)),
    daysUsed: series.length,
    series,
  }

  // Blood sugar: every reading counts once
  let sugar: WeeklyReport['sugar'] = null
  if (wkReadings.length > 0) {
    const byContext = CONTEXT_ORDER.flatMap((context) => {
      const group = wkReadings.filter((r) => (r.context ?? 'none') === context)
      return group.length ? [{ context, average: mean(group.map((r) => r.value_mmol)), count: group.length }] : []
    })
    sugar = {
      count: wkReadings.length,
      average: mean(wkReadings.map((r) => r.value_mmol)),
      min: wkReadings.reduce((a, b) => (b.value_mmol < a.value_mmol ? b : a)),
      max: wkReadings.reduce((a, b) => (b.value_mmol > a.value_mmol ? b : a)),
      byContext,
      daysWith: new Set(wkReadings.map((r) => r.day_id)).size,
      readings: wkReadings,
    }
  }

  // Food
  const perDay = inWeek.map((d) => dayCalories(d, mealsOf(d.id))).filter((c) => c != null)
  const calories = perDay.length === 0 ? null : {
    total: perDay.reduce((s, c) => s + c.value, 0),
    average: mean(perDay.map((c) => c.value)),
    daysUsed: perDay.length,
    daysFromMeals: perDay.filter((c) => c.fromMeals).length,
  }
  const daysWithPhotos = new Set(wkPhotos.map((p) => p.day_id)).size
  const byType: Record<MealType, number> = { breakfast: 0, lunch: 0, dinner: 0, snack: 0 }
  wkMeals.forEach((m) => { byType[m.meal_type]++ })
  const food = wkMeals.length === 0 && daysWithPhotos === 0 && !calories ? null : {
    mealCount: wkMeals.length,
    byType,
    daysWithPhotos,
    calories,
    days: inWeek.map((d) => ({ date: d.date, meals: mealsOf(d.id) })).filter((x) => x.meals.length > 0),
  }

  const activityDayIds = new Set(wkActs.map((a) => a.day_id))
  return {
    dates,
    loggedDays,
    weight,
    sugar,
    food,
    activity: activityDayIds.size === 0 ? null : {
      days: activityDayIds.size,
      count: wkActs.length,
      minutes: wkActs.reduce((s, a) => s + a.minutes, 0),
      kcal: wkActs.reduce((s, a) => s + (a.kcal ?? 0), 0),
    },
    notes: inWeek.filter((d) => d.day_note.trim() !== '').map((d) => ({ date: d.date, note: d.day_note })),
  }
}
