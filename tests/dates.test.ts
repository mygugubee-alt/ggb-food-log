import { describe, expect, it } from 'vitest'
import { addDays, formatDate, formatShort, isValidDate, klParts, klToUtcIso, weekDates, weekStartOf } from '../src/utils/dates'

describe('Malaysia dates', () => {
  it('a reading at 00:30 Malaysia time belongs to the new day', () => {
    const utc = klToUtcIso('2026-11-15', '00:30')
    expect(utc).toBe('2026-11-14T16:30:00.000Z')
    expect(klParts(utc)).toEqual({ date: '2026-11-15', time: '00:30' })
  })
  it('23:59 stays on its own day', () => {
    expect(klParts(klToUtcIso('2026-11-14', '23:59')).date).toBe('2026-11-14')
  })
  it('formats dates as DD MMM YYYY', () => {
    expect(formatDate('2026-11-14')).toBe('14 Nov 2026')
    expect(formatDate('2026-03-05')).toBe('05 Mar 2026')
    expect(formatShort('2026-03-05')).toBe('5 Mar')
  })
  it('adds days across months and years', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
  })
  it('finds the start of the week for Monday and Sunday starts', () => {
    // 14 Nov 2026 is a Saturday
    expect(weekStartOf('2026-11-14', 1)).toBe('2026-11-09')
    expect(weekStartOf('2026-11-14', 0)).toBe('2026-11-08')
    expect(weekStartOf('2026-11-09', 1)).toBe('2026-11-09')
    expect(weekStartOf('2026-11-15', 1)).toBe('2026-11-09')
    expect(weekStartOf('2026-11-15', 0)).toBe('2026-11-15')
    expect(weekDates('2026-11-09')).toHaveLength(7)
    expect(weekDates('2026-11-09')[6]).toBe('2026-11-15')
  })
  it('checks date text', () => {
    expect(isValidDate('2026-11-14')).toBe(true)
    expect(isValidDate('2026-02-30')).toBe(false)
    expect(isValidDate('14 Nov')).toBe(false)
  })
})
