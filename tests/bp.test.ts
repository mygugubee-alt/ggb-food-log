import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../src/db/db'
import { getDay, loadDayBundle, purge, restore, saveBp, softDelete } from '../src/db/repo'
import { parseBpNumber, parseBpScan } from '../src/utils/bp'
import { collectExportData, validateExport } from '../src/services/exportImport'

describe('reading a scanned monitor screen', () => {
  it('takes SYS, DIA and pulse in order', () => {
    expect(parseBpScan('121\n84\n71')).toEqual({ systolic: 121, diastolic: 84, pulse: 71 })
    expect(parseBpScan('121/84 71')).toEqual({ systolic: 121, diastolic: 84, pulse: 71 })
  })
  it('skips clock times and labels', () => {
    expect(parseBpScan('10:01 PM SYS mmHg 121 DIA mmHg 84 PULSE /min 71')).toEqual({ systolic: 121, diastolic: 84, pulse: 71 })
  })
  it('ignores the PRIOR reading when the labels are there', () => {
    expect(parseBpScan('OMRON PRIOR 9:49 PM 116 74 72 SYS mmHg 121 10:01 PM DIA mmHg 84 PULSE /min 71'))
      .toEqual({ systolic: 121, diastolic: 84, pulse: 71 })
    expect(parseBpScan('PRIOR 9:49PM\n116\n74\n72\nSYS\nmmHg\nDIA\nmmHg\nPULSE /min\n121\n84\n71'))
      .toEqual({ systolic: 121, diastolic: 84, pulse: 71 })
  })
  it('fixes common misreads of segment digits', () => {
    expect(parseBpScan('I2I 84 7I')).toEqual({ systolic: 121, diastolic: 84, pulse: 71 })
  })
  it('leaves out what it cannot find', () => {
    expect(parseBpScan('hello')).toEqual({ systolic: null, diastolic: null, pulse: null })
    expect(parseBpScan('121 84')).toEqual({ systolic: 121, diastolic: 84, pulse: null })
  })
  it('checks typed numbers', () => {
    expect(parseBpNumber('121', [60, 260])).toBe(121)
    expect(parseBpNumber('12', [60, 260])).toBeNull()
    expect(parseBpNumber('12.5', [60, 260])).toBeNull()
  })
})

const D = '2026-11-10'
describe('blood pressure readings', () => {
  beforeEach(async () => { await Promise.all(db.tables.map((t) => t.clear())) })
  it('saves, lists in time order, and joins the export', async () => {
    await saveBp({ date: D, time: '21:49', systolic: 116, diastolic: 74, pulse: 72 })
    await saveBp({ date: D, time: '08:05', systolic: 121, diastolic: 84, pulse: null })
    const b = await loadDayBundle(D)
    expect(b.bp.map((r) => r.systolic)).toEqual([121, 116])
    const data = await collectExportData()
    expect(data.bp_readings).toHaveLength(2)
    expect(() => validateExport(JSON.parse(JSON.stringify(data)))).not.toThrow()
  })
  it('delete can be undone, and removing the last one removes the empty day', async () => {
    const id = await saveBp({ date: D, time: '08:00', systolic: 121, diastolic: 84, pulse: 71 })
    let stamp = await softDelete('bp', id)
    expect((await loadDayBundle(D)).bp).toHaveLength(0)
    await restore(stamp)
    expect((await loadDayBundle(D)).bp).toHaveLength(1)
    stamp = await softDelete('bp', id)
    await purge(stamp)
    expect(await db.bp.count()).toBe(0)
    expect(await getDay(D)).toBeNull()
  })
  it('moving a reading to another date tidies the old day', async () => {
    const id = await saveBp({ date: D, time: '08:00', systolic: 121, diastolic: 84, pulse: 71 })
    await saveBp({ id, date: '2026-11-09', time: '08:00', systolic: 121, diastolic: 84, pulse: 71 })
    expect(await getDay(D)).toBeNull()
    expect((await loadDayBundle('2026-11-09')).bp).toHaveLength(1)
  })
})
