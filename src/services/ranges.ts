import type { RangeMode, Reading, Settings, SugarContext } from '../models/types'
import { roundTo } from '../utils/units'

// Reference ranges for blood glucose, in mmol/L. These follow commonly used
// ADA-style thresholds. They are general reference values, not a diagnosis:
// a doctor may set different targets.
export type Level = 'very_low' | 'low' | 'in_range' | 'above' | 'high'

export const LOW_BELOW = 3.9
export const VERY_LOW_BELOW = 3.0
/** General ranges (people without a diabetes diagnosis). */
export const GENERAL = { fasting_above: 5.6, fasting_high: 7.0, after_above: 7.8, after_high: 11.1, any_high: 11.1 }
/** Common targets for many adults who already have diabetes. */
export const DIABETES_TARGETS = { before_max: 7.0, after_max: 10.0 }

export interface CustomTargets { before_max: number; after_max: number }

/**
 * Where one reading sits against the chosen ranges, or null when ranges are off
 * or no range applies to that kind of reading. Compared at display precision
 * (one decimal place in mmol/L), so 126 mg/dL counts as 7.0.
 *
 * - Low and very low apply to every reading.
 * - General: fasting and after-meal readings have their own ranges; any other
 *   reading is only flagged when it is 11.1 or higher.
 * - Diabetes / own targets: fasting and before-meal readings are in range up to
 *   and including the "before" target; after-meal readings are in range under the
 *   "after" target; other readings are not rated.
 */
export function classify(valueMmol: number, context: SugarContext | null, mode: RangeMode, custom: CustomTargets): Level | null {
  if (mode === 'off') return null
  const v = roundTo(valueMmol, 1)
  if (v < VERY_LOW_BELOW) return 'very_low'
  if (v < LOW_BELOW) return 'low'
  if (mode === 'general') {
    if (context === 'after_meal') return v >= GENERAL.after_high ? 'high' : v >= GENERAL.after_above ? 'above' : 'in_range'
    if (context === 'fasting') return v >= GENERAL.fasting_high ? 'high' : v >= GENERAL.fasting_above ? 'above' : 'in_range'
    return v >= GENERAL.any_high ? 'high' : null
  }
  const t = mode === 'diabetes' ? DIABETES_TARGETS : custom
  if (context === 'after_meal') return v >= t.after_max ? 'above' : 'in_range'
  if (context === 'fasting' || context === 'before_meal') return v > t.before_max ? 'above' : 'in_range'
  return null
}

export const customTargets = (s: Settings): CustomTargets => ({ before_max: s.custom_before_max, after_max: s.custom_after_max })

export const levelOf = (r: Pick<Reading, 'value_mmol' | 'context'>, s: Settings): Level | null =>
  classify(r.value_mmol, r.context, s.range_mode, customTargets(s))

export const isLow = (l: Level | null): boolean => l === 'low' || l === 'very_low'

// ---------- HbA1c ----------

// Standard diagnostic bands (ADA criteria), in percent. A single high result is
// usually confirmed with a second test before a diagnosis is made.
export type A1cBand = 'normal' | 'prediabetes' | 'diabetes'
export const A1C_PREDIABETES_FROM = 5.7
export const A1C_DIABETES_FROM = 6.5

export function a1cBand(percent: number): A1cBand {
  const v = roundTo(percent, 1)
  return v >= A1C_DIABETES_FROM ? 'diabetes' : v >= A1C_PREDIABETES_FROM ? 'prediabetes' : 'normal'
}

/** The colour family each band shares with the blood sugar levels. */
export const A1C_TONE: Record<A1cBand, Level> = { normal: 'in_range', prediabetes: 'above', diabetes: 'high' }

/** Percent (NGSP) to mmol/mol (IFCC), the unit many labs report. */
export const a1cToMmolMol = (percent: number): number => Math.round((percent - 2.15) * 10.929)

// ---------- Blood pressure ----------

// Malaysian Clinical Practice Guidelines, Management of Hypertension (5th ed., 2018),
// in mmHg. A reading takes the higher band of its two numbers. Low is a common
// reference point (under 90 / 60), not part of the guideline's table.
export type BpBand = 'low' | 'optimal' | 'normal' | 'high_normal' | 'stage1' | 'stage2' | 'stage3'
export const BP_BANDS: { band: BpBand; sys: number; dia: number }[] = [
  // lowest value of each band, from the top
  { band: 'stage3', sys: 180, dia: 110 },
  { band: 'stage2', sys: 160, dia: 100 },
  { band: 'stage1', sys: 140, dia: 90 },
  { band: 'high_normal', sys: 130, dia: 85 },
  { band: 'normal', sys: 120, dia: 80 },
]
export const BP_LOW = { sys: 90, dia: 60 }

export function bpBand(systolic: number, diastolic: number): BpBand {
  for (const b of BP_BANDS) if (systolic >= b.sys || diastolic >= b.dia) return b.band
  if (systolic < BP_LOW.sys || diastolic < BP_LOW.dia) return 'low'
  return 'optimal'
}

/** The colour a band shares with the blood sugar levels. */
export const BP_TONE: Record<BpBand, Level> = {
  low: 'low', optimal: 'in_range', normal: 'in_range', high_normal: 'above', stage1: 'high', stage2: 'high', stage3: 'high',
}
