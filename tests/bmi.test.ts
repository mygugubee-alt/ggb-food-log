import { describe, expect, it } from 'vitest'
import { bmi, bmiBand, bmiPosition, weightForBmi } from '../src/services/bmi'

describe('bmi', () => {
  it('computes kg / m² to one decimal', () => {
    expect(bmi(70.7, 160)).toBe(27.6)
    expect(bmi(68, 165)).toBe(25)
  })
  it('uses Malaysian adult cut-offs', () => {
    expect(bmiBand(18.4)).toBe('under')
    expect(bmiBand(18.5)).toBe('healthy')
    expect(bmiBand(22.9)).toBe('healthy')
    expect(bmiBand(23)).toBe('over')
    expect(bmiBand(27.4)).toBe('over')
    expect(bmiBand(27.5)).toBe('obese')
  })
  it('finds the weight for a BMI', () => {
    expect(weightForBmi(23, 160)).toBe(58.9)
  })
})

import { parseHeight } from '../src/utils/units'
describe('parseHeight', () => {
  it('accepts 100–250 with one decimal', () => {
    expect(parseHeight('160')).toBe(160)
    expect(parseHeight('158,5')).toBe(158.5)
    expect(parseHeight('99')).toBeNull()
    expect(parseHeight('251')).toBeNull()
    expect(parseHeight('160.25')).toBeNull()
  })
})

describe('bmiPosition', () => {
  it('gives each band a quarter of the bar', () => {
    expect(bmiPosition(10)).toBe(0)
    expect(bmiPosition(18.5)).toBe(0.25)
    expect(bmiPosition(23)).toBe(0.5)
    expect(bmiPosition(25.25)).toBe(0.625)
    expect(bmiPosition(27.5)).toBe(0.75)
    expect(bmiPosition(40)).toBe(1)
  })
})
