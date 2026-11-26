import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { db } from '../db/db'
import { saveBp } from '../db/repo'
import { BP_TONE, bpBand } from '../services/ranges'
import { S } from '../strings/en'
import { BP_LIMITS, parseBpNumber, parseBpScan } from '../utils/bp'
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
  const [scan, setScan] = useState('')
  const [scanMsg, setScanMsg] = useState<{ ok: boolean; text: string } | null>(null)
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

  /** Fills the three fields from scanned (or typed) text as soon as it arrives. */
  const onScan = (text: string) => {
    setScan(text)
    if (text.trim() === '') { setScanMsg(null); return }
    const r = parseBpScan(text)
    if (r.systolic == null || r.diastolic == null) { setScanMsg({ ok: false, text: S.bp.scanNone }); return }
    set({ sys: String(r.systolic), dia: String(r.diastolic), pulse: r.pulse == null ? draft.pulse : String(r.pulse) })
    setErrors({})
    setScanMsg({ ok: true, text: S.bp.scanFound(String(r.systolic), String(r.diastolic), r.pulse == null ? '–' : String(r.pulse)) })
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
          <Field label={S.bp.scanLabel} htmlFor="bp-scan" note={<span className="muted"> </span>}>
            {/* A plain text box: the iPhone keyboard shows its Scan Text button only for text, not number pads. */}
            <textarea id="bp-scan" className="input" rows={2} autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false}
              placeholder={S.bp.scanPlaceholder} value={scan} onChange={(e) => onScan(e.target.value)} />
          </Field>
          {scanMsg && <div className={scanMsg.ok ? 'notice' : 'error'} role="status">{scanMsg.text}{scanMsg.ok && <><br /><span className="muted">{S.bp.checkPrior}</span></>}</div>}
          <p className="muted" style={{ margin: 0 }}>{S.bp.scanHelp}</p>
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
