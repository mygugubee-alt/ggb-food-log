import { describe, expect, it } from 'vitest'
import { parseSugarScan } from '../src/utils/sugarScan'

describe('reading a scanned blood sugar meter', () => {
  it('finds the value on an Ottai screen, skipping date and time', () => {
    expect(parseSugarScan('29- 7 17:10\nd m\n5.9\nmmol/L', 'mmol_l')).toEqual({ text: '5.9', guessedPoint: false })
    expect(parseSugarScan('5.9', 'mmol_l')).toEqual({ text: '5.9', guessedPoint: false })
    expect(parseSugarScan('12,4 mmol', 'mmol_l')).toEqual({ text: '12.4', guessedPoint: false })
  })
  it('puts back a lost decimal point and flags it', () => {
    expect(parseSugarScan('29-7 17:10 59', 'mmol_l')).toEqual({ text: '5.9', guessedPoint: true })
    expect(parseSugarScan('124', 'mmol_l')).toEqual({ text: '12.4', guessedPoint: true })
    expect(parseSugarScan('6', 'mmol_l')).toEqual({ text: '6', guessedPoint: false })
  })
  it('fixes segment misreads', () => {
    expect(parseSugarScan('S.9', 'mmol_l')).toEqual({ text: '5.9', guessedPoint: false })
    expect(parseSugarScan('I0.2', 'mmol_l')).toEqual({ text: '10.2', guessedPoint: false })
  })
  it('reads mg/dL as a whole number', () => {
    expect(parseSugarScan('29-7 17:10 106 mg/dL', 'mg_dl')).toEqual({ text: '106', guessedPoint: false })
  })
  it('returns null when nothing fits', () => {
    expect(parseSugarScan('Ottai', 'mmol_l')).toBeNull()
    expect(parseSugarScan('29-7 17:10', 'mmol_l')).toBeNull()
  })
})
