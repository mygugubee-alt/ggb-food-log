/** Limits for a typed or scanned blood pressure reading. */
export const BP_LIMITS = { sys: [60, 260], dia: [30, 160], pulse: [30, 220] } as const

const inRange = (v: number, [lo, hi]: readonly [number, number]): boolean => v >= lo && v <= hi

/** A whole number within the limits, or null. */
export function parseBpNumber(text: string, limits: readonly [number, number]): number | null {
  const t = text.trim()
  if (!/^\d{2,3}$/.test(t)) return null
  const v = Number(t)
  return inRange(v, limits) ? v : null
}

export interface BpScan { systolic: number | null; diastolic: number | null; pulse: number | null }

/**
 * Pulls SYS, DIA and pulse out of text scanned from a monitor screen (iPhone Live Text,
 * Google Lens, or typed like "121/84/71"). Fixes common misreads of segment digits,
 * skips clock times (9:49, 10:01 PM) and takes the numbers in order: SYS, DIA, pulse.
 */
export function parseBpScan(text: string): BpScan {
  const fixed = text
    .replace(/\b\d{1,2}[:.]\d{2}\s*(?:[ap]\.?m\.?)?/gi, ' ') // clock times
    // Letter-for-digit fixes only inside words that already have a digit, so "SYS" or "hello" stay words.
    .replace(/[0-9OoIl|SBZ]+/g, (w) => (/\d/.test(w) ? w.replace(/[Oo]/g, '0').replace(/[Il|]/g, '1').replace(/S/g, '5').replace(/B/g, '8').replace(/Z/g, '2') : w))
  // With the screen labels in the text (SYS, DIA, PULSE), take the number after each label,
  // so the smaller PRIOR reading on the same screen is ignored.
  const after = (label: string, limits: readonly [number, number]): number | null => {
    const m = new RegExp(`${label}[^0-9]{0,24}?(\\d{2,3})`, 'i').exec(fixed)
    return m && inRange(Number(m[1]), limits) ? Number(m[1]) : null
  }
  const ls = after('SYS', BP_LIMITS.sys), ld = after('DIA', BP_LIMITS.dia)
  if (ls != null && ld != null && ls > ld) return { systolic: ls, diastolic: ld, pulse: after('PULSE', BP_LIMITS.pulse) }
  // Otherwise take the numbers in order, leaving out the three of the PRIOR reading if it is there.
  const prior = /PRIOR/i.exec(fixed)
  const before = prior ? fixed.slice(0, prior.index) : fixed
  let rest = prior ? fixed.slice(prior.index) : ''
  if (prior) {
    let dropped = 0
    rest = rest.replace(/\d{2,3}/g, (n) => (dropped < 3 && ++dropped ? ' ' : n))
  }
  const nums = (`${before} ${rest}`.match(/\d+/g) ?? []).filter((n) => n.length >= 2 && n.length <= 3).map(Number)
  const out: BpScan = { systolic: null, diastolic: null, pulse: null }
  let i = 0
  const take = (limits: readonly [number, number], ok: (v: number) => boolean = () => true): number | null => {
    while (i < nums.length) {
      const v = nums[i++]
      if (inRange(v, limits) && ok(v)) return v
    }
    return null
  }
  out.systolic = take(BP_LIMITS.sys)
  if (out.systolic != null) out.diastolic = take(BP_LIMITS.dia, (v) => v < out.systolic!)
  if (out.diastolic != null) out.pulse = take(BP_LIMITS.pulse)
  return out
}
