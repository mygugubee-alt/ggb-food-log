import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { dayHasOwnContent, loadAll } from '../db/repo'
import type { Activity, DayEntry, Meal, Photo, Reading } from '../models/types'
import { dayCalories } from '../services/calories'
import { S } from '../strings/en'
import { addDays, formatDate, formatWeekday, MONTH_NAMES, todayKL, weekday, WEEKDAYS } from '../utils/dates'
import { formatKcal, formatKg, formatMmol, unitLabel } from '../utils/units'
import { useSettings } from '../components/hooks'
import { Thumb } from '../components/photos'
import { Chips, Page } from '../components/ui'

export interface DayInfo { day: DayEntry; meals: Meal[]; readings: Reading[]; photos: Photo[]; activities: Activity[] }

/** Logged days by date. Days with nothing in them are left out. */
export function useLoggedDays(): Map<string, DayInfo> | undefined {
  const all = useLiveQuery(loadAll)
  return useMemo(() => {
    if (!all) return undefined
    const byId = new Map<string, DayInfo>(all.days.map((day) => [day.id, { day, meals: [], readings: [], photos: [], activities: [] }]))
    all.meals.forEach((m) => byId.get(m.day_id)?.meals.push(m))
    all.readings.forEach((r) => byId.get(r.day_id)?.readings.push(r))
    all.photos.forEach((p) => byId.get(p.day_id)?.photos.push(p))
    all.activities.forEach((a) => byId.get(a.day_id)?.activities.push(a))
    const out = new Map<string, DayInfo>()
    for (const info of byId.values()) {
      if (dayHasOwnContent(info.day) || info.meals.length || info.readings.length || info.photos.length || info.activities.length) out.set(info.day.date, info)
    }
    return out
  }, [all])
}

const CameraIcon = () => <svg viewBox="0 0 12 12" aria-hidden="true"><path d="M4 1.5 3.2 3H1.5A1 1 0 0 0 .5 4v5.5a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1V4a1 1 0 0 0-1-1H8.8L8 1.5zM6 4.6a2.1 2.1 0 1 1 0 4.2 2.1 2.1 0 0 1 0-4.2z" fillRule="evenodd" /></svg>
const DropIcon = () => <svg viewBox="0 0 12 12" aria-hidden="true"><path d="M6 .8C4.2 3.3 2.6 5.3 2.6 7.5a3.4 3.4 0 0 0 6.8 0C9.400 5.3 7.800 3.300 6 .8z" /></svg>

function Calendar({ days, weekStart }: { days: Map<string, DayInfo>; weekStart: 0 | 1 }) {
  const nav = useNavigate()
  const today = todayKL()
  const [month, setMonth] = useState(today.slice(0, 7))
  const [y, m] = month.split('-').map(Number)
  const first = `${month}-01`
  const count = new Date(Date.UTC(y, m, 0)).getUTCDate()
  const blanks = (weekday(first) - weekStart + 7) % 7
  const shift = (by: number) => {
    const d = new Date(Date.UTC(y, m - 1 + by, 1))
    setMonth(d.toISOString().slice(0, 7))
  }
  const heads = Array.from({ length: 7 }, (_, i) => WEEKDAYS[(i + weekStart) % 7])
  return (
    <div className="card stack">
      <div className="date-switch">
        <button className="icon-btn" aria-label={S.prevMonth} onClick={() => shift(-1)}>‹</button>
        <div className="label">{MONTH_NAMES[m - 1]} {y}</div>
        <button className="icon-btn" aria-label={S.nextMonth} disabled={month >= today.slice(0, 7)} onClick={() => shift(1)}>›</button>
      </div>
      <div className="calendar">
        {heads.map((h) => <div key={h} className="head">{h}</div>)}
        {Array.from({ length: blanks }, (_, i) => <span key={`b${i}`} />)}
        {Array.from({ length: count }, (_, i) => {
          const date = addDays(first, i)
          const info = days.get(date)
          const hasPhotos = !!info && info.photos.length > 0
          const hasSugar = !!info && info.readings.length > 0
          return (
            <button key={date} disabled={date > today} onClick={() => nav(`/day/${date}`)}
              className={`cal-cell ${info ? 'logged' : ''} ${date === today ? 'today' : ''}`}
              aria-label={S.cellLabel(formatDate(date), !!info, hasPhotos, hasSugar)}>
              <span>{i + 1}</span>
              <span className="cal-marks">
                {info && <span className="cal-dot" />}
                {hasPhotos && <CameraIcon />}
                {hasSugar && <DropIcon />}
              </span>
            </button>
          )
        })}
      </div>
      <div className="legend">
        <span><span className="cal-dot" /> {S.legendLogged}</span>
        <span><CameraIcon /> {S.legendPhotos}</span>
        <span><DropIcon /> {S.legendSugar}</span>
      </div>
    </div>
  )
}

const PAGE = 40

function DayList({ days }: { days: Map<string, DayInfo> }) {
  const nav = useNavigate()
  const unit = useSettings().sugar_unit
  const [shown, setShown] = useState(PAGE)
  const sorted = useMemo(() => [...days.values()].sort((a, b) => b.day.date.localeCompare(a.day.date)), [days])
  if (sorted.length === 0) return <div className="card empty">{S.noDays}</div>
  return (
    <>
      <div className="card">
        <ul className="list">
          {sorted.slice(0, shown).map(({ day, meals, readings, photos }) => {
            const kcal = dayCalories(day, meals)
            const avg = readings.length ? readings.reduce((s, r) => s + r.value_mmol, 0) / readings.length : null
            const parts = [
              day.weight_kg != null ? `${formatKg(day.weight_kg)} ${S.kg}` : null,
              kcal ? `${formatKcal(kcal.value)} ${S.kcal}` : null,
              avg != null ? `${S.avgSugar} ${formatMmol(avg, unit)} ${unitLabel(unit)}` : null,
            ].filter(Boolean)
            return (
              <li key={day.id}>
                <button className="item" onClick={() => nav(`/day/${day.date}`)}>
                  <div className="grow">
                    <strong>{formatWeekday(day.date)}, {formatDate(day.date)}</strong>
                    {parts.length > 0 && <div className="sub">{parts.join(' · ')}</div>}
                  </div>
                  {photos[0] && <Thumb id={photos[0].id} small />}
                </button>
              </li>
            )
          })}
        </ul>
      </div>
      {shown < sorted.length && <button className="btn" onClick={() => setShown(shown + PAGE)}>{S.showMore}</button>}
    </>
  )
}

export default function Timeline() {
  const [view, setView] = useState<'calendar' | 'list'>('calendar')
  const settings = useSettings()
  const days = useLoggedDays()
  return (
    <Page title={S.tabs.timeline} tabs>
      <Chips label={S.tabs.timeline} value={view} onChange={setView}
        options={[{ value: 'calendar', label: S.calendar }, { value: 'list', label: S.list }]} />
      {days && (view === 'calendar' ? <Calendar days={days} weekStart={settings.week_start} /> : <DayList days={days} />)}
    </Page>
  )
}
