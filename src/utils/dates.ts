// All calendar dates and displayed times use Asia/Kuala_Lumpur, which is a fixed
// UTC+8 with no daylight saving, so a constant offset is exact.
const OFFSET_MS = 8 * 60 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
export const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
export const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/** Malaysia date and time of a UTC instant. */
export function klParts(instant: Date | string): { date: string; time: string } {
  const shifted = new Date(new Date(instant).getTime() + OFFSET_MS).toISOString()
  return { date: shifted.slice(0, 10), time: shifted.slice(11, 16) }
}
export const todayKL = (): string => klParts(new Date()).date
export const nowTimeKL = (): string => klParts(new Date()).time

/** UTC timestamp for a Malaysia date and HH:mm time. */
export function klToUtcIso(date: string, time: string): string {
  return new Date(Date.parse(`${date}T${time}:00.000Z`) - OFFSET_MS).toISOString()
}

export function isValidDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false
  const t = Date.parse(`${s}T00:00:00Z`)
  return !Number.isNaN(t) && new Date(t).toISOString().slice(0, 10) === s
}
export const isValidTime = (s: string): boolean => /^([01]\d|2[0-3]):[0-5]\d$/.test(s)

export function addDays(date: string, n: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10)
}
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS)
}
/** 0 = Sunday ... 6 = Saturday */
export const weekday = (date: string): number => new Date(`${date}T00:00:00Z`).getUTCDay()

export function weekStartOf(date: string, startsOn: 0 | 1): string {
  return addDays(date, -((weekday(date) - startsOn + 7) % 7))
}
export const weekDates = (start: string): string[] => Array.from({ length: 7 }, (_, i) => addDays(start, i))

/** 14 Nov 2026 */
export function formatDate(date: string): string {
  const [y, m, d] = date.split('-')
  return `${d} ${MONTHS[Number(m) - 1]} ${y}`
}
/** 14 Nov */
export function formatShort(date: string): string {
  const [, m, d] = date.split('-')
  return `${Number(d)} ${MONTHS[Number(m) - 1]}`
}
export const formatWeekday = (date: string): string => WEEKDAYS[weekday(date)]
export function formatDateTime(instant: string): string {
  const p = klParts(instant)
  return `${formatDate(p.date)}, ${p.time}`
}
