import { useState } from 'react'
import { daysBetween, formatDate, formatShort, formatWeekday } from '../utils/dates'
import { A1C_DIABETES_FROM, A1C_PREDIABETES_FROM, A1C_TONE, a1cBand } from '../services/ranges'
import { S } from '../strings/en'

export interface ChartPoint { x: number; y: number; label: string; tone?: string } // x in days from the start of the week (0 to 7)

const W = 340, H = 190, L = 40, R = 14, T = 14, B = 30

/**
 * One week on the x axis, one series. `connect` draws a line through the points
 * (daily weights); without it the points stand alone (blood sugar readings).
 */
export function WeekChart({ dates, points, connect, refLine, format, summary }: {
  dates: string[]
  points: ChartPoint[]
  connect: boolean
  refLine?: { y: number; label: string } | null
  format: (y: number) => string
  /** Text read out by screen readers in place of the picture. */
  summary: string
}) {
  const [selected, setSelected] = useState<number | null>(null)
  if (points.length === 0) return null
  const ys = [...points.map((p) => p.y), ...(refLine ? [refLine.y] : [])]
  let lo = Math.min(...ys), hi = Math.max(...ys)
  const pad = Math.max((hi - lo) * 0.12, Math.abs(hi) * 0.01, 0.2)
  lo -= pad
  hi += pad
  const px = (x: number) => L + (x / 7) * (W - L - R)
  const py = (y: number) => T + (1 - (y - lo) / (hi - lo)) * (H - T - B)
  const ticks = [lo + pad, (lo + hi) / 2, hi - pad]
  const last = points[points.length - 1]
  const sel = selected != null ? points[selected] : null

  return (
    <figure style={{ margin: 0 }}>
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={summary}>
        {ticks.map((t, i) => (
          <g key={i}>
            <line className="grid" x1={L} x2={W - R} y1={py(t)} y2={py(t)} />
            <text x={L - 6} y={py(t) + 3} textAnchor="end">{format(t)}</text>
          </g>
        ))}
        {dates.map((d, i) => (
          <text key={d} x={px(i + 0.5)} y={H - 14} textAnchor="middle">
            <tspan x={px(i + 0.5)}>{formatWeekday(d)}</tspan>
            <tspan x={px(i + 0.5)} dy="11">{formatShort(d).split(' ')[0]}</tspan>
          </text>
        ))}
        {refLine && (
          <g>
            <line className="ref" x1={L} x2={W - R} y1={py(refLine.y)} y2={py(refLine.y)} />
            <text className="ref-label" x={W - R} y={py(refLine.y) - 4} textAnchor="end">{refLine.label}</text>
          </g>
        )}
        {connect && points.length > 1 && (
          <path className="series-line" d={points.map((p, i) => `${i ? 'L' : 'M'}${px(p.x).toFixed(1)},${py(p.y).toFixed(1)}`).join(' ')} />
        )}
        {points.map((p, i) => (
          <circle key={i} className={`dot ${p.tone ? `tone-${p.tone}` : ''} ${selected === i ? 'selected' : ''}`} cx={px(p.x)} cy={py(p.y)} r={4.5} />
        ))}
        {connect && (
          <text className="end-label" x={Math.min(px(last.x) + 8, W - R)} y={py(last.y) - 9} textAnchor="end">{format(last.y)}</text>
        )}
        {points.map((p, i) => (
          <circle key={`h${i}`} className="hit no-print" cx={px(p.x)} cy={py(p.y)} r={14} tabIndex={0} role="button" aria-label={p.label}
            onClick={() => setSelected(i)} onMouseEnter={() => setSelected(i)} onFocus={() => setSelected(i)} />
        ))}
      </svg>
      <figcaption className="chart-caption no-print" aria-live="polite">{sel ? sel.label : S.chartHint}</figcaption>
    </figure>
  )
}

const A1C_MIN = 4, A1C_MAX = 9

/** The three HbA1c bands on a 4% to 9% scale, with a marker at one result. */
export function A1cBandBar({ value, bands }: { value: number | null; bands: { normal: string; prediabetes: string; diabetes: string } }) {
  const pct = (v: number) => ((Math.min(A1C_MAX, Math.max(A1C_MIN, v)) - A1C_MIN) / (A1C_MAX - A1C_MIN)) * 100
  const a = pct(A1C_PREDIABETES_FROM), b = pct(A1C_DIABETES_FROM)
  return (
    <div className="a1c-bar" aria-hidden="true">
      <div className="a1c-track">
        <span className="seg seg-in_range" style={{ width: `${a}%` }} />
        <span className="seg seg-above" style={{ width: `${b - a}%` }} />
        <span className="seg seg-high" style={{ width: `${100 - b}%` }} />
        {value != null && <span className={`a1c-pin lvl-dot-${A1C_TONE[a1cBand(value)]}`} style={{ left: `${pct(value)}%` }}><b>{value.toFixed(1)}%</b></span>}
      </div>
      <div className="a1c-ticks">{[4, 5, 6, 7, 8, 9].map((t) => <span key={t}>{t}%</span>)}</div>
      <div className="legend" style={{ marginTop: 10 }}>
        <span><i className="key lvl-dot-in_range" />{bands.normal}</span>
        <span><i className="key lvl-dot-above" />{bands.prediabetes}</span>
        <span><i className="key lvl-dot-high" />{bands.diabetes}</span>
      </div>
    </div>
  )
}

/** HbA1c results over time, drawn over the three bands. Needs at least two results. */
export function A1cTrend({ results, summary }: { results: { test_date: string; value_percent: number }[]; summary: string }) {
  const [selected, setSelected] = useState<number | null>(null)
  const pts = [...results].sort((p, q) => p.test_date.localeCompare(q.test_date))
  if (pts.length < 2) return null
  const TW = 340, TH = 200, TL = 34, TR = 16, TT = 14, TB = 26
  const lo = Math.min(4.5, ...pts.map((p) => p.value_percent - 0.4))
  const hi = Math.max(7.5, ...pts.map((p) => p.value_percent + 0.4))
  const span = Math.max(1, daysBetween(pts[0].test_date, pts[pts.length - 1].test_date))
  const px = (d: string) => TL + (daysBetween(pts[0].test_date, d) / span) * (TW - TL - TR)
  const py = (v: number) => TT + (1 - (v - lo) / (hi - lo)) * (TH - TT - TB)
  const band = (from: number, to: number, tone: string) => {
    const top = py(Math.min(hi, to)), bottom = py(Math.max(lo, from))
    return bottom > top ? <rect className={`band band-${tone}`} x={TL} width={TW - TL - TR} y={top} height={bottom - top} /> : null
  }
  const sel = selected != null ? pts[selected] : null
  return (
    <figure style={{ margin: 0 }}>
      <svg className="chart" viewBox={`0 0 ${TW} ${TH}`} role="img" aria-label={summary}>
        {band(lo, A1C_PREDIABETES_FROM, 'in_range')}
        {band(A1C_PREDIABETES_FROM, A1C_DIABETES_FROM, 'above')}
        {band(A1C_DIABETES_FROM, hi, 'high')}
        {[A1C_PREDIABETES_FROM, A1C_DIABETES_FROM].map((t) => (
          <g key={t}><line className="grid" x1={TL} x2={TW - TR} y1={py(t)} y2={py(t)} /><text x={TL - 6} y={py(t) + 3} textAnchor="end">{t.toFixed(1)}</text></g>
        ))}
        <text x={px(pts[0].test_date)} y={TH - 8} textAnchor="start">{formatDate(pts[0].test_date)}</text>
        <text x={px(pts[pts.length - 1].test_date)} y={TH - 8} textAnchor="end">{formatDate(pts[pts.length - 1].test_date)}</text>
        <path className="a1c-line" d={pts.map((p, i) => `${i ? 'L' : 'M'}${px(p.test_date).toFixed(1)},${py(p.value_percent).toFixed(1)}`).join(' ')} />
        {pts.map((p, i) => (
          <circle key={i} className={`dot tone-${A1C_TONE[a1cBand(p.value_percent)]} ${selected === i ? 'selected' : ''}`} cx={px(p.test_date)} cy={py(p.value_percent)} r={5} />
        ))}
        <text className="end-label" x={px(pts[pts.length - 1].test_date)} y={py(pts[pts.length - 1].value_percent) - 10} textAnchor="end">{pts[pts.length - 1].value_percent.toFixed(1)}%</text>
        {pts.map((p, i) => (
          <circle key={`h${i}`} className="hit" cx={px(p.test_date)} cy={py(p.value_percent)} r={14} tabIndex={0} role="button"
            aria-label={`${formatDate(p.test_date)}: ${p.value_percent.toFixed(1)}%`}
            onClick={() => setSelected(i)} onMouseEnter={() => setSelected(i)} onFocus={() => setSelected(i)} />
        ))}
      </svg>
      <figcaption className="chart-caption" aria-live="polite">{sel ? `${formatDate(sel.test_date)} · ${sel.value_percent.toFixed(1)}%` : S.chartHint}</figcaption>
    </figure>
  )
}
