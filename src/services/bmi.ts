/**
 * Body mass index = weight (kg) / height (m)².
 * Categories use the Malaysian Ministry of Health cut-offs for adults (Asian),
 * which are lower than the WHO international ones.
 */
export type BmiBand = 'under' | 'healthy' | 'over' | 'obese'

export function bmi(weightKg: number, heightCm: number): number {
  const m = heightCm / 100
  return Math.round((weightKg / (m * m)) * 10) / 10
}

/** Takes the BMI already rounded to one decimal, so the shown number and band agree. */
export function bmiBand(value: number): BmiBand {
  if (value < 18.5) return 'under'
  if (value < 23) return 'healthy'
  if (value < 27.5) return 'over'
  return 'obese'
}

/** Weight in kg for a given BMI at this height, one decimal. */
export function weightForBmi(value: number, heightCm: number): number {
  const m = heightCm / 100
  return Math.round(value * m * m * 10) / 10
}

/** Band edges and the ends of the drawn scale. Each band gets an equal share of the bar. */
export const BMI_EDGES = [15, 18.5, 23, 27.5, 32] as const

/** Where a BMI sits on the bar, 0–1 (each band a quarter), clamped to the ends. */
export function bmiPosition(value: number): number {
  const e = BMI_EDGES
  if (value <= e[0]) return 0
  if (value >= e[4]) return 1
  let i = 0
  while (value >= e[i + 1]) i++
  return (i + (value - e[i]) / (e[i + 1] - e[i])) / 4
}
