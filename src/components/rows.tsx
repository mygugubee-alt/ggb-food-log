import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import { currentGoal, latestWeight } from '../db/repo'
import type { Activity, BpReading, Meal, Photo, Reading, Settings } from '../models/types'
import { BP_TONE, bpBand, levelOf, type Level } from '../services/ranges'
import { BMI_EDGES, bmi, bmiBand, bmiPosition, type BmiBand } from '../services/bmi'
import { S } from '../strings/en'
import { formatShort, klParts } from '../utils/dates'
import { displayReading, formatKcal, formatKg, roundTo, unitLabel } from '../utils/units'
import { Badge, Icon } from './icons'
import { Thumb } from './photos'
import { useSettings } from './hooks'

export const mealTitle = (m: Meal): string => `${S.mealType[m.meal_type]}${m.time ? ` · ${m.time}` : ''}`

export function MealSummary({ meal, photos, onPhoto }: { meal: Meal; photos: Photo[]; onPhoto?: (id: string) => void }) {
  return (
    <>
      <Badge name={meal.meal_type} tone="warm" />
      <div className="grow stack" style={{ gap: 4 }}>
        <div className="spread">
          <span><strong>{S.mealType[meal.meal_type]}</strong>{meal.time && <span className="sub"> · {meal.time}</span>}</span>
          {meal.calories_kcal != null && <span className="pill">{formatKcal(meal.calories_kcal)} {S.kcal}</span>}
        </div>
        {meal.description && <div className="pre">{meal.description}</div>}
        {photos.length > 0 && (
          <div className="thumbs">
            {photos.map((p) => <Thumb key={p.id} id={p.id} small onClick={onPhoto ? () => onPhoto(p.id) : undefined} />)}
          </div>
        )}
      </div>
    </>
  )
}

/** The word label for a reading's level. Colour is never the only signal. */
export function LevelTag({ level }: { level: Level }) {
  return <span className={`level lvl-bg-${level}`}>{S.level[level]}</span>
}

export function ReadingSummary({ reading, settings }: { reading: Reading; settings: Settings }) {
  const unit = settings.sugar_unit
  const level = levelOf(reading, settings)
  return (
    <>
      <Badge name="drop" tone="blue" />
      <div className="grow">
        <div className="spread">
          <span><strong className={`num ${level ? `lvl-${level}` : ''}`}>{displayReading(reading, unit)}</strong> <span className="sub">{unitLabel(unit)}</span></span>
          {level && <LevelTag level={level} />}
        </div>
        <div className="sub">{klParts(reading.measured_at).time}{reading.context ? ` · ${S.context[reading.context]}` : ''}</div>
        {reading.note && <div className="sub pre">{reading.note}</div>}
      </div>
    </>
  )
}

export function BpSummary({ reading }: { reading: BpReading }) {
  const band = bpBand(reading.systolic, reading.diastolic)
  const tone = BP_TONE[band]
  return (
    <>
      <Badge name="heart" tone="warm" />
      <div className="grow" aria-label={S.bp.aria(reading.systolic, reading.diastolic, reading.pulse, S.bp.band[band])}>
        <div className="spread">
          <span><strong className={`num lvl-${tone}`}>{reading.systolic}/{reading.diastolic}</strong> <span className="sub">{S.bp.mmHg}</span></span>
          <span className={`level lvl-bg-${tone}`}>{S.bp.band[band]}</span>
        </div>
        <div className="sub">{klParts(reading.measured_at).time}{reading.pulse != null && ` · ${S.bp.pulse} ${reading.pulse}${S.bp.perMin}`}</div>
      </div>
    </>
  )
}

export function ActivitySummary({ activity }: { activity: Activity }) {
  return (
    <>
      <Badge name="pulse" tone="green" />
      <div className="grow">
        <div className="spread">
          <strong>{activity.name}</strong>
          {activity.kcal != null && <span className="pill">{formatKcal(activity.kcal)} {S.kcal}</span>}
        </div>
        <div className="sub">{activity.minutes} {S.act.min}</div>
      </div>
    </>
  )
}

/** Plain subtraction, rounded to one decimal place. No timelines or rate suggestions. */
export function goalDifference(latest: number, goal: number): string {
  const diff = roundTo(latest - goal, 1)
  if (diff > 0) return S.aboveGoal(diff.toFixed(1))
  if (diff < 0) return S.belowGoal(Math.abs(diff).toFixed(1))
  return S.atGoal
}

const BANDS: BmiBand[] = ['under', 'healthy', 'over', 'obese']

/** Four equal coloured bands with the band edges above and a bubble pointing at this BMI. */
function BmiBar({ value, band }: { value: number; band: BmiBand }) {
  const pos = bmiPosition(value) * 100
  return (
    <div className="bmi" role="img" aria-label={S.bmiAria(value.toFixed(1), S.bmiBand[band])}>
      <div className="bmi-head"><span className="hero-small">{S.bmiLabel}</span></div>
      <div className="bmi-scale">
        <div className="bmi-bubble" style={{ left: `clamp(22px, ${pos}%, calc(100% - 22px))` }}>{value.toFixed(1)}</div>
        <div className="bmi-pin" style={{ left: `${pos}%` }} />
        {BMI_EDGES.slice(1, 4).map((e, i) => Math.abs((i + 1) * 25 - pos) < 9 ? null : <span key={e} className="bmi-edge" style={{ left: `${(i + 1) * 25}%` }}>{e.toFixed(1)}</span>)}
        <div className="bmi-bar">{BANDS.map((b) => <span key={b} className={`bmi-seg seg-${b}`} />)}</div>
      </div>
      <div className="bmi-names">{BANDS.map((b) => <span key={b} className={b === band ? 'on' : ''}>{S.bmiShort[b]}</span>)}</div>
    </div>
  )
}

export function GoalCard() {
  const nav = useNavigate()
  const settings = useSettings()
  const data = useLiveQuery(async () => ({ goal: await currentGoal(), latest: await latestWeight('9999-12-31', true) }))
  if (!data || !settings) return <div className="hero" aria-hidden="true">&nbsp;</div>
  const { goal, latest } = data
  const height = settings.height_cm
  const value = latest && height ? bmi(latest.weight_kg, height) : null
  const band = value != null ? bmiBand(value) : null
  const diff = latest && goal != null ? roundTo(latest.weight_kg - goal, 1) : null
  return (
    <button className="hero" onClick={() => nav('/goal')}>
      <div className="spread">
        <span className="hero-label">{S.weightCardTitle}</span>
        <Icon name="chevron" size={18} />
      </div>
      {latest ? (
        <div className="hero-number">{formatKg(latest.weight_kg)}<span className="hero-unit"> {S.kg}</span></div>
      ) : (
        <div className="hero-title" style={{ marginTop: 6 }}>{S.noWeightYet}</div>
      )}

      {goal == null ? (
        <div className="hero-foot"><span className="hero-pill">{S.setGoalPrompt}</span></div>
      ) : (
        <div className="hero-track" aria-label={latest ? `${S.dreamWeight(formatKg(goal))}. ${goalDifference(latest.weight_kg, goal)}` : S.dreamWeight(formatKg(goal))}>
          <div className="hero-end">
            <span className="hero-small">{S.dreamLabel}</span>
            <strong>{formatKg(goal)} {S.kg}</strong>
          </div>
          {latest && diff != null && (
            <>
              <div className="hero-arrow" aria-hidden="true">
                <span>{diff === 0 ? S.atGoalShort : S.toGo(Math.abs(diff).toFixed(1))}</span>
                <svg viewBox="0 0 100 10" preserveAspectRatio="none">
                  {diff > 0 && <path d="M1 5h98M1 5l6-4M1 5l6 4" />}
                  {diff < 0 && <path d="M1 5h98M99 5l-6-4M99 5l-6 4" />}
                  {diff === 0 && <path d="M1 5h98" />}
                </svg>
              </div>
              <div className="hero-end right">
                <span className="hero-small">{S.latestLabel}</span>
                <strong>{formatKg(latest.weight_kg)} {S.kg}</strong>
                <span className="hero-small">({formatShort(latest.date)})</span>
              </div>
            </>
          )}
        </div>
      )}

      {latest && (value != null && band ? <BmiBar value={value} band={band} /> : (
        <div className="hero-foot"><span className="hero-small">{S.bmiNeedsHeight}</span></div>
      ))}
    </button>
  )
}
