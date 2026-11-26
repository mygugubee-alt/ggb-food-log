import { describe, expect, it } from 'vitest'
import { classify } from '../src/services/ranges'
import { toMmol } from '../src/utils/units'

const own = { before_max: 6.5, after_max: 9.0 }
const general = (v: number, c: Parameters<typeof classify>[1]) => classify(v, c, 'general', own)
const mg = (v: number) => toMmol(v, 'mg_dl')

describe('blood sugar ranges', () => {
  it('off gives no label', () => {
    expect(classify(2.0, 'fasting', 'off', own)).toBeNull()
    expect(classify(20, 'after_meal', 'off', own)).toBeNull()
  })
  it('low and very low apply to every kind of reading', () => {
    for (const c of ['fasting', 'before_meal', 'after_meal', 'bedtime', 'other', null] as const) {
      expect(general(3.8, c)).toBe('low')
      expect(general(2.9, c)).toBe('very_low')
      expect(classify(3.8, c, 'diabetes', own)).toBe('low')
    }
    expect(general(3.9, 'fasting')).toBe('in_range')
    expect(general(3.0, 'fasting')).toBe('low')
  })
  it('general: fasting under 5.6, 5.6 to 6.9, 7.0 or higher', () => {
    expect(general(5.5, 'fasting')).toBe('in_range')
    expect(general(5.6, 'fasting')).toBe('above')
    expect(general(6.9, 'fasting')).toBe('above')
    expect(general(7.0, 'fasting')).toBe('high')
  })
  it('general: after eating under 7.8, 7.8 to 11.0, 11.1 or higher', () => {
    expect(general(7.7, 'after_meal')).toBe('in_range')
    expect(general(7.8, 'after_meal')).toBe('above')
    expect(general(11.0, 'after_meal')).toBe('above')
    expect(general(11.1, 'after_meal')).toBe('high')
  })
  it('general: other readings are only marked when low or 11.1 and above', () => {
    for (const c of ['before_meal', 'bedtime', 'other', null] as const) {
      expect(general(6.5, c)).toBeNull()
      expect(general(11.0, c)).toBeNull()
      expect(general(11.1, c)).toBe('high')
    }
  })
  it('mg/dL readings land on the matching thresholds', () => {
    expect(general(mg(99), 'fasting')).toBe('in_range')
    expect(general(mg(100), 'fasting')).toBe('above')
    expect(general(mg(125), 'fasting')).toBe('above')
    expect(general(mg(126), 'fasting')).toBe('high')
    expect(general(mg(139), 'after_meal')).toBe('in_range')
    expect(general(mg(140), 'after_meal')).toBe('above')
    expect(general(mg(200), 'after_meal')).toBe('high')
    expect(general(mg(70), null)).toBeNull()
    expect(general(mg(69), null)).toBe('low')
    expect(general(mg(53), null)).toBe('very_low')
  })
  it('diabetes targets: up to 7.0 before meals, under 10.0 after eating', () => {
    const d = (v: number, c: Parameters<typeof classify>[1]) => classify(v, c, 'diabetes', own)
    expect(d(7.0, 'fasting')).toBe('in_range')
    expect(d(7.1, 'fasting')).toBe('above')
    expect(d(7.0, 'before_meal')).toBe('in_range')
    expect(d(7.1, 'before_meal')).toBe('above')
    expect(d(9.9, 'after_meal')).toBe('in_range')
    expect(d(10.0, 'after_meal')).toBe('above')
    expect(d(15, 'bedtime')).toBeNull()
    expect(d(15, null)).toBeNull()
  })
  it('own targets are used in custom mode', () => {
    expect(classify(6.5, 'fasting', 'custom', own)).toBe('in_range')
    expect(classify(6.6, 'fasting', 'custom', own)).toBe('above')
    expect(classify(8.9, 'after_meal', 'custom', own)).toBe('in_range')
    expect(classify(9.0, 'after_meal', 'custom', own)).toBe('above')
  })
})

import { bpBand } from '../src/services/ranges'
describe('blood pressure bands (Malaysian CPG 2018)', () => {
  it('uses the higher band of the two numbers', () => {
    expect(bpBand(115, 75)).toBe('optimal')
    expect(bpBand(121, 84)).toBe('normal')
    expect(bpBand(118, 85)).toBe('high_normal')
    expect(bpBand(139, 70)).toBe('high_normal')
    expect(bpBand(140, 80)).toBe('stage1')
    expect(bpBand(125, 100)).toBe('stage2')
    expect(bpBand(180, 90)).toBe('stage3')
  })
  it('flags low readings', () => {
    expect(bpBand(88, 58)).toBe('low')
    expect(bpBand(95, 58)).toBe('low')
    expect(bpBand(90, 60)).toBe('optimal')
  })
})
