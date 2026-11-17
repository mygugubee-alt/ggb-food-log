import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../src/db/db'
import { clearAllData, getSettings, listA1c, purge, restore, saveA1c, setSetting, softDelete } from '../src/db/repo'
import { buildExportZip, prepareImport, runImport } from '../src/services/exportImport'
import { addDays, todayKL } from '../src/utils/dates'
import { parseA1c } from '../src/utils/units'
import { a1cBand, a1cToMmolMol } from '../src/services/ranges'

beforeEach(async () => { await clearAllData() })
const thumbStub = async () => new ArrayBuffer(1)

describe('HbA1c bands', () => {
  it('below 5.7 normal, 5.7 to 6.4 prediabetes, 6.5 or higher diabetes', () => {
    expect(a1cBand(5.6)).toBe('normal')
    expect(a1cBand(5.7)).toBe('prediabetes')
    expect(a1cBand(6.4)).toBe('prediabetes')
    expect(a1cBand(6.5)).toBe('diabetes')
    expect(a1cBand(9.2)).toBe('diabetes')
  })
  it('converts percent to mmol/mol on the same cut-offs', () => {
    expect(a1cToMmolMol(5.7)).toBe(39)
    expect(a1cToMmolMol(6.5)).toBe(48)
    expect(a1cToMmolMol(6.4)).toBe(46)
    expect(a1cToMmolMol(7.0)).toBe(53)
  })
})

describe('HbA1c results', () => {
  it('accepts 3.0 to 20.0 with one decimal place', () => {
    expect(parseA1c('6.5')).toBe(6.5)
    expect(parseA1c('6,5')).toBe(6.5)
    expect(parseA1c('7')).toBe(7)
    expect(parseA1c('2.9')).toBeNull()
    expect(parseA1c('20.1')).toBeNull()
    expect(parseA1c('6.55')).toBeNull()
  })
  it('keeps the value and the test date, newest test first', async () => {
    await saveA1c({ test_date: '2026-05-02', value_percent: 7.1, note: '' })
    const id = await saveA1c({ test_date: '2026-08-10', value_percent: 6.6, note: 'Klinik' })
    await saveA1c({ id, test_date: '2026-08-11', value_percent: 6.5, note: 'Klinik' })
    expect((await listA1c()).map((r) => [r.test_date, r.value_percent, r.note])).toEqual([['2026-08-11', 6.5, 'Klinik'], ['2026-05-02', 7.1, '']])
  })
  it('refuses a test date in the future', async () => {
    await expect(saveA1c({ test_date: addDays(todayKL(), 1), value_percent: 6.5, note: '' })).rejects.toThrow()
    expect(await db.a1c.count()).toBe(0)
  })
  it('delete can be undone, and is final once purged', async () => {
    const id = await saveA1c({ test_date: '2026-05-02', value_percent: 7.1, note: '' })
    let stamp = await softDelete('a1c', id)
    expect(await listA1c()).toHaveLength(0)
    await restore(stamp)
    expect(await listA1c()).toHaveLength(1)
    stamp = await softDelete('a1c', id)
    await purge(stamp)
    expect(await db.a1c.count()).toBe(0)
  })
  it('is exported and imported, without duplicates, along with the range settings', async () => {
    await saveA1c({ test_date: '2026-05-02', value_percent: 7.1, note: 'first' })
    await saveA1c({ test_date: '2026-08-10', value_percent: 6.6, note: '' })
    await setSetting('range_mode', 'custom')
    await setSetting('custom_before_max', 6.5)
    const zip = await buildExportZip()
    await clearAllData()
    const plan = await prepareImport(zip)
    await runImport(zip, plan, 'skip', thumbStub)
    expect((await listA1c()).map((r) => [r.test_date, r.value_percent, r.note])).toEqual([['2026-08-10', 6.6, ''], ['2026-05-02', 7.1, 'first']])
    expect(await getSettings()).toMatchObject({ range_mode: 'custom', custom_before_max: 6.5, custom_after_max: 10 })
    await runImport(zip, await prepareImport(zip), 'replace', thumbStub)
    expect(await listA1c()).toHaveLength(2)
  })
})
