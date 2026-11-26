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
