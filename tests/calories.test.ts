import { describe, expect, it } from 'vitest'
import { kcalByMealType, kcalRemaining, ringSegments } from '../src/services/calories'
import type { Meal, MealType } from '../src/models/types'

const meal = (meal_type: MealType, calories_kcal: number | null): Meal => ({
  id: crypto.randomUUID(), day_id: 'd', meal_type, time: null, description: '', calories_kcal, sort_order: 0,
  created_at: '', updated_at: '', deleted_at: null,
})

describe('calorie ring', () => {
  const totals = kcalByMealType([meal('breakfast', 300), meal('lunch', 500), meal('lunch', 100), meal('snack', null), meal('dinner', 100)])
  it('adds meals up per type', () => {
    expect(totals).toEqual({ breakfast: 300, lunch: 600, dinner: 100, snack: 0 })
  })
  it('fills eaten / goal with a goal', () => {
    const s = ringSegments(totals, 2000)
    expect(s.map((x) => x.type)).toEqual(['breakfast', 'lunch', 'dinner'])
    expect(s[0]).toMatchObject({ start: 0, length: 0.15 })
    expect(s[2].start + s[2].length).toBeCloseTo(0.5)
  })
  it('fills the whole ring without a goal, or when over it', () => {
    expect(ringSegments(totals, null).reduce((a, x) => a + x.length, 0)).toBeCloseTo(1)
    expect(ringSegments(totals, 500).reduce((a, x) => a + x.length, 0)).toBeCloseTo(1)
    expect(ringSegments(kcalByMealType([]), 2000)).toEqual([])
  })
  it('remaining counts burned calories', () => {
    expect(kcalRemaining(1500, 1050, 465)).toBe(915)
    expect(kcalRemaining(1500, 1588, null)).toBe(-88)
  })
})
