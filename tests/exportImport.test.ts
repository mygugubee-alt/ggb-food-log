import { beforeEach, describe, expect, it } from 'vitest'
import { strToU8, zipSync } from 'fflate'
import { db } from '../src/db/db'
import { addDayPhotos, clearAllData, getProfilePhoto, getSettings, setProfilePhoto, loadAll, saveMeal, saveReading, setGoal, setSetting, softDelete, updateDay } from '../src/db/repo'
import { buildExportZip, prepareImport, runImport } from '../src/services/exportImport'
import type { NewPhoto } from '../src/models/types'

const bytes = (size: number, seed: number): ArrayBuffer => {
  const u = new Uint8Array(size)
  for (let i = 0; i < size; i++) u[i] = (i * 31 + seed * 17 + (i >> 8)) & 255
  return u.buffer
}
const photo = (seed: number, size = 70_000): NewPhoto => ({ image: bytes(size, seed), thumb: bytes(10, seed), width: 1280, height: 960 })
const thumbStub = async () => new Uint8Array([7, 7]).buffer

async function seed() {
  await updateDay('2026-01-10', { weight_kg: 71.8, calories_kcal: 1800, activity_note: '30 min walk', day_note: '今天吃得不错' })
  await saveMeal({
    date: '2026-01-10', meal_type: 'dinner', time: '19:00', description: '烧鸡、西葫芦', calories_kcal: 650,
    photos: [{ kind: 'new', key: 'a', photo: photo(1) }, { kind: 'new', key: 'b', photo: photo(2, 300_000) }],
  })
  await addDayPhotos('2026-01-10', [photo(3)])
  await saveReading({ date: '2026-01-10', time: '07:05', entered: { value: 126, unit: 'mg_dl' }, context: 'fasting', note: '空腹' })
  await updateDay('2026-01-11', { weight_kg: 71.5 })
  const gone = await saveMeal({ date: '2026-01-11', meal_type: 'snack', time: null, description: 'deleted', calories_kcal: null, photos: [{ kind: 'new', key: 'c', photo: photo(4) }] })
  await softDelete('meal', gone) // waiting for Undo: must not be exported
  await setGoal(62)
  await setGoal(61)
  await setSetting('sugar_unit', 'mg_dl')
  await setProfilePhoto(bytes(5000, 9))
}

const snapshot = async () => {
  const all = await loadAll()
  const dateOf = new Map(all.days.map((d) => [d.id, d.date]))
  return {
    days: all.days.map(({ id: _i, ...d }) => d),
    meals: all.meals.map((m) => ({ date: dateOf.get(m.day_id), type: m.meal_type, time: m.time, text: m.description, kcal: m.calories_kcal })),
    readings: all.readings.map((r) => ({ date: dateOf.get(r.day_id), at: r.measured_at, mmol: r.value_mmol, v: r.entered_value, u: r.entered_unit, c: r.context, n: r.note })),
    photos: all.photos.map((p) => ({ date: dateOf.get(p.day_id), meal: p.meal_id != null, w: p.width, h: p.height, order: p.sort_order })),
    goals: (await db.goalChanges.orderBy('changed_at').toArray()).map((g) => g.dream_weight_kg),
  }
}
const imageSizes = async () => (await db.images.toArray()).map((i) => i.image.byteLength).sort((a, b) => a - b)

beforeEach(async () => { await clearAllData() })

describe('export and import', () => {
  it('a fresh install gets the same days, meals, readings, goal history and photos', async () => {
    await seed()
    const before = await snapshot()
    const zip = await buildExportZip()
    await clearAllData()

    const plan = await prepareImport(zip)
    expect(plan.conflicts).toEqual([])
    expect(plan.data.meals.map((m) => m.description)).toEqual(['烧鸡、西葫芦'])
    const result = await runImport(zip, plan, 'skip', thumbStub)
    expect(result).toEqual({ daysAdded: 2, daysReplaced: 0, daysSkipped: 0, photos: 3 })
    expect(await snapshot()).toEqual(before)
    expect(await imageSizes()).toEqual([70_000, 70_000, 300_000])
    const big = (await db.images.toArray()).find((i) => i.image.byteLength === 300_000)!
    expect(new Uint8Array(big.image)).toEqual(new Uint8Array(bytes(300_000, 2)))
    expect(await db.thumbs.count()).toBe(3)
    expect((await getSettings()).sugar_unit).toBe('mg_dl') // settings come along into an empty install
    expect(new Uint8Array((await getProfilePhoto())!)).toEqual(new Uint8Array(bytes(5000, 9))) // and so does the profile photo
    expect(Object.keys(await getSettings())).not.toContain('profile_photo')
  })

  it('skip leaves existing days alone; replace swaps them without duplicates', async () => {
    await seed()
    const zip = await buildExportZip()
    await updateDay('2026-01-10', { weight_kg: 80 }) // changed on the phone after the export
    await updateDay('2026-01-12', { weight_kg: 70 }) // a day the export does not have
    await setSetting('sugar_unit', 'mmol_l')

    const plan = await prepareImport(zip)
    expect(plan.conflicts).toEqual(['2026-01-10', '2026-01-11'])
    expect(await runImport(zip, plan, 'skip', thumbStub)).toMatchObject({ daysAdded: 0, daysSkipped: 2, photos: 0 })
    expect((await loadAll()).days.find((d) => d.date === '2026-01-10')!.weight_kg).toBe(80)

    expect(await runImport(zip, plan, 'replace', thumbStub)).toMatchObject({ daysAdded: 0, daysReplaced: 2, photos: 3 })
    const all = await loadAll()
    expect(all.days.map((d) => d.date)).toEqual(['2026-01-10', '2026-01-11', '2026-01-12'])
    expect(all.days[0].weight_kg).toBe(71.8)
    expect(all.meals).toHaveLength(1)
    expect(all.photos).toHaveLength(3)
    expect(await db.images.count()).toBe(3)
    expect(await db.goalChanges.count()).toBe(2) // merged by id, not duplicated
    expect((await getSettings()).sugar_unit).toBe('mmol_l') // settings are not overwritten when data exists
    await setProfilePhoto(bytes(10, 1))
    await runImport(zip, plan, 'replace', thumbStub)
    expect((await getProfilePhoto())!.byteLength).toBe(10) // nor is the profile photo
  })

  it('a failed import changes nothing', async () => {
    await seed()
    const zip = await buildExportZip()
    await clearAllData()
    await updateDay('2026-01-10', { weight_kg: 80 })
    const plan = await prepareImport(zip)
    let calls = 0
    const failing = async () => { if (++calls === 2) throw new Error('boom'); return new ArrayBuffer(1) }
    await expect(runImport(zip, plan, 'replace', failing)).rejects.toThrow('boom')
    expect((await loadAll()).days.map((d) => d.weight_kg)).toEqual([80])
    expect(await db.images.count()).toBe(0)
    expect(await db.thumbs.count()).toBe(0)
  })

  it('refuses an export from a newer version and files that are not exports', async () => {
    const newer = new Blob([zipSync({ 'data.json': strToU8(JSON.stringify({ schema_version: 2 })) }) as BlobPart])
    await expect(prepareImport(newer)).rejects.toThrow(/newer version/)
    const other = new Blob([zipSync({ 'notes.txt': strToU8('hello') }) as BlobPart])
    await expect(prepareImport(other)).rejects.toThrow(/data.json is missing/)
    const broken = new Blob([zipSync({ 'data.json': strToU8(JSON.stringify({ schema_version: 1, days: [{ id: 'x', date: 'tomorrow' }] })) }) as BlobPart])
    await expect(prepareImport(broken)).rejects.toThrow(/not a valid/)
    await expect(prepareImport(new Blob(['not a zip at all']))).rejects.toThrow()
  })
})
