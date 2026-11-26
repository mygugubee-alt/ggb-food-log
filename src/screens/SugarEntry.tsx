import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { db } from '../db/db'
import { saveReading } from '../db/repo'
import { SUGAR_CONTEXTS, type SugarContext } from '../models/types'
import { classify, customTargets } from '../services/ranges'
import { S } from '../strings/en'
import { formatDate, isValidDate, isValidTime, klParts, nowTimeKL, todayKL } from '../utils/dates'
import { checkSugar, displayReading, parseSugarInput, toMmol, unitLabel } from '../utils/units'
import { parseSugarScan } from '../utils/sugarScan'
import { useSettings } from '../components/hooks'
import { Chips, Field, goBack, Page, useDelete, useUI } from '../components/ui'

interface Draft { date: string; value: string; context: SugarContext | null; time: string; note: string }
const fingerprint = (d: Draft): string => JSON.stringify(d)

export default function SugarEntry() {
  const { id = 'new' } = useParams()
  const [params] = useSearchParams()
  const isNew = id === 'new'
  const nav = useNavigate()
  const ui = useUI()
  const del = useDelete()
  const settings = useSettings()
  const unit = settings.sugar_unit
  const [draft, setDraft] = useState<Draft | null>(null)
  const [missing, setMissing] = useState(false)
  const [errors, setErrors] = useState<{ value?: string; time?: string }>({})
  const initial = useRef('')
  /** For an existing reading: the value text as first shown. If unchanged, the typed value stays untouched. */
  const shownValue = useRef<string | null>(null)
  const valueInput = useRef<HTMLInputElement>(null)
  const [scan, setScan] = useState('')
  const [scanMsg, setScanMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const blank = (date: string): Draft => ({ date, value: '', context: null, time: date === todayKL() ? nowTimeKL() : '', note: '' })

  useEffect(() => {
    let cancelled = false
    if (isNew) {
      const asked = params.get('date') ?? ''
      const today = todayKL()
      const d = blank(isValidDate(asked) && asked <= today ? asked : today)
      initial.current = fingerprint(d)
      setDraft(d)
      return
    }
    void (async () => {
      const r = await db.readings.get(id)
      const day = r && !r.deleted_at ? await db.days.get(r.day_id) : undefined
      if (cancelled) return
      if (!r || !day) { setMissing(true); return }
      const settings = await db.settings.get('sugar_unit')
      const u = settings?.value === 'mg_dl' ? 'mg_dl' : 'mmol_l'
      const value = displayReading(r, u)
      shownValue.current = value
      const d: Draft = { date: day.date, value, context: r.context, time: klParts(r.measured_at).time, note: r.note }
      initial.current = fingerprint(d)
      setDraft(d)
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  if (missing) return <Page title={S.editReading} back><div className="card empty">{S.notFound}</div></Page>
  if (!draft) return <Page title={isNew ? S.newReading : S.editReading} back><span /></Page>

  const set = (patch: Partial<Draft>) => setDraft({ ...draft, ...patch })
  const dirty = fingerprint(draft) !== initial.current
  const cancel = async () => {
    if (!dirty || (await ui.confirm(S.discardConfirm, S.discard, true))) goBack(nav)
  }

  /** Fills the value from scanned (or typed) text. */
  const onScan = (text: string) => {
    setScan(text)
    if (text.trim() === '') { setScanMsg(null); return }
    const r = parseSugarScan(text, unit)
    if (!r) { setScanMsg({ ok: false, text: S.sugarScan.none }); return }
    set({ value: r.text })
    setErrors({})
    setScanMsg({ ok: true, text: r.guessedPoint ? S.sugarScan.guessed(r.text, unitLabel(unit)) : S.sugarScan.found(r.text, unitLabel(unit)) })
  }

  const save = async (another: boolean) => {
    const problems: { value?: string; time?: string } = {}
    const unchanged = !isNew && draft.value.trim() === shownValue.current
    const typed = unchanged ? null : parseSugarInput(draft.value, unit)
    if (!unchanged && typed == null) problems.value = S.sugarFormat[unit]
    if (typed != null && checkSugar(toMmol(typed, unit)) === 'reject') problems.value = S.sugarReject
    if (!isValidTime(draft.time)) problems.time = S.timeRequired
    setErrors(problems)
    if (problems.value || problems.time) return
    if (typed != null && checkSugar(toMmol(typed, unit)) === 'confirm') {
      // A neutral check only: the app never describes a value as high or low.
      if (!(await ui.confirm(S.sugarCheck(draft.value.trim(), unitLabel(unit)), S.saveValue))) return
    }
    const done = await ui.run(() => saveReading({
      id: isNew ? undefined : id, date: draft.date, time: draft.time,
      entered: typed != null ? { value: typed, unit } : undefined,
      context: draft.context, note: draft.note,
    }))
    if (!done) return
    if (typed != null) {
      // What to do next, for a low or a high reading.
      const level = classify(toMmol(typed, unit), draft.context, settings.range_mode, customTargets(settings))
      if (level === 'very_low') await ui.alert(S.advice.veryLow)
      else if (level === 'low') await ui.alert(S.advice.low)
      else if (level === 'high') await ui.alert(S.advice.high)
    }
    if (another) {
      const d = blank(draft.date)
      initial.current = fingerprint(d)
      setDraft(d)
      ui.toast(S.readingSaved)
      setScan('')
      setScanMsg(null)
      valueInput.current?.focus()
    } else {
      goBack(nav)
    }
  }

  return (
    <Page title={isNew ? S.newReading : S.editReading} back={() => { void cancel() }}>
      <p className="sub">{formatDate(draft.date)}</p>
      {isNew && (
        <div className="card stack">
          <Field label={S.sugarScan.label} htmlFor="sugar-scan">
            {/* Plain text box: the iPhone keyboard offers Scan Text for text, not number pads. */}
            <textarea id="sugar-scan" className="input" rows={1} autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false}
              placeholder={S.sugarScan.placeholder} value={scan} onChange={(e) => onScan(e.target.value)} />
          </Field>
          {scanMsg && <div className={scanMsg.ok ? 'notice' : 'error'} role="status">{scanMsg.text}</div>}
          <p className="muted" style={{ margin: 0 }}>{S.sugarScan.help}</p>
        </div>
      )}
      <div className="card stack">
        <Field label={S.value} htmlFor="sugar-value" error={errors.value}>
          <div className="input-row">
            <input id="sugar-value" ref={valueInput} className="input" inputMode={unit === 'mmol_l' ? 'decimal' : 'numeric'} autoComplete="off"
              value={draft.value} onChange={(e) => set({ value: e.target.value })} aria-describedby="sugar-unit" />
            <strong id="sugar-unit" style={{ whiteSpace: 'nowrap' }}>{unitLabel(unit)}</strong>
          </div>
        </Field>
        <Field label={`${S.contextLabel} (${S.optional})`}>
          <Chips label={S.contextLabel} value={draft.context}
            onChange={(c) => set({ context: draft.context === c ? null : c })}
            options={SUGAR_CONTEXTS.map((c) => ({ value: c, label: S.context[c] }))} />
        </Field>
        <Field label={S.time} htmlFor="sugar-time" error={errors.time}>
          <input id="sugar-time" className="input" type="time" value={draft.time} onChange={(e) => set({ time: e.target.value })} />
        </Field>
        <Field label={`${S.note} (${S.optional})`} htmlFor="sugar-note">
          <textarea id="sugar-note" className="input" rows={2} value={draft.note} onChange={(e) => set({ note: e.target.value })} />
        </Field>
      </div>
      <div className="actions">
        <button className="btn" onClick={() => { void cancel() }}>{S.cancel}</button>
        <button className="btn primary" onClick={() => { void save(false) }}>{S.save}</button>
      </div>
      {isNew && <button className="btn" onClick={() => { void save(true) }}>{S.saveAndAdd}</button>}
      {settings.range_mode !== 'off' && <Link to="/ranges" className="link" style={{ alignSelf: 'center', display: 'inline-flex', alignItems: 'center' }}>{S.ranges.link}</Link>}
      {!isNew && (
        <button className="btn danger" onClick={async () => { if (await del('reading', id, S.confirmDeleteReading)) goBack(nav) }}>{S.deleteReading}</button>
      )}
    </Page>
  )
}
