import { describe, expect, it } from 'vitest'
import { checkSugar, displayReading, formatMmol, parseCalories, parseSugarInput, parseWeight, roundTo, toMmol } from '../src/utils/units'

const reading = (value: number, unit: 'mmol_l' | 'mg_dl') => ({ entered_value: value, entered_unit: unit, value_mmol: toMmol(value, unit) })

describe('rounding', () => {
  it('rounds halves away from zero', () => {
    expect(roundTo(0.15, 1)).toBe(0.2)
    expect(roundTo(1.005, 2)).toBe(1.01)
    expect(roundTo(-0.25, 1)).toBe(-0.3)
    expect(roundTo(2.5, 0)).toBe(3)
    expect(roundTo(71.84, 1)).toBe(71.8)
  })
})

describe('blood sugar units', () => {
  it('7.0 mmol/L shows as 126 mg/dL and as 7.0 again', () => {
    const r = reading(7.0, 'mmol_l')
    expect(displayReading(r, 'mg_dl')).toBe('126')
    expect(displayReading(r, 'mmol_l')).toBe('7.0')
  })
  it('126 mg/dL shows as 7.0 mmol/L and as 126 again', () => {
    const r = reading(126, 'mg_dl')
    expect(displayReading(r, 'mmol_l')).toBe('7.0')
    expect(displayReading(r, 'mg_dl')).toBe('126')
  })
  it('every whole mg/dL value survives a round trip in its own unit', () => {
    for (let v = 1; v <= 1080; v++) expect(displayReading(reading(v, 'mg_dl'), 'mg_dl')).toBe(String(v))
  })
  it('every 0.1 mmol/L value survives a round trip in its own unit', () => {
    for (let i = 1; i <= 600; i++) {
      const v = i / 10
      expect(displayReading(reading(v, 'mmol_l'), 'mmol_l')).toBe(v.toFixed(1))
    }
  })
  it('stores mg/dL entries at full precision', () => {
    expect(toMmol(126, 'mg_dl')).toBeCloseTo(6.993783, 5)
    expect(formatMmol(5.55, 'mg_dl')).toBe('100')
  })
  it('accepts the right input form for each unit', () => {
    expect(parseSugarInput('7.0', 'mmol_l')).toBe(7)
    expect(parseSugarInput('7,5', 'mmol_l')).toBe(7.5)
    expect(parseSugarInput('7.25', 'mmol_l')).toBeNull()
    expect(parseSugarInput('126', 'mg_dl')).toBe(126)
    expect(parseSugarInput('126.5', 'mg_dl')).toBeNull()
    expect(parseSugarInput('abc', 'mmol_l')).toBeNull()
  })
  it('rejects typing errors and asks about unusual values', () => {
    expect(checkSugar(0)).toBe('reject')
    expect(checkSugar(70)).toBe('reject')
    expect(checkSugar(0.8)).toBe('confirm')
    expect(checkSugar(31)).toBe('confirm')
    expect(checkSugar(1.0)).toBe('ok')
    expect(checkSugar(30.0)).toBe('ok')
    expect(checkSugar(toMmol(18, 'mg_dl'))).toBe('ok')
    expect(checkSugar(toMmol(540, 'mg_dl'))).toBe('ok')
    expect(checkSugar(toMmol(1080, 'mg_dl'))).toBe('confirm')
  })
})

describe('weight and calories input', () => {
  it('weight is 20.0 to 300.0 with one decimal place', () => {
    expect(parseWeight('71.8')).toBe(71.8)
    expect(parseWeight('71,8')).toBe(71.8)
    expect(parseWeight('300')).toBe(300)
    expect(parseWeight('19.9')).toBeNull()
    expect(parseWeight('300.1')).toBeNull()
    expect(parseWeight('71.85')).toBeNull()
  })
  it('calories are whole numbers 0 to 10000', () => {
    expect(parseCalories('1450')).toBe(1450)
    expect(parseCalories('0')).toBe(0)
    expect(parseCalories('10001')).toBeNull()
    expect(parseCalories('12.5')).toBeNull()
  })
})
