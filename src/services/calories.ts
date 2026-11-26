import { MEAL_TYPES, type DayEntry, type Meal, type MealType } from '../models/types'

export interface DayCalories { value: number; fromMeals: boolean }

/** Sum of the meal calories, or null if no meal has a value. */
export function mealCaloriesSum(meals: Meal[]): number | null {
  const withValue = meals.filter((m) => m.calories_kcal != null)
  return withValue.length ? withValue.reduce((s, m) => s + (m.calories_kcal as number), 0) : null
}

/**
 * The day's calories eaten: the sum of the meal calories, or null if no meal has a
 * value. (The separate day total was removed from the app in v1.6; a value stored
 * by an older version is ignored, so nothing hidden changes the figure.)
 */
export function dayCalories(_day: Pick<DayEntry, 'calories_kcal'> | null, meals: Meal[]): DayCalories | null {
  const sum = mealCaloriesSum(meals)
  return sum == null ? null : { value: sum, fromMeals: true }
}

/** kcal per meal type (meals without a figure count as 0). */
export function kcalByMealType(meals: Meal[]): Record<MealType, number> {
  const out: Record<MealType, number> = { breakfast: 0, lunch: 0, dinner: 0, snack: 0 }
  for (const m of meals) if (m.calories_kcal != null) out[m.meal_type] += m.calories_kcal
  return out
}

export interface RingSegment { type: MealType; start: number; length: number } // fractions of the full ring, 0–1

/**
 * Ring pieces in meal order. With a goal the ring fills eaten / goal (whole ring once
 * the goal is reached, scaled down to fit); without one the pieces share the whole ring.
 */
export function ringSegments(totals: Record<MealType, number>, goal: number | null): RingSegment[] {
  const eaten = MEAL_TYPES.reduce((s, t) => s + totals[t], 0)
  if (eaten <= 0) return []
  const whole = goal != null ? Math.max(goal, eaten) : eaten
  const out: RingSegment[] = []
  let at = 0
  for (const type of MEAL_TYPES) {
    if (totals[type] <= 0) continue
    const length = totals[type] / whole
    out.push({ type, start: at, length })
    at += length
  }
  return out
}

/** Goal − eaten + burned; negative means over the goal. */
export function kcalRemaining(goal: number, eaten: number, burned: number | null): number {
  return goal - eaten + (burned ?? 0)
}
