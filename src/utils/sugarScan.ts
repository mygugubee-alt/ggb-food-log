import type { SugarUnit } from '../models/types'
import { formatMmol } from './units'

export interface SugarScan { text: string; guessedPoint: boolean; converted?: boolean }

/**
 * Finds the blood sugar value in text scanned from a meter screen (iPhone Live Text),
 * returned as text for the value field. Skips the meter's date (29-7) and clock (17:10),
 * fixes common misreads of segment digits, and returns null if nothing fits.
 * In mmol/L a value scanned without its decimal point (59) is read as 5.9, flagged
 * with guessedPoint so the screen can ask the user to check it.
 */
export function parseSugarScan(text: string, unit: SugarUnit): SugarScan | null {
  const fixed = text
    .replace(/\b\d{1,2}\s*:\s*\d{2}\b/g, ' ') // clock 17:10
    .replace(/\b\d{1,2}\s*[-/]\s*\d{1,2}(?:\s*[-/]\s*\d{2,4})?\b/g, ' ') // date 29-7
    .replace(/[0-9OoIl|SBZ.,]+/g, (w) => (/\d/.test(w) ? w.replace(/[Oo]/g, '0').replace(/[Il|]/g, '1').replace(/S/g, '5').replace(/B/g, '8').replace(/Z/g, '2') : w))
    .replace(/(\d),(\d)/g, '$1.$2')
  const tokens = fixed.match(/\d+(?:\.\d+)?/g) ?? []
  if (unit === 'mg_dl') {
    const v = tokens.find((t) => /^\d{2,3}$/.test(t) && Number(t) >= 10 && Number(t) <= 999)
    return v ? { text: v, guessedPoint: false } : null
  }
  const dec = tokens.find((t) => /^\d{1,2}\.\d$/.test(t) && Number(t) > 0 && Number(t) <= 35)
  if (dec) return { text: dec, guessedPoint: false }
  const whole = tokens.find((t) => /^\d{1,3}$/.test(t))
  if (!whole) return null
  if (whole.length === 1) return whole === '0' ? null : { text: whole, guessedPoint: false }
  // 59 → 5.9, 123 → 12.3: the point was lost in the scan.
  const withPoint = `${whole.slice(0, -1)}.${whole.slice(-1)}`
  return Number(withPoint) > 0 && Number(withPoint) <= 35 ? { text: withPoint, guessedPoint: true } : null
}

/**
 * The value field's text from digits read off a meter photo ("5.9", or "59" when the
 * point was not seen). A value with a point is mmol/L; it is converted when the app is
 * set to mg/dL. Returns null when the digits are not a likely reading.
 */
export function meterValue(digits: string, pointSeen: boolean, unit: SugarUnit): SugarScan | null {
  if (pointSeen) {
    const v = Number(digits)
    if (!(v > 0 && v <= 35) || !/^\d{1,2}\.\d$/.test(digits)) return null
    return unit === 'mmol_l' ? { text: digits, guessedPoint: false } : { text: formatMmol(v, 'mg_dl'), guessedPoint: false, converted: true }
  }
  return parseSugarScan(digits, unit)
}
