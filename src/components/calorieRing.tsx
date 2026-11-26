import { MEAL_TYPES, type Meal } from '../models/types'
import { kcalByMealType, kcalRemaining, ringSegments } from '../services/calories'
import { S } from '../strings/en'
import { formatKcal } from '../utils/units'
import { Icon } from './icons'

const R = 54
const C = 2 * Math.PI * R
const GAP = 4 // px of track left between pieces

/** "Calorie intake" card: a ring split by meal, the number left (or eaten) inside, a legend per meal. */
export function CalorieCard({ meals, burned, goal, onClick }: {
  meals: Meal[]; burned: number | null; goal: number | null; onClick: () => void
}) {
  const totals = kcalByMealType(meals)
  const eaten = MEAL_TYPES.reduce((s, t) => s + totals[t], 0)
  const hasKcal = meals.some((m) => m.calories_kcal != null)
  const segs = ringSegments(totals, goal)
  const left = goal != null ? kcalRemaining(goal, eaten, burned) : null
  const centre = left != null ? left : eaten
  const aria = left == null ? S.cal.eatenAria(formatKcal(eaten)) : left >= 0 ? S.cal.remainingAria(formatKcal(left)) : S.cal.overAria(formatKcal(-left))

  return (
    <button className="card cal-card" onClick={onClick}>
      <div className="spread">
        <h2 style={{ margin: 0 }}><Icon name="flame" size={16} />{S.cal.title}</h2>
        <Icon name="chevron" size={18} />
      </div>
      <div className="cal-body">
        <div className="cal-ring" role="img" aria-label={aria}>
          <svg viewBox="0 0 140 140">
            <circle className="cal-track" cx="70" cy="70" r={R} />
            {segs.map((s) => {
              const len = Math.max(0, s.length * C - (segs.length > 1 ? GAP : 0))
              return (
                <circle key={s.type} className={`cal-seg meal-${s.type}`} cx="70" cy="70" r={R}
                  strokeDasharray={`${len} ${C}`} strokeDashoffset={-s.start * C} transform="rotate(-90 70 70)" />
              )
            })}
          </svg>
          <div className="cal-centre">
            <strong className={left != null && left < 0 ? 'cal-over' : ''}>{formatKcal(centre)}</strong>
            <span className="cal-unit">{S.kcal}</span>
            <span className="cal-caption">{left == null ? S.cal.eatenToday : left >= 0 ? S.cal.remaining : S.cal.over}</span>
          </div>
        </div>
        <ul className="cal-legend">
          {MEAL_TYPES.map((t) => (
            <li key={t}>
              <span className={`cal-dot meal-${t}`} aria-hidden="true" />
              <span><strong>{formatKcal(totals[t])} <small>{S.kcal}</small></strong><span className="sub">{S.mealType[t]}</span></span>
            </li>
          ))}
        </ul>
      </div>
      <div className="cal-foot">
        {goal != null && <span>{S.cal.eatenToday} <strong>{formatKcal(eaten)}</strong> {S.cal.ofGoal(formatKcal(goal))}</span>}
        {burned != null && <span><Icon name="pulse" size={14} /> {S.cal.burned} <strong>{formatKcal(burned)}</strong> {S.kcal} <span className="muted">({S.estimate})</span></span>}
        {goal == null && hasKcal && burned != null && <span>{S.cal.net} <strong>{formatKcal(eaten - burned)}</strong> {S.kcal}</span>}
        {!hasKcal && <span className="muted">{S.cal.noKcal}</span>}
        {goal == null && <span className="muted">{S.cal.setGoal}</span>}
      </div>
    </button>
  )
}
