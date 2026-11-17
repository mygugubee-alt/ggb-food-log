import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { searchFoods, type Food } from '../data/foods'
import { db } from '../db/db'
import { saveMeal, type DraftPhoto } from '../db/repo'
import { MEAL_TYPES, type MealType } from '../models/types'
import { jpegUrl } from '../services/photos'
import { S } from '../strings/en'
import { formatDate, isValidDate, nowTimeKL, todayKL } from '../utils/dates'
import { parseCalories } from '../utils/units'
import { PhotoButtons, Thumb } from '../components/photos'
import { Chips, Field, goBack, Page, useDelete, useUI } from '../components/ui'

/** Finds a food in the built-in list and adds its name and typical calories to the meal. */
function FoodPicker({ onAdd }: { onAdd: (food: Food, servings: number) => void }) {
  const [text, setText] = useState('')
  const found = searchFoods(text)
  return (
    <Field label={S.foodFind} htmlFor="food-find">
      <input id="food-find" className="input" type="search" autoComplete="off" placeholder={S.foodFindPlaceholder}
        value={text} onChange={(e) => setText(e.target.value)} />
      {text.trim() !== '' && (found.length === 0 ? <p className="muted">{S.foodNone}</p> : (
        <ul className="list">
          {found.map((f) => (
            <li key={f.name} className="row" style={{ padding: '8px 0' }}>
              <div className="grow">
                <strong>{f.name}</strong>
                <div className="sub">{f.serving} · {f.kcal} {S.kcal}</div>
              </div>
              <button type="button" className="btn" aria-label={S.foodAddHalf(f.name)} onClick={() => onAdd(f, 0.5)}>+½</button>
              <button type="button" className="btn primary" aria-label={S.foodAddOne(f.name)} onClick={() => onAdd(f, 1)}>+1</button>
            </li>
          ))}
        </ul>
      ))}
      <p className="muted">{S.foodNote}</p>
    </Field>
  )
}

interface Draft {
  date: string
  meal_type: MealType
  time: string // '' = no time
  description: string
  calories: string
  photos: DraftPhoto[]
}

/** The meal type that fits the time of day, for a new meal. */
function typeForTime(time: string): MealType {
  if (time < '10:30') return 'breakfast'
  if (time < '15:00') return 'lunch'
  if (time < '17:30') return 'snack'
  if (time < '21:30') return 'dinner'
  return 'snack'
}
const fingerprint = (d: Draft): string =>
  JSON.stringify({ ...d, photos: d.photos.map((p) => (p.kind === 'existing' ? p.id : p.key)) })

export default function MealEditor() {
  const { id = 'new' } = useParams()
  const [params] = useSearchParams()
  const isNew = id === 'new'
  const nav = useNavigate()
  const ui = useUI()
  const del = useDelete()
  const [draft, setDraft] = useState<Draft | null>(null)
  const [missing, setMissing] = useState(false)
  const [caloriesError, setCaloriesError] = useState<string | null>(null)
  const initial = useRef('')
  const previews = useRef(new Map<string, string>())
  const nextKey = useRef(0)

  useEffect(() => {
    let cancelled = false
    const start = (d: Draft) => {
      if (cancelled) return
      initial.current = fingerprint(d)
      setDraft(d)
    }
    if (isNew) {
      const asked = params.get('date') ?? ''
      const today = todayKL()
      const date = isValidDate(asked) && asked <= today ? asked : today
      const now = nowTimeKL()
      start({ date, meal_type: typeForTime(now), time: date === today ? now : '', description: '', calories: '', photos: [] })
    } else {
      void (async () => {
        const meal = await db.meals.get(id)
        const day = meal && !meal.deleted_at ? await db.days.get(meal.day_id) : undefined
        if (!meal || !day) { if (!cancelled) setMissing(true); return }
        const photos = (await db.photos.where('meal_id').equals(id).toArray())
          .filter((p) => !p.deleted_at).sort((a, b) => a.sort_order - b.sort_order)
        start({
          date: day.date, meal_type: meal.meal_type, time: meal.time ?? '', description: meal.description,
          calories: meal.calories_kcal != null ? String(meal.calories_kcal) : '',
          photos: photos.map((p) => ({ kind: 'existing', id: p.id })),
        })
      })()
    }
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  useEffect(() => {
    const urls = previews.current
    return () => { urls.forEach((u) => URL.revokeObjectURL(u)); urls.clear() }
  }, [])

  if (missing) return <Page title={S.editMeal} back><div className="card empty">{S.notFound}</div></Page>
  if (!draft) return <Page title={isNew ? S.newMeal : S.editMeal} back><span /></Page>

  const set = (patch: Partial<Draft>) => setDraft({ ...draft, ...patch })
  const dirty = fingerprint(draft) !== initial.current
  const cancel = async () => {
    if (!dirty || (await ui.confirm(S.discardConfirm, S.discard, true))) goBack(nav)
  }
  const save = async () => {
    let calories: number | null = null
    if (draft.calories.trim() !== '') {
      calories = parseCalories(draft.calories)
      if (calories == null) { setCaloriesError(S.caloriesError); return }
    }
    setCaloriesError(null)
    const done = await ui.run(() => saveMeal({
      id: isNew ? undefined : id, date: draft.date, meal_type: draft.meal_type, time: draft.time || null,
      description: draft.description, calories_kcal: calories, photos: draft.photos,
    }))
    if (done) goBack(nav)
  }
  const movePhoto = (i: number, by: number) => {
    const photos = [...draft.photos]
    ;[photos[i], photos[i + by]] = [photos[i + by], photos[i]]
    set({ photos })
  }

  return (
    <Page title={isNew ? S.newMeal : S.editMeal} back={() => { void cancel() }}>
      <p className="sub">{formatDate(draft.date)}</p>
      <div className="card stack">
        <Field label={S.mealTypeLabel}>
          <Chips label={S.mealTypeLabel} value={draft.meal_type} onChange={(meal_type) => set({ meal_type })}
            options={MEAL_TYPES.map((t) => ({ value: t, label: S.mealType[t] }))} />
        </Field>
        <Field label={`${S.time} (${S.optional})`} htmlFor="meal-time">
          <div className="input-row">
            <input id="meal-time" className="input" type="time" value={draft.time} onChange={(e) => set({ time: e.target.value })} />
            {draft.time && <button className="btn" onClick={() => set({ time: '' })}>{S.clearTime}</button>}
          </div>
        </Field>
        <FoodPicker onAdd={(food, servings) => {
          const add = Math.round(food.kcal * servings)
          const label = servings === 0.5 ? `½ ${food.name}` : food.name
          setDraft((d) => (d ? {
            ...d,
            description: d.description.trim() ? `${d.description.trim()}, ${label}` : label,
            calories: String((parseCalories(d.calories) ?? 0) + add),
          } : d))
          ui.toast(S.foodAdded(label, add))
        }} />
        <Field label={S.description} htmlFor="meal-desc">
          <textarea id="meal-desc" className="input" rows={3} placeholder={S.descriptionPlaceholder}
            value={draft.description} onChange={(e) => set({ description: e.target.value })} />
        </Field>
        <Field label={`${S.caloriesKcal} (${S.optional})`} htmlFor="meal-kcal" error={caloriesError}>
          <input id="meal-kcal" className="input" inputMode="numeric" autoComplete="off"
            value={draft.calories} onChange={(e) => set({ calories: e.target.value })} />
        </Field>
      </div>

      <div className="card stack">
        <h2 style={{ marginBottom: 0 }}>{S.photos}</h2>
        {draft.photos.length > 0 && (
          <div className="thumbs">
            {draft.photos.map((p, i) => (
              <div className="draft-photo" key={p.kind === 'existing' ? p.id : p.key}>
                {p.kind === 'existing'
                  ? <Thumb id={p.id} />
                  : <span className="thumb"><img src={previews.current.get(p.key)} alt={S.photo} /></span>}
                <div className="row">
                  <button className="icon-btn" aria-label={S.moveLeft} disabled={i === 0} onClick={() => movePhoto(i, -1)}>‹</button>
                  <button className="icon-btn" aria-label={S.removePhoto} onClick={() => set({ photos: draft.photos.filter((_, k) => k !== i) })}>×</button>
                  <button className="icon-btn" aria-label={S.moveRight} disabled={i === draft.photos.length - 1} onClick={() => movePhoto(i, 1)}>›</button>
                </div>
              </div>
            ))}
          </div>
        )}
        <PhotoButtons onPhotos={(added) => {
          const items: DraftPhoto[] = added.map((photo) => {
            const key = `new-${nextKey.current++}`
            previews.current.set(key, jpegUrl(photo.thumb))
            return { kind: 'new', key, photo }
          })
          setDraft((d) => (d ? { ...d, photos: [...d.photos, ...items] } : d))
        }} />
      </div>

      <div className="actions">
        <button className="btn" onClick={() => { void cancel() }}>{S.cancel}</button>
        <button className="btn primary" onClick={() => { void save() }}>{S.save}</button>
      </div>
      {!isNew && (
        <button className="btn danger" onClick={async () => { if (await del('meal', id, S.confirmDeleteMeal)) goBack(nav) }}>{S.deleteMeal}</button>
      )}
    </Page>
  )
}
