import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import { currentGoal, latestWeight } from '../db/repo'
import type { Activity, Meal, Photo, Reading, Settings } from '../models/types'
import { levelOf, type Level } from '../services/ranges'
import { S } from '../strings/en'
import { formatShort, klParts } from '../utils/dates'
import { displayReading, formatKcal, formatKg, roundTo, unitLabel } from '../utils/units'
import { Badge, Icon } from './icons'
import { Thumb } from './photos'

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

export function GoalCard() {
  const nav = useNavigate()
  const data = useLiveQuery(async () => ({ goal: await currentGoal(), latest: await latestWeight('9999-12-31', true) }))
  if (!data) return <div className="hero" aria-hidden="true">&nbsp;</div>
  const { goal, latest } = data
  return (
    <button className="hero" onClick={() => nav('/goal')}>
      {goal == null ? (
        <div className="spread">
          <span className="hero-title">{S.setGoalPrompt}</span>
          <Icon name="chevron" />
        </div>
      ) : (
        <>
          <div className="spread">
            <span className="hero-label">{S.goalTitle}</span>
            <Icon name="chevron" size={18} />
          </div>
          <div className="hero-number" aria-label={S.dreamWeight(formatKg(goal))}>
            {formatKg(goal)}<span className="hero-unit"> {S.kg}</span>
          </div>
          {latest && (
            <div className="hero-foot">
              <span>{S.latestWeight(formatKg(latest.weight_kg), formatShort(latest.date))}</span>
              <span className="hero-pill">{goalDifference(latest.weight_kg, goal)}</span>
            </div>
          )}
        </>
      )}
    </button>
  )
}
