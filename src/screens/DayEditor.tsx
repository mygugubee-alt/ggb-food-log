import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { addDayPhotos, burnedKcal, isLogged, loadDayBundle, moveMeal, updateDay, type DayPatch } from '../db/repo'
import { mealCaloriesSum } from '../services/calories'
import { S } from '../strings/en'
import { formatDate, formatWeekday, isValidDate, todayKL } from '../utils/dates'
import { formatKcal, formatKg, parseWeight } from '../utils/units'
import { useSettings } from '../components/hooks'
import { Icon } from '../components/icons'
import { PhotoButtons, Thumb } from '../components/photos'
import { ActivitySummary, MealSummary, ReadingSummary } from '../components/rows'
import { errorMessage, goBack, Field, Page, useDelete, useUI } from '../components/ui'

/** A field that saves when it loses focus and shows a small "Saved" mark. */
function AutoField({ id, label, value, commit, inputMode, multiline, placeholder, autoFocus }: {
  id: string
  label: string
  value: string
  /** Saves the text. Returns an error message, or null when saved. */
  commit: (text: string) => Promise<string | null>
  inputMode?: 'decimal' | 'numeric' | 'text'
  multiline?: boolean
  placeholder?: string
  autoFocus?: boolean
}) {
  const [text, setText] = useState(value)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const focused = useRef(false)
  useEffect(() => {
    if (!focused.current) { setText(value); setError(null) }
  }, [value])

  const blur = async () => {
    focused.current = false
    if (text.trim() === value.trim()) { setText(value); setError(null); return }
    const problem = await commit(text)
    setError(problem)
    if (!problem) {
      setSaved(true)
      window.setTimeout(() => setSaved(false), 1600)
    }
  }
  const common = {
    id, className: 'input', value: text, placeholder, autoFocus,
    onFocus: () => { focused.current = true },
    onBlur: () => { void blur() },
    'aria-invalid': error != null,
  }
  return (
    <Field label={label} htmlFor={id} error={error} note={saved ? <span className="saved" role="status">✓ {S.saved}</span> : undefined}>
      {multiline
        ? <textarea {...common} rows={3} onChange={(e) => setText(e.target.value)} />
        : <input {...common} inputMode={inputMode} autoComplete="off" enterKeyHint="done"
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }} />}
    </Field>
  )
}

export default function DayEditor() {
  const { date = '' } = useParams()
  if (!isValidDate(date) || date > todayKL()) {
    return <Page title={S.editDay} back><div className="card empty">{S.futureDate}</div></Page>
  }
  return <Editor key={date} date={date} />
}

function Editor({ date }: { date: string }) {
  const nav = useNavigate()
  const ui = useUI()
  const del = useDelete()
  const [params] = useSearchParams()
  const settings = useSettings()
  const bundle = useLiveQuery(() => loadDayBundle(date), [date])
  if (!bundle) return <Page title={formatDate(date)} back><span /></Page>

  const day = bundle.day
  const save = async (patch: DayPatch): Promise<string | null> => {
    try { await updateDay(date, patch); return null } catch (e) { return errorMessage(e) }
  }
  const mealSum = mealCaloriesSum(bundle.meals)
  const dayPhotos = bundle.photos.filter((p) => p.meal_id == null)
  const burned = burnedKcal(bundle.activities)

  return (
    <Page title={`${formatWeekday(date)}, ${formatDate(date)}`} back>
      <div className="card stack">
        <AutoField id="weight" label={S.weightKg} inputMode="decimal" autoFocus={params.get('focus') === 'weight'}
          value={day?.weight_kg != null ? formatKg(day.weight_kg) : ''}
          commit={async (t) => {
            if (t.trim() === '') return save({ weight_kg: null })
            const w = parseWeight(t)
            return w == null ? S.weightError : save({ weight_kg: w })
          }} />
        <AutoField id="note" label={S.dayNote} multiline value={day?.day_note ?? ''} commit={(t) => save({ day_note: t.trim() })} />
      </div>

      <div className="card">
        <div className="spread">
          <h2><Icon name="pulse" size={16} />{S.act.title}</h2>
          {burned != null && <span className="pill">{S.act.total(formatKcal(burned))}</span>}
        </div>
        {bundle.activities.length === 0 ? <p className="muted">{S.act.none}</p> : (
          <ul className="list">
            {bundle.activities.map((a) => (
              <li key={a.id}><button className="item" onClick={() => nav(`/activity/${a.id}`)}><ActivitySummary activity={a} /><span className="chev"><Icon name="chevron" size={18} /></span></button></li>
            ))}
          </ul>
        )}
        <button className="btn block" style={{ marginTop: 8 }} onClick={() => nav(`/activity/new?date=${date}`)}>+ {S.act.add}</button>
      </div>

      <div className="card">
        <h2><Icon name="drop" size={16} />{S.bloodSugar}</h2>
        {bundle.readings.length === 0 ? <p className="muted">{S.noReadings}</p> : (
          <ul className="list">
            {bundle.readings.map((r) => (
              <li key={r.id}><button className="item" onClick={() => nav(`/sugar/${r.id}`)}><ReadingSummary reading={r} settings={settings} /><span className="chev"><Icon name="chevron" size={18} /></span></button></li>
            ))}
          </ul>
        )}
        <button className="btn block" style={{ marginTop: 8 }} onClick={() => nav(`/sugar/new?date=${date}`)}>{S.addReading}</button>
      </div>

      <div className="card">
        <div className="spread">
          <h2><Icon name="utensils" size={16} />{S.meals}</h2>
          {mealSum != null && <span className="pill">{S.mealsTotal(formatKcal(mealSum))}</span>}
        </div>
        {bundle.meals.length === 0 ? <p className="muted">{S.noMeals}</p> : (
          <ul className="list">
            {bundle.meals.map((m, i) => (
              <li key={m.id} className="row">
                <div className="item" style={{ cursor: 'default' }}>
                  <button className="item" style={{ padding: 0 }} onClick={() => nav(`/meal/${m.id}`)} aria-label={`${S.editMeal}: ${S.mealType[m.meal_type]}`}>
                    <MealSummary meal={m} photos={bundle.photos.filter((p) => p.meal_id === m.id)} />
                  </button>
                </div>
                <div className="stack" style={{ gap: 0 }}>
                  <button className="icon-btn" aria-label={S.moveUp} disabled={i === 0} onClick={() => { void ui.run(() => moveMeal(m.id, -1)) }}>▴</button>
                  <button className="icon-btn" aria-label={S.moveDown} disabled={i === bundle.meals.length - 1} onClick={() => { void ui.run(() => moveMeal(m.id, 1)) }}>▾</button>
                </div>
              </li>
            ))}
          </ul>
        )}
        <button className="btn block primary" style={{ marginTop: 8 }} onClick={() => nav(`/meal/new?date=${date}`)}>{S.addMeal}</button>
      </div>

      <div className="card stack">
        <h2 style={{ marginBottom: 0 }}><Icon name="camera" size={16} />{S.dayPhotos}</h2>
        {dayPhotos.length > 0 && (
          <div className="thumbs">{dayPhotos.map((p) => <Thumb key={p.id} id={p.id} onClick={() => nav(`/photo/${p.id}`)} />)}</div>
        )}
        <p className="muted">{S.addDayPhoto}</p>
        <PhotoButtons onPhotos={(photos) => addDayPhotos(date, photos)} />
      </div>

      {day && isLogged(bundle) && (
        <button className="btn danger" onClick={async () => { if (await del('day', day.id, S.confirmDeleteDay(formatDate(date)))) goBack(nav) }}>{S.deleteDay}</button>
      )}
    </Page>
  )
}
