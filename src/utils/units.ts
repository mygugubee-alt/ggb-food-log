import type { Reading, SugarUnit } from '../models/types'

/** The single conversion constant: 1 mmol/L = 18.016 mg/dL. */
export const MGDL_PER_MMOL = 18.016

/** Round to `dp` decimal places, halves away from zero. */
export function roundTo(x: number, dp: number): number {
  const sign = x < 0 ? -1 : 1
  const abs = Math.abs(x)
  return sign * Number(`${Math.round(Number(`${abs.toFixed(10)}e${dp}`))}e-${dp}`)
}

export const toMmol = (value: number, unit: SugarUnit): number => (unit === 'mmol_l' ? value : value / MGDL_PER_MMOL)

/** Convert a stored mmol/L value to a display number in `unit`, rounded for display. */
export const fromMmol = (mmol: number, unit: SugarUnit): number =>
  unit === 'mmol_l' ? roundTo(mmol, 1) : roundTo(mmol * MGDL_PER_MMOL, 0)

const sugarText = (n: number, unit: SugarUnit): string => (unit === 'mmol_l' ? n.toFixed(1) : String(n))

/** A calculated value (average and so on) in the display unit. */
export const formatMmol = (mmol: number, unit: SugarUnit): string => sugarText(fromMmol(mmol, unit), unit)

/** A reading shows exactly what was typed when viewed in the unit it was typed in. */
export function displayReading(r: Pick<Reading, 'value_mmol' | 'entered_value' | 'entered_unit'>, unit: SugarUnit): string {
  return r.entered_unit === unit ? sugarText(r.entered_value, unit) : formatMmol(r.value_mmol, unit)
}

export const unitLabel = (unit: SugarUnit): string => (unit === 'mmol_l' ? 'mmol/L' : 'mg/dL')

/** One decimal place in mmol/L, whole numbers in mg/dL. Returns null if the text is not in that form. */
export function parseSugarInput(text: string, unit: SugarUnit): number | null {
  const t = text.trim().replace(',', '.')
  const ok = unit === 'mmol_l' ? /^\d{1,2}(\.\d)?$/.test(t) : /^\d{1,4}$/.test(t)
  return ok ? Number(t) : null
}

export const SUGAR_MAX_MMOL = 60
/** 'reject' = typing error; 'confirm' = allowed after a neutral check; 'ok' = save. */
export function checkSugar(mmol: number): 'reject' | 'confirm' | 'ok' {
  if (!(mmol > 0) || mmol > SUGAR_MAX_MMOL) return 'reject'
  // Compare at display precision so 18 mg/dL and 540 mg/dL sit on the boundary as stated.
  const shown = roundTo(mmol, 1)
  return shown < 1 || shown > 30 ? 'confirm' : 'ok'
}

/** 20.0 to 300.0, at most one decimal place. */
export function parseWeight(text: string): number | null {
  const t = text.trim().replace(',', '.')
  if (!/^\d{2,3}(\.\d)?$/.test(t)) return null
  const n = Number(t)
  return n >= 20 && n <= 300 ? n : null
}
/** Whole number 0 to 10000. */
export function parseCalories(text: string): number | null {
  const t = text.trim()
  if (!/^\d{1,5}$/.test(t)) return null
  const n = Number(t)
  return n <= 10000 ? n : null
}

/** HbA1c in percent: 3.0 to 20.0, at most one decimal place. */
export function parseA1c(text: string): number | null {
  const t = text.trim().replace(',', '.')
  if (!/^\d{1,2}(\.\d)?$/.test(t)) return null
  const n = Number(t)
  return n >= 3 && n <= 20 ? n : null
}

export const formatKg = (n: number): string => roundTo(n, 1).toFixed(1)
export const formatKcal = (n: number): string => roundTo(n, 0).toLocaleString('en-US')
