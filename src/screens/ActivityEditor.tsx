import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ACTIVITY_TYPES, activityType, estimateKcal } from '../data/activities'
import { db } from '../db/db'
import { saveActivity, weightFor } from '../db/repo'
import { S } from '../strings/en'
import { formatDate, isValidDate, todayKL } from '../utils/dates'
import { formatKg, parseCalories } from '../utils/units'
import { Field, goBack, Page, useDelete, useUI } from '../components/ui'

interface Draft { date: string; type: string; name: string; minutes: string; kcal: string; auto: boolean }
const fingerprint = (d: Draft): string => JSON.stringify(d)
const parseMinutes = (t: string): number | null => (/^\d{1,4}$/.test(t.trim()) && Number(t) > 0 && Number(t) <= 1440 ? Number(t) : null)

export default function ActivityEditor() {
  const { id = 'new' } = useParams()
  const [params] = useSearchParams()
  const isNew = id === 'new'
  const nav = useNavigate()
  const ui = useUI()
  const del = useDelete()
  const [draft, setDraft] = useState<Draft | null>(null)
  const [weight, setWeight] = useState<number | null>(null)
  const [missing, setMissing] = useState(false)
  const [errors, setErrors] = useState<{ minutes?: string; kcal?: string; name?: string }>({})
  const initial = useRef('')

  useEffect(() => {
    let cancelled = false
    void (async () => {
      let d: Draft
      if (isNew) {
        const asked = params.get('date') ?? ''
        const today = todayKL()
        d = { date: isValidDate(asked) && asked <= today ? asked : today, type: 'walking', name: '', minutes: '30', kcal: '', auto: true }
      } else {
        const a = await db.activities.get(id)
        const day = a && !a.deleted_at ? await db.days.get(a.day_id) : undefined
        if (!a || !day) { if (!cancelled) setMissing(true); return }
        d = { date: day.date, type: a.activity_type, name: a.activity_type === 'other' ? a.name : '', minutes: String(a.minutes), kcal: a.kcal != null ? String(a.kcal) : '', auto: a.kcal_auto }
      }
      const w = await weightFor(d.date)
      if (cancelled) return
      setWeight(w)
      initial.current = fingerprint(d)
      setDraft(d)
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  if (missing) return <Page title={S.act.edit} back><div className="card empty">{S.notFound}</div></Page>
  if (!draft) return <Page title={isNew ? S.act.add : S.act.edit} back><span /></Page>

  const type = activityType(draft.type)
  const minutes = parseMinutes(draft.minutes)
  const estimate = estimateKcal(type.met, weight, minutes ?? 0)
  const shownKcal = draft.auto ? (estimate != null ? String(estimate) : '') : draft.kcal
  const set = (patch: Partial<Draft>) => setDraft({ ...draft, ...patch })
  const dirty = fingerprint(draft) !== initial.current
  const cancel = async () => {
    if (!dirty || (await ui.confirm(S.discardConfirm, S.discard, true))) goBack(nav)
  }
  const save = async () => {
    const problems: typeof errors = {}
    if (minutes == null) problems.minutes = S.act.minutesError
    if (draft.type === 'other' && draft.name.trim() === '') problems.name = S.act.nameError
    let kcal: number | null = null
    if (shownKcal.trim() !== '') {
      kcal = parseCalories(shownKcal)
      if (kcal == null) problems.kcal = S.caloriesError
    }
    setErrors(problems)
    if (minutes == null || problems.name || problems.kcal) return
    const done = await ui.run(() => saveActivity({
      id: isNew ? undefined : id, date: draft.date, activity_type: draft.type,
      name: draft.type === 'other' ? draft.name.trim() : type.label, minutes, kcal, kcal_auto: draft.auto && estimate != null,
    }))
    if (done) goBack(nav)
  }

  return (
    <Page title={isNew ? S.act.add : S.act.edit} back={() => { void cancel() }}>
      <p className="sub">{formatDate(draft.date)}</p>
      <div className="card stack">
        <Field label={S.act.type} htmlFor="act-type">
          <select id="act-type" className="input" value={draft.type} onChange={(e) => set({ type: e.target.value })}>
            {ACTIVITY_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
        </Field>
        {draft.type === 'other' && (
          <Field label={S.act.name} htmlFor="act-name" error={errors.name}>
            <input id="act-name" className="input" autoComplete="off" value={draft.name} onChange={(e) => set({ name: e.target.value })} />
          </Field>
        )}
        <Field label={S.act.minutes} htmlFor="act-min" error={errors.minutes}>
          <input id="act-min" className="input" inputMode="numeric" autoComplete="off" value={draft.minutes} onChange={(e) => set({ minutes: e.target.value })} />
        </Field>
        <Field label={S.act.kcal} htmlFor="act-kcal" error={errors.kcal}
          note={!draft.auto && estimate != null ? <button type="button" className="link" style={{ minHeight: 0 }} onClick={() => set({ auto: true, kcal: '' })}>{S.act.useEstimate(estimate)}</button> : undefined}>
          <input id="act-kcal" className="input" inputMode="numeric" autoComplete="off" value={shownKcal}
            onChange={(e) => set({ kcal: e.target.value, auto: false })} />
        </Field>
        <p className="muted">
          {type.met == null ? S.act.otherNote
            : weight == null ? S.act.noWeight
            : draft.auto ? S.act.estimateNote(formatKg(weight)) : S.act.manualNote}
        </p>
      </div>
      <div className="actions">
        <button className="btn" onClick={() => { void cancel() }}>{S.cancel}</button>
        <button className="btn primary" onClick={() => { void save() }}>{S.save}</button>
      </div>
      {!isNew && (
        <button className="btn danger" onClick={async () => { if (await del('activity', id, S.act.confirmDelete)) goBack(nav) }}>{S.act.delete}</button>
      )}
    </Page>
  )
}
