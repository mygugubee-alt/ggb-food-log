import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { db } from '../db/db'
import { saveBp } from '../db/repo'
import { BP_TONE, bpBand } from '../services/ranges'
import { S } from '../strings/en'
import { BP_LIMITS, parseBpNumber } from '../utils/bp'
import { readMonitorPhoto } from '../services/photos'
import { formatDate, isValidDate, isValidTime, klParts, nowTimeKL, todayKL } from '../utils/dates'
import { Field, goBack, Page, useDelete, useUI } from '../components/ui'

interface Draft { date: string; time: string; sys: string; dia: string; pulse: string }
const fingerprint = (d: Draft): string => JSON.stringify(d)
type Errors = Partial<Record<'sys' | 'dia' | 'pulse' | 'time', string>>

export default function BpEntry() {
  const { id = 'new' } = useParams()
  const [params] = useSearchParams()
  const isNew = id === 'new'
  const nav = useNavigate()
  const ui = useUI()
  const del = useDelete()
  const [draft, setDraft] = useState<Draft | null>(null)
  const [missing, setMissing] = useState(false)
  const [errors, setErrors] = useState<Errors>({})
  const [scanMsg, setScanMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const initial = useRef('')

  const blank = (date: string): Draft => ({ date, time: date === todayKL() ? nowTimeKL() : '', sys: '', dia: '', pulse: '' })

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
      const r = await db.bp.get(id)
      const day = r && !r.deleted_at ? await db.days.get(r.day_id) : undefined
      if (cancelled) return
      if (!r || !day) { setMissing(true); return }
      const d: Draft = { date: day.date, time: klParts(r.measured_at).time, sys: String(r.systolic), dia: String(r.diastolic), pulse: r.pulse == null ? '' : String(r.pulse) }
      initial.current = fingerprint(d)
      setDraft(d)
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  if (missing) return <Page title={S.bp.editTitle} back><div className="card empty">{S.notFound}</div></Page>
  if (!draft) return <Page title={isNew ? S.bp.newTitle : S.bp.editTitle} back><span /></Page>

  const set = (patch: Partial<Draft>) => setDraft({ ...draft, ...patch })
  const dirty = fingerprint(draft) !== initial.current
  const cancel = async () => {
    if (!dirty || (await ui.confirm(S.discardConfirm, S.discard, true))) goBack(nav)
  }

  /** Reads SYS, DIA and pulse from a photo of the monitor and fills the fields. */
  const onPhoto = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const out = await ui.run(() => readMonitorPhoto(file), S.bp.reading)
    if (!out) return
    const { result: r, preview: p } = out
    setPreview(p)
    setErrors({})
    const str = (v: number | null) => (v == null ? '' : String(v))
    if (r.systolic == null && r.diastolic == null && r.pulse == null) { setScanMsg({ ok: false, text: S.bp.photoNone }); return }
    set({ sys: str(r.systolic), dia: str(r.diastolic), pulse: str(r.pulse) })
    const all = r.systolic != null && r.diastolic != null && r.pulse != null
    setScanMsg(all
      ? { ok: true, text: S.bp.photoFound(str(r.systolic), str(r.diastolic), str(r.pulse)) }
      : { ok: false, text: S.bp.photoPartial })
  }

  const sys = parseBpNumber(draft.sys, BP_LIMITS.sys)
  const dia = parseBpNumber(draft.dia, BP_LIMITS.dia)
  const band = sys != null && dia != null && sys > dia ? bpBand(sys, dia) : null

  const save = async () => {
    const p: Errors = {}
    const pulse = draft.pulse.trim() === '' ? null : parseBpNumber(draft.pulse, BP_LIMITS.pulse)
    if (sys == null) p.sys = S.bp.sysError
    if (dia == null) p.dia = S.bp.diaError
    if (sys != null && dia != null && sys <= dia) p.dia = S.bp.orderError
    if (draft.pulse.trim() !== '' && pulse == null) p.pulse = S.bp.pulseError
    if (!isValidTime(draft.time)) p.time = S.timeRequired
    setErrors(p)
    if (Object.keys(p).length || sys == null || dia == null) return
    const done = await ui.run(() => saveBp({ id: isNew ? undefined : id, date: draft.date, time: draft.time, systolic: sys, diastolic: dia, pulse }))
    if (!done) return
    if (bpBand(sys, dia) === 'stage3') await ui.alert(S.bp.highAdvice)
    ui.toast(S.bp.saved)
    goBack(nav)
  }

  const numField = (key: 'sys' | 'dia' | 'pulse', label: string, unit: string) => (
    <label className="bp-num">
      <span className="bp-num-label">{label}</span>
      <input className="input" inputMode="numeric" autoComplete="off" maxLength={3} aria-invalid={!!errors[key]} aria-label={label}
        value={draft[key]} onChange={(e) => set({ [key]: e.target.value.replace(/\D/g, '') })} />
      <span className="sub">{unit}</span>
    </label>
  )

  return (
    <Page title={isNew ? S.bp.newTitle : S.bp.editTitle} back={() => { void cancel() }}>
      <p className="sub">{formatDate(draft.date)}</p>

      {isNew && (
        <div className="card stack">
          <span className="label">{S.bp.photoLabel}</span>
          <div className="actions">
            <label className="btn primary">
              <input className="sr-only" type="file" accept="image/*" capture="environment" onChange={(e) => { void onPhoto(e) }} />
              {S.bp.takePhoto}
            </label>
            <label className="btn">
              <input className="sr-only" type="file" accept="image/*" onChange={(e) => { void onPhoto(e) }} />
              {S.bp.choosePhoto}
            </label>
          </div>
          {preview && <img className="bp-preview" src={preview} alt="" />}
          {scanMsg && <div className={scanMsg.ok ? 'notice' : 'error'} role="status">{scanMsg.text}{scanMsg.ok && <><br /><span className="muted">{S.bp.checkPrior}</span></>}</div>}
          <p className="muted" style={{ margin: 0 }}>{S.bp.photoHelp}</p>
        </div>
      )}

      <div className="card stack">
        <div className="bp-nums">
          {numField('sys', S.bp.sys, S.bp.mmHg)}
          {numField('dia', S.bp.dia, S.bp.mmHg)}
          {numField('pulse', S.bp.pulse, S.bp.perMin)}
        </div>
        {(errors.sys || errors.dia || errors.pulse) && <div className="error" role="alert">{errors.sys ?? errors.dia ?? errors.pulse}</div>}
        {band && <div><span className={`level lvl-bg-${BP_TONE[band]}`}>{S.bp.band[band]}</span></div>}
        <Field label={S.time} htmlFor="bp-time" error={errors.time}>
          <input id="bp-time" className="input" type="time" value={draft.time} onChange={(e) => set({ time: e.target.value })} />
        </Field>
      </div>
      <div className="actions">
        <button className="btn" onClick={() => { void cancel() }}>{S.cancel}</button>
        <button className="btn primary" onClick={() => { void save() }}>{S.save}</button>
      </div>
      <p className="muted" style={{ fontSize: '0.8rem' }}>{S.bp.rangesNote}</p>
      {!isNew && (
        <button className="btn danger" onClick={async () => { if (await del('bp', id, S.bp.confirmDelete)) goBack(nav) }}>{S.bp.delete}</button>
      )}
    </Page>
  )
}
