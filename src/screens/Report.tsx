import { useMemo, useState, type ReactNode } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { currentGoal, loadRange } from '../db/repo'
import { Link } from 'react-router-dom'
import { isLow, levelOf, type Level } from '../services/ranges'
import { computeWeeklyReport } from '../services/report'
import { S } from '../strings/en'
import { addDays, daysBetween, formatDate, formatShort, formatWeekday, klParts, todayKL, weekDates, weekStartOf } from '../utils/dates'
import { displayReading, formatKcal, formatKg, formatMmol, MGDL_PER_MMOL, roundTo, unitLabel } from '../utils/units'
import { MEAL_TYPES } from '../models/types'
import { WeekChart, type ChartPoint } from '../components/charts'
import { Icon, type IconName } from '../components/icons'
import { useSettings } from '../components/hooks'
import { mealTitle } from '../components/rows'
import { Page } from '../components/ui'

function Section({ title, icon, empty, children }: { title: string; icon: IconName; empty: boolean; children: ReactNode }) {
  return (
    <section className="card">
      <h2><Icon name={icon} size={16} />{title}</h2>
      {empty ? <p className="muted">{S.noData}</p> : children}
    </section>
  )
}
const Stat = ({ label, value }: { label: string; value: string }) => (<><dt>{label}</dt><dd>{value}</dd></>)
const signed = (n: number): string => `${n > 0 ? '+' : ''}${roundTo(n, 1).toFixed(1)}`

export default function Report() {
  const settings = useSettings()
  const unit = settings.sugar_unit
  const today = todayKL()
  /** Weeks back from the current week. 1 = the most recent full week. */
  const [back, setBack] = useState(1)
  const start = addDays(weekStartOf(today, settings.week_start), -7 * back)
  const dates = useMemo(() => weekDates(start), [start])
  const end = dates[6]
  const data = useLiveQuery(async () => ({ range: await loadRange(start, end), goal: await currentGoal() }), [start, end])
  const report = useMemo(
    () => (data ? computeWeeklyReport(dates, data.range.days, data.range.meals, data.range.readings, data.range.photos, data.range.activities) : null),
    [data, dates],
  )
  const title = `${formatDate(start)} – ${formatDate(end)}`
  const { weight, sugar, food, activity } = report ?? { weight: null, sugar: null, food: null, activity: null }

  const weightPoints: ChartPoint[] = weight?.series.map((p) => ({
    x: daysBetween(start, p.date) + 0.5, y: p.value,
    label: `${formatWeekday(p.date)} ${formatShort(p.date)} · ${formatKg(p.value)} ${S.kg}`,
  })) ?? []
  const rangesOn = settings.range_mode !== 'off'
  const levels: Level[] = sugar && rangesOn ? sugar.readings.map((r) => levelOf(r, settings)).filter((l) => l != null) : []
  const countLevel = (test: (l: Level) => boolean) => levels.filter(test).length
  const toUnit = (mmol: number) => (unit === 'mmol_l' ? mmol : mmol * MGDL_PER_MMOL)
  const sugarPoints: ChartPoint[] = sugar?.readings.map((r) => {
    const p = klParts(r.measured_at)
    const [h, m] = p.time.split(':').map(Number)
    return {
      x: daysBetween(start, p.date) + (h * 60 + m) / 1440, y: toUnit(r.value_mmol),
      tone: rangesOn ? (levelOf(r, settings) ?? 'none') : undefined,
      label: `${formatWeekday(p.date)} ${formatShort(p.date)}, ${p.time} · ${displayReading(r, unit)} ${unitLabel(unit)}${r.context ? ` · ${S.context[r.context]}` : ''}${rangesOn && levelOf(r, settings) ? ` · ${S.level[levelOf(r, settings) as Level]}` : ''}`,
    }
  }) ?? []

  return (
    <Page title={S.reportTitle} tabs>
      <h2 className="print-only">{S.appName}: {S.reportTitle}</h2>
      <div className="date-switch no-print">
        <button className="icon-btn" aria-label={S.prevWeek} onClick={() => setBack(back + 1)}>‹</button>
        <div className="label">{title}</div>
        <button className="icon-btn" aria-label={S.nextWeek} disabled={back === 0} onClick={() => setBack(back - 1)}>›</button>
      </div>
      <p className="print-only"><strong>{title}</strong></p>
      {report && (
        <>
          <p className="sub" style={{ textAlign: 'center' }}>
            {S.daysLogged(report.loggedDays)}{back === 0 ? ` · ${S.weekInProgress}` : ''}
          </p>

          <Section icon="scale" title={S.weight} empty={!weight}>
            {weight && (
              <>
                <dl className="stats">
                  <Stat label={`${S.firstWeight} (${formatShort(weight.first.date)})`} value={`${formatKg(weight.first.value)} ${S.kg}`} />
                  <Stat label={`${S.lastWeight} (${formatShort(weight.last.date)})`} value={`${formatKg(weight.last.value)} ${S.kg}`} />
                  <Stat label={S.change} value={weight.change == null ? S.notEnough : `${signed(weight.change)} ${S.kg}`} />
                  <Stat label={S.averageOf(weight.daysUsed, 'days')} value={`${formatKg(weight.average)} ${S.kg}`} />
                  <Stat label={S.lowest} value={`${formatKg(weight.min)} ${S.kg}`} />
                  <Stat label={S.highest} value={`${formatKg(weight.max)} ${S.kg}`} />
                  <Stat label={S.daysWithWeight} value={String(weight.daysUsed)} />
                </dl>
                <WeekChart dates={dates} points={weightPoints} connect format={(y) => y.toFixed(1)}
                  refLine={data?.goal != null ? { y: data.goal, label: S.dreamWeightLine(formatKg(data.goal)) } : null}
                  summary={S.weightChartSummary(weight.daysUsed, formatKg(weight.first.value), formatKg(weight.last.value))} />
              </>
            )}
          </Section>

          <Section icon="drop" title={`${S.bloodSugar} (${unitLabel(unit)})`} empty={!sugar}>
            {sugar && (
              <>
                <dl className="stats">
                  <Stat label={S.readingsCount} value={String(sugar.count)} />
                  <Stat label={S.averageOf(sugar.count, 'readings')} value={formatMmol(sugar.average, unit)} />
                  <Stat label={S.lowest} value={displayReading(sugar.min, unit)} />
                  <Stat label={S.highest} value={displayReading(sugar.max, unit)} />
                  {sugar.byContext.map((c) => (
                    <Stat key={c.context} label={S.averageFor(c.context === 'none' ? S.noContext : S.context[c.context], c.count)} value={formatMmol(c.average, unit)} />
                  ))}
                  <Stat label={S.daysWithReadings} value={String(sugar.daysWith)} />
                  {levels.length > 0 && (
                    <>
                      <Stat label={S.level.in_range} value={S.ofRated(countLevel((l) => l === 'in_range'), levels.length)} />
                      <Stat label={S.level.above} value={String(countLevel((l) => l === 'above'))} />
                      <Stat label={S.level.high} value={String(countLevel((l) => l === 'high'))} />
                      <Stat label={S.level.low} value={String(countLevel(isLow))} />
                    </>
                  )}
                </dl>
                {rangesOn && levels.length < sugar.count && <p className="muted" style={{ marginTop: 6 }}>{S.notRated(sugar.count - levels.length)}</p>}
                <WeekChart dates={dates} points={sugarPoints} connect={false}
                  format={(y) => (unit === 'mmol_l' ? y.toFixed(1) : String(Math.round(y)))}
                  summary={S.sugarChartSummary(sugar.count, displayReading(sugar.min, unit), displayReading(sugar.max, unit), unitLabel(unit))} />
                {rangesOn && (
                  <div className="legend" style={{ marginTop: 6 }}>
                    {(['in_range', 'above', 'high', 'low'] as const).map((l) => <span key={l}><i className={`key lvl-dot-${l}`} />{S.level[l]}</span>)}
                    <span><i className="key lvl-dot-none" />{S.levelNone}</span>
                    <Link to="/ranges" className="no-print">{S.ranges.link}</Link>
                  </div>
                )}
              </>
            )}
          </Section>

          <Section icon="utensils" title={S.food} empty={!food}>
            {food && (
              <>
                <dl className="stats">
                  <Stat label={S.mealsLogged} value={String(food.mealCount)} />
                  {MEAL_TYPES.map((t) => <Stat key={t} label={S.mealType[t]} value={String(food.byType[t])} />)}
                  <Stat label={S.daysWithPhotos} value={String(food.daysWithPhotos)} />
                  {food.calories && (
                    <>
                      <Stat label={S.avgDailyCalories(food.calories.daysUsed)} value={`${formatKcal(food.calories.average)} ${S.kcal}`} />
                      <Stat label={S.totalCalories} value={`${formatKcal(food.calories.total)} ${S.kcal}`} />
                    </>
                  )}
                </dl>
                {food.days.map((d) => (
                  <div key={d.date} style={{ marginTop: 12 }}>
                    <strong>{formatWeekday(d.date)}, {formatShort(d.date)}</strong>
                    <ul className="list">
                      {d.meals.map((m) => (
                        <li key={m.id} style={{ padding: '6px 0' }}>
                          <span className="sub">{mealTitle(m)}</span>
                          {m.description && <div className="pre">{m.description}</div>}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </>
            )}
          </Section>

          <Section icon="pulse" title={S.activity} empty={!activity}>
            {activity && (
              <dl className="stats">
                <Stat label={S.act.daysWith} value={String(activity.days)} />
                {activity.count > 0 && (
                  <>
                    <Stat label={S.act.count} value={String(activity.count)} />
                    <Stat label={S.act.totalMinutes} value={`${activity.minutes} ${S.act.min}`} />
                    <Stat label={S.act.totalBurned} value={`${formatKcal(activity.kcal)} ${S.kcal}`} />
                  </>
                )}
              </dl>
            )}
          </Section>

          <Section icon="note" title={S.notes} empty={report.notes.length === 0}>
            <ul className="list">
              {report.notes.map((n) => (
                <li key={n.date} style={{ padding: '6px 0' }}>
                  <span className="sub">{formatWeekday(n.date)}, {formatShort(n.date)}</span>
                  <div className="pre">{n.note}</div>
                </li>
              ))}
            </ul>
          </Section>

          <button className="btn primary no-print" onClick={() => window.print()}>{S.print}</button>
          <p className="muted no-print">{S.reminderHint}</p>
          <p className="print-only print-footer">{S.printFooter}</p>
        </>
      )}
    </Page>
  )
}
