import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { burnedKcal, isLogged, latestWeight, listA1c, loadDayBundle } from '../db/repo'
import { dayCalories } from '../services/calories'
import { A1C_TONE, a1cBand } from '../services/ranges'
import { S } from '../strings/en'
import { addDays, formatDate, formatShort, formatWeekday, isValidDate, todayKL } from '../utils/dates'
import { formatKcal, formatKg, roundTo } from '../utils/units'
import { useExportDue, useSettings } from '../components/hooks'
import { Badge, Icon } from '../components/icons'
import { Thumb } from '../components/photos'
import { ActivitySummary, GoalCard, MealSummary, ReadingSummary } from '../components/rows'
import { Page } from '../components/ui'

function ExportPrompt() {
  const { due, days } = useExportDue()
  const key = `export-prompt-dismissed-${todayKL()}`
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(key) === '1')
  if (!due || dismissed) return null
  return (
    <div className="banner">
      <Link className="grow" to="/settings">{S.exportDue(days)}</Link>
      <button className="link" onClick={() => { localStorage.setItem(key, '1'); setDismissed(true) }}>{S.dismiss}</button>
    </div>
  )
}

export default function Today() {
  const today = todayKL()
  const [params, setParams] = useSearchParams()
  const asked = params.get('date')
  const date = asked && isValidDate(asked) && asked <= today ? asked : today
  const nav = useNavigate()
  const settings = useSettings()
  const bundle = useLiveQuery(() => loadDayBundle(date), [date])
  const previous = useLiveQuery(() => latestWeight(date, false), [date])
  const latestA1c = useLiveQuery(async () => (await listA1c())[0] ?? null)
  const [revealed, setRevealed] = useState(false)
  useEffect(() => setRevealed(false), [date])

  const go = (d: string) => setParams(d === today ? {} : { date: d }, { replace: true })
  const edit = () => nav(`/day/${date}`)
  const day = bundle?.day ?? null
  const kcal = bundle ? dayCalories(day, bundle.meals) : null
  const burned = bundle ? burnedKcal(bundle.activities) : null
  const dayPhotos = bundle?.photos.filter((p) => p.meal_id == null) ?? []
  const diff = day?.weight_kg != null && previous ? roundTo(day.weight_kg - previous.weight_kg, 1) : null

  return (
    <Page title={S.today} tabs>
      <GoalCard />
      <ExportPrompt />
      <div className="date-switch">
        <button className="icon-btn" aria-label={S.prevDay} onClick={() => go(addDays(date, -1))}>‹</button>
        <div className="label">{formatWeekday(date)}, {formatDate(date)}</div>
        <button className="icon-btn" aria-label={S.nextDay} disabled={date >= today} onClick={() => go(addDays(date, 1))}>›</button>
        <button className="btn" disabled={date === today} onClick={() => go(today)}>{S.today}</button>
      </div>

      <button className="btn primary large" onClick={() => nav(`/meal/new?date=${date}`)}><Icon name="plus" />{S.addMealPlain}</button>
      <div className="actions">
        <button className="tile" onClick={() => nav(`/day/${date}?focus=weight`)}><Badge name="scale" tone="green" />{S.logWeight}</button>
        <button className="tile" onClick={() => nav(`/sugar/new?date=${date}`)}><Badge name="drop" tone="blue" />{S.logSugar}</button>
      </div>
      <button className="tile" onClick={() => nav(`/activity/new?date=${date}`)}><Badge name="pulse" tone="green" /><span className="grow">{S.act.add}</span><span className="chev"><Icon name="chevron" size={18} /></span></button>

      <button className="tile" onClick={() => nav('/a1c')}>
        <Badge name="flask" tone="plain" />
        <span className="grow">
          {S.a1c.title}
          <span className="sub" style={{ display: 'block', fontWeight: 400 }}>{latestA1c ? S.a1c.latest(latestA1c.value_percent.toFixed(1), formatShort(latestA1c.test_date)) : S.a1c.record}</span>
        </span>
        {latestA1c && settings.range_mode !== 'off' && <span className={`level lvl-bg-${A1C_TONE[a1cBand(latestA1c.value_percent)]}`}>{S.a1c.band[a1cBand(latestA1c.value_percent)]}</span>}
        <span className="chev"><Icon name="chevron" size={18} /></span>
      </button>

      {bundle && !isLogged(bundle) && (
        <div className="card empty">
          <svg viewBox="0 0 120 80" width="120" height="80" aria-hidden="true">
            <ellipse className="plate-shadow" cx="60" cy="66" rx="42" ry="6" />
            <circle className="plate" cx="60" cy="40" r="30" />
            <circle className="plate-rim" cx="60" cy="40" r="20" />
            <path className="plate-tool" d="M16 18v44M11 18v12a5 5 0 0 0 10 0V18M104 18c-5 4-7 12-7 22h7v22" />
          </svg>
          <div>{date === today ? S.startToday : S.nothingLogged}</div>
        </div>
      )}

      {bundle && isLogged(bundle) && (
        <>
          {(day?.weight_kg != null || kcal || burned != null) && (
            <button className="card" onClick={edit}>
              <div className="metrics">
                {day?.weight_kg != null && (
                  <div>
                    <h2><Icon name="scale" size={16} />{S.weight}</h2>
                    <div className="big">{formatKg(day.weight_kg)} <span className="sub">{S.kg}</span></div>
                    {diff != null && previous && (
                      <div className="sub">{S.changeVs(`${diff > 0 ? '+' : ''}${diff.toFixed(1)}`, formatShort(previous.date))}</div>
                    )}
                  </div>
                )}
                {kcal && (
                  <div>
                    <h2><Icon name="flame" size={16} />{S.eaten}</h2>
                    <div className="big">{formatKcal(kcal.value)} <span className="sub">{S.kcal}</span></div>
                  </div>
                )}
                {burned != null && (
                  <div>
                    <h2><Icon name="pulse" size={16} />{S.burned}</h2>
                    <div className="big">{formatKcal(burned)} <span className="sub">{S.kcal}</span></div>
                    <div className="sub">{S.estimate}</div>
                  </div>
                )}
                {kcal && burned != null && (
                  <div>
                    <h2>{S.difference}</h2>
                    <div className="big">{formatKcal(kcal.value - burned)} <span className="sub">{S.kcal}</span></div>
                    <div className="sub">{S.differenceNote}</div>
                  </div>
                )}
              </div>
            </button>
          )}

          {bundle.activities.length > 0 && (
            <div className="card">
              <h2><Icon name="pulse" size={16} />{S.act.title}</h2>
              <ul className="list">
                {bundle.activities.map((a) => (
                  <li key={a.id}><button className="item" onClick={edit}><ActivitySummary activity={a} /></button></li>
                ))}
              </ul>
            </div>
          )}

          {bundle.readings.length > 0 && (
            <div className="card">
              <div className="spread">
                <h2><Icon name="drop" size={16} />{S.bloodSugar}</h2>
                {settings.hide_sugar && revealed && <button className="link" onClick={() => setRevealed(false)}>{S.hideReadings}</button>}
              </div>
              {settings.hide_sugar && !revealed ? (
                <button className="item" onClick={() => setRevealed(true)}>{S.readingsHidden(bundle.readings.length)}</button>
              ) : (
                <ul className="list">
                  {bundle.readings.map((r) => (
                    <li key={r.id}><button className="item" onClick={edit}><ReadingSummary reading={r} settings={settings} /></button></li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {bundle.meals.length > 0 && (
            <div className="card">
              <h2><Icon name="utensils" size={16} />{S.meals}</h2>
              <ul className="list">
                {bundle.meals.map((m) => (
                  <li key={m.id}>
                    <button className="item" onClick={edit}>
                      <MealSummary meal={m} photos={bundle.photos.filter((p) => p.meal_id === m.id)} />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {(day?.day_note || dayPhotos.length > 0) && (
            <button className="card" onClick={edit}>
              <div className="stack">
                {day?.day_note && <div><h2><Icon name="note" size={16} />{S.dayNote}</h2><div className="pre">{day.day_note}</div></div>}
                {dayPhotos.length > 0 && <div><h2><Icon name="camera" size={16} />{S.photos}</h2><div className="thumbs">{dayPhotos.map((p) => <Thumb key={p.id} id={p.id} small />)}</div></div>}
              </div>
            </button>
          )}

          <button className="btn" onClick={edit}>{S.editDay}</button>
        </>
      )}
    </Page>
  )
}
