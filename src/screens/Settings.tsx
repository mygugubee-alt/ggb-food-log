import { useEffect, useState, type ChangeEvent } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { clearAllData, getProfilePhoto, hasAnyData, setProfilePhoto, setSetting } from '../db/repo'
import { buildExportZip, exportFileName, prepareImport, runImport } from '../services/exportImport'
import { makeAvatar, makeThumb } from '../services/photos'
import { S } from '../strings/en'
import { THEMES } from '../theme/themes'
import { formatDateTime } from '../utils/dates'
import { fromMmol, parseHeight, parseKcalTarget, parseSugarInput, toMmol, unitLabel } from '../utils/units'
import type { RangeMode, SugarUnit } from '../models/types'
import { useExportDue, useSettings } from '../components/hooks'
import { Avatar } from '../components/photos'
import { Chips, Page, useUI } from '../components/ui'

declare const __APP_VERSION__: string
const mb = (bytes: number): string => (bytes / (1024 * 1024)).toFixed(1)

function download(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

/** One of the user's own targets. Shown and typed in the display unit, stored in mmol/L. */
function TargetField({ label, mmol, unit, onSave }: { label: string; mmol: number; unit: SugarUnit; onSave: (mmol: number) => void }) {
  const shown = unit === 'mmol_l' ? fromMmol(mmol, unit).toFixed(1) : String(fromMmol(mmol, unit))
  const [text, setText] = useState(shown)
  const [bad, setBad] = useState(false)
  useEffect(() => { setText(shown); setBad(false) }, [shown])
  const commit = () => {
    if (text.trim() === shown) return
    const v = parseSugarInput(text, unit)
    const m = v == null ? null : toMmol(v, unit)
    if (m == null || m < 4 || m > 30) { setBad(true); return }
    setBad(false)
    onSave(m)
  }
  return (
    <label className="field grow">
      <span className="label">{label}</span>
      <div className="input-row">
        <input className="input" inputMode="decimal" autoComplete="off" aria-invalid={bad} value={text}
          onChange={(e) => setText(e.target.value)} onBlur={commit} />
        <span className="sub" style={{ whiteSpace: 'nowrap' }}>{unitLabel(unit)}</span>
      </div>
    </label>
  )
}

/** Height for BMI. Saves when the field loses focus; an empty field clears it. */
function HeightField({ cm }: { cm: number | null }) {
  const shown = cm == null ? '' : String(cm)
  const [text, setText] = useState(shown)
  const [bad, setBad] = useState(false)
  useEffect(() => { setText(shown); setBad(false) }, [shown])
  const commit = () => {
    if (text.trim() === shown) { setBad(false); return }
    if (text.trim() === '') { setBad(false); void setSetting('height_cm', null); return }
    const v = parseHeight(text)
    if (v == null) { setBad(true); return }
    setBad(false)
    void setSetting('height_cm', v)
  }
  return (
    <div className="field">
      <label htmlFor="height"><span className="label">{S.heightField}</span></label>
      <input id="height" className="input" inputMode="decimal" autoComplete="off" placeholder="160" aria-invalid={bad} value={text}
        onChange={(e) => setText(e.target.value)} onBlur={commit} onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }} />
      {bad ? <div className="error" role="alert">{S.heightError}</div> : <span className="muted">{S.heightNote} {S.bmiScaleNote}</span>}
    </div>
  )
}

/** Daily calorie goal. Saves on blur; empty clears it. */
function KcalTargetField({ kcal }: { kcal: number | null }) {
  const shown = kcal == null ? '' : String(kcal)
  const [text, setText] = useState(shown)
  const [bad, setBad] = useState(false)
  useEffect(() => { setText(shown); setBad(false) }, [shown])
  const commit = () => {
    if (text.trim() === shown) { setBad(false); return }
    if (text.trim() === '') { setBad(false); void setSetting('kcal_target', null); return }
    const v = parseKcalTarget(text)
    if (v == null) { setBad(true); return }
    setBad(false)
    void setSetting('kcal_target', v)
  }
  return (
    <div className="field">
      <label htmlFor="kcal-target"><span className="label">{S.kcalTargetField}</span></label>
      <input id="kcal-target" className="input" inputMode="numeric" autoComplete="off" placeholder="1500" aria-invalid={bad} value={text}
        onChange={(e) => setText(e.target.value)} onBlur={commit} onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }} />
      {bad ? <div className="error" role="alert">{S.kcalTargetError}</div> : <span className="muted">{S.kcalTargetNote}</span>}
    </div>
  )
}

function useStorageInfo(refresh: number) {
  const [info, setInfo] = useState<{ used: number | null; kept: boolean | null }>({ used: null, kept: null })
  useEffect(() => {
    void (async () => {
      const used = (await navigator.storage?.estimate?.())?.usage ?? null
      const kept = (await navigator.storage?.persisted?.()) ?? null
      setInfo({ used, kept })
    })()
  }, [refresh])
  return info
}

export default function Settings() {
  const ui = useUI()
  const settings = useSettings()
  const { due, days } = useExportDue()
  const [refresh, setRefresh] = useState(0)
  const storage = useStorageInfo(refresh)

  const doExport = async () => {
    if (!(await hasAnyData())) { await ui.alert(S.nothingToExport); return }
    if (!(await ui.confirm(S.exportWarning, S.exportContinue))) return
    const blob = await ui.run(buildExportZip, S.exporting)
    if (!blob) return
    // A second tap, so the share sheet opens straight from a touch.
    if (!(await ui.confirm(S.exportReady(mb(blob.size)), S.exportSave))) return
    const name = exportFileName()
    const file = new File([blob], name, { type: 'application/zip' })
    let handed = false
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: name })
        handed = true
      } catch (e) {
        if ((e as { name?: string }).name === 'AbortError') return // the share sheet was closed
      }
    }
    if (!handed) download(blob, name)
    await setSetting('last_export_at', new Date().toISOString())
    ui.toast(S.exportDone)
  }

  const doImport = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const plan = await ui.run(() => prepareImport(file), S.importReading)
    if (!plan) return
    let mode: 'skip' | 'replace' | null
    if (plan.conflicts.length === 0) {
      mode = (await ui.confirm(S.importNew(plan.data.days.length), S.importGo)) ? 'skip' : null
    } else {
      mode = await ui.choose<'skip' | 'replace'>(S.importConflict(plan.conflicts.length, plan.newDays), [
        { label: S.importSkip, value: 'skip', kind: 'primary' },
        { label: S.importReplace, value: 'replace', kind: 'danger' },
      ])
    }
    if (!mode) return
    const chosen = mode
    const result = await ui.run(() => runImport(file, plan, chosen, makeThumb), S.importing)
    setRefresh((n) => n + 1)
    if (result) await ui.alert(S.importDone(result))
  }

  const hasPhoto = !!useLiveQuery(getProfilePhoto)
  const pickProfile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const done = await ui.run(async () => { await setProfilePhoto(await makeAvatar(file)); return true }, S.processingPhotos)
    if (done) ui.toast(S.profileSaved)
  }
  const removeProfile = async () => {
    if (await ui.confirm(S.confirmRemoveProfilePhoto, S.remove, true)) await ui.run(() => setProfilePhoto(null))
  }

  const clearAll = async () => {
    if (!(await ui.confirm(S.clearAll1, S.clearAllYes, true))) return
    if (!(await ui.confirm(S.clearAll2, S.clearAllFinal, true))) return
    await ui.run(async () => {
      await clearAllData()
      await setSetting('first_use_at', new Date().toISOString())
    })
    setRefresh((n) => n + 1)
    ui.toast(S.cleared)
  }

  return (
    <Page title={S.tabs.settings} tabs>
      <div className="card stack">
        <h2 style={{ marginBottom: 0 }}>{S.profile}</h2>
        <div className="row" style={{ gap: 16 }}>
          <Avatar large />
          <div className="grow stack" style={{ gap: 8 }}>
            <label className="btn">
              <input className="sr-only" type="file" accept="image/*" onChange={(e) => { void pickProfile(e) }} />
              {hasPhoto ? S.changePhoto : S.choosePhoto}
            </label>
            {hasPhoto && <button className="btn danger" onClick={() => { void removeProfile() }}>{S.removeProfilePhoto}</button>}
          </div>
        </div>
        <p className="muted">{S.profileNote}</p>
      </div>

      <div className="card stack">
        <h2 style={{ marginBottom: 0 }}>{S.colour}</h2>
        <div className="swatches" role="group" aria-label={S.colour}>
          {THEMES.map((t) => (
            <button key={t.id} type="button" className="swatch" style={{ background: t.swatch }} aria-label={t.label}
              aria-pressed={settings.theme === t.id} onClick={() => { void setSetting('theme', t.id) }} />
          ))}
        </div>
        <p><strong>{THEMES.find((t) => t.id === settings.theme)?.label}</strong></p>
        <p className="muted">{S.colourNote}</p>
      </div>

      <div className="card stack">
        <h2 style={{ marginBottom: 0 }}>{S.body}</h2>
        <HeightField cm={settings.height_cm} />
        <KcalTargetField kcal={settings.kcal_target} />
      </div>

      <div className="card stack">
        <h2 style={{ marginBottom: 0 }}>{S.units}</h2>
        <div className="spread"><span>{S.weightUnit}</span><strong>{S.weightUnitFixed}</strong></div>
        <div className="field">
          <span className="label">{S.sugarUnit}</span>
          <Chips label={S.sugarUnit} value={settings.sugar_unit} onChange={(v) => { void setSetting('sugar_unit', v) }}
            options={[{ value: 'mmol_l', label: S.unitName.mmol_l }, { value: 'mg_dl', label: S.unitName.mg_dl }]} />
        </div>
        <div className="field">
          <span className="label">{S.weekStartsOn}</span>
          <Chips label={S.weekStartsOn} value={String(settings.week_start) as '0' | '1'} onChange={(v) => { void setSetting('week_start', v === '0' ? 0 : 1) }}
            options={[{ value: '1', label: S.monday }, { value: '0', label: S.sunday }]} />
        </div>
        <label className="row" style={{ minHeight: 44 }}>
          <input type="checkbox" style={{ width: 22, height: 22 }} checked={settings.hide_sugar} onChange={(e) => { void setSetting('hide_sugar', e.target.checked) }} />
          <span className="grow">{S.hideSugar}<br /><span className="muted">{S.hideSugarNote}</span></span>
        </label>
      </div>

      <div className="card stack">
        <h2 style={{ marginBottom: 0 }}>{S.rangeSettings.title}</h2>
        <Chips<RangeMode> label={S.rangeSettings.title} value={settings.range_mode} onChange={(v) => { void setSetting('range_mode', v) }}
          options={[
            { value: 'general', label: S.rangeSettings.general },
            { value: 'diabetes', label: S.rangeSettings.diabetes },
            { value: 'custom', label: S.rangeSettings.custom },
            { value: 'off', label: S.rangeSettings.off },
          ]} />
        <p className="sub">{S.rangeSettings.explain[settings.range_mode]}</p>
        {settings.range_mode === 'custom' && (
          <div className="actions">
            <TargetField label={S.rangeSettings.beforeMax} mmol={settings.custom_before_max} unit={settings.sugar_unit} onSave={(m) => { void setSetting('custom_before_max', m) }} />
            <TargetField label={S.rangeSettings.afterMax} mmol={settings.custom_after_max} unit={settings.sugar_unit} onSave={(m) => { void setSetting('custom_after_max', m) }} />
          </div>
        )}
        <Link to="/ranges" className="btn">{S.ranges.link}</Link>
        <Link to="/a1c" className="btn">{S.a1c.title}</Link>
      </div>

      <div className="card stack">
        <h2 style={{ marginBottom: 0 }}>{S.backup}</h2>
        {due && <div className="banner">{S.exportDue(days)}</div>}
        <p className="sub">{settings.last_export_at ? S.lastExport(formatDateTime(settings.last_export_at)) : S.neverExported}</p>
        <button className="btn primary" onClick={() => { void doExport() }}>{S.exportData}</button>
        <label className="btn">
          <input className="sr-only" type="file" accept=".zip,application/zip" onChange={(e) => { void doImport(e) }} />
          {S.importData}
        </label>
        <p className="muted">{S.storageRisk}</p>
      </div>

      <div className="card stack">
        <h2 style={{ marginBottom: 0 }}>{S.storage}</h2>
        {storage.used != null && <p>{S.storageUsed(mb(storage.used))}</p>}
        {storage.kept != null && <p className="sub">{storage.kept ? S.storageKept : S.storageNotKept}</p>}
        <button className="btn danger" onClick={() => { void clearAll() }}>{S.clearAll}</button>
      </div>

      <div className="card stack">
        <h2 style={{ marginBottom: 0 }}>{S.about}</h2>
        <p>{S.appName} · {S.version(__APP_VERSION__)}</p>
        <p className="sub">{S.privacy}</p>
        <p><strong>{S.medical}</strong></p>
      </div>
    </Page>
  )
}
