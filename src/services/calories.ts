import type { DayEntry, Meal } from '../models/types'

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
