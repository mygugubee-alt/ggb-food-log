import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { listA1c, saveA1c } from '../db/repo'
import type { A1cResult } from '../models/types'
import { S } from '../strings/en'
import { formatDate, isValidDate, todayKL } from '../utils/dates'
import { parseA1c } from '../utils/units'
import { A1cBandBar, A1cTrend } from '../components/charts'
import { useSettings } from '../components/hooks'
import { Badge } from '../components/icons'
import { A1C_TONE, a1cBand, a1cToMmolMol } from '../services/ranges'
import { Field, Page, useDelete, useUI } from '../components/ui'

interface Draft { id: string | null; value: string; date: string; note: string }
const blank = (): Draft => ({ id: null, value: '', date: todayKL(), note: '' })

/** HbA1c blood test results: the value and the date the test was taken. */
export default function A1c() {
  const ui = useUI()
  const del = useDelete()
  const results = useLiveQuery(listA1c)
  const rated = useSettings().range_mode !== 'off'
  const latest = results?.[0] ?? null
  const [draft, setDraft] = useState<Draft>(blank)
  const [errors, setErrors] = useState<{ value?: string; date?: string }>({})
  const set = (patch: Partial<Draft>) => setDraft({ ...draft, ...patch })
  const today = todayKL()

  const save = async () => {
    const value = parseA1c(draft.value)
    const problems: { value?: string; date?: string } = {}
    if (value == null) problems.value = S.a1c.valueError
    if (!isValidDate(draft.date) || draft.date > today) problems.date = S.a1c.dateError
    setErrors(problems)
    if (value == null || problems.date) return
    const done = await ui.run(() => saveA1c({ id: draft.id ?? undefined, test_date: draft.date, value_percent: value, note: draft.note }))
    if (!done) return
    setDraft(blank())
    ui.toast(S.a1c.saved)
  }
  const edit = (r: A1cResult) => {
    setErrors({})
    setDraft({ id: r.id, value: r.value_percent.toFixed(1), date: r.test_date, note: r.note })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  const remove = async () => {
    if (draft.id && (await del('a1c', draft.id, S.a1c.confirmDelete))) setDraft(blank())
  }

  return (
    <Page title={S.a1c.title} back>
      <p className="sub">{S.a1c.intro}</p>
      {rated && (
        <div className="card stack">
          <h2 style={{ marginBottom: 0 }}>{latest ? S.a1c.latestTitle(formatDate(latest.test_date)) : S.a1c.bandsTitle}</h2>
          {latest && (
            <div className="spread">
              <span><span className={`big lvl-${A1C_TONE[a1cBand(latest.value_percent)]}`}>{latest.value_percent.toFixed(1)}</span> <span className="sub">% · {a1cToMmolMol(latest.value_percent)} mmol/mol</span></span>
              <span className={`level lvl-bg-${A1C_TONE[a1cBand(latest.value_percent)]}`}>{S.a1c.band[a1cBand(latest.value_percent)]}</span>
            </div>
          )}
          <A1cBandBar value={latest?.value_percent ?? null} bands={S.a1c.bandShort} />
          <p className="sr-only">{S.a1c.bandsText}</p>
          <p className="muted">{S.a1c.bandsNote}</p>
        </div>
      )}
      {results && results.length >= 2 && (
        <div className="card">
          <h2>{S.a1c.trend}</h2>
          {rated
            ? <A1cTrend results={results} summary={S.a1c.trendSummary(results.length)} />
            : <p className="muted">{S.a1c.trendOff}</p>}
        </div>
      )}
      <div className="card stack">
        <h2 style={{ marginBottom: 0 }}>{draft.id ? S.a1c.editResult : S.a1c.addResult}</h2>
        <Field label={S.a1c.value} htmlFor="a1c-value" error={errors.value}>
          <div className="input-row">
            <input id="a1c-value" className="input" inputMode="decimal" autoComplete="off" placeholder="6.5"
              value={draft.value} onChange={(e) => set({ value: e.target.value })} />
            <strong>%</strong>
          </div>
        </Field>
        <Field label={S.a1c.date} htmlFor="a1c-date" error={errors.date}>
          <input id="a1c-date" className="input" type="date" max={today} value={draft.date} onChange={(e) => set({ date: e.target.value })} />
        </Field>
        <Field label={`${S.note} (${S.optional})`} htmlFor="a1c-note">
          <input id="a1c-note" className="input" autoComplete="off" placeholder={S.a1c.notePlaceholder}
            value={draft.note} onChange={(e) => set({ note: e.target.value })} />
        </Field>
        <div className="actions">
          {draft.id && <button className="btn" onClick={() => { setDraft(blank()); setErrors({}) }}>{S.cancel}</button>}
          <button className="btn primary" onClick={() => { void save() }}>{S.save}</button>
        </div>
        {draft.id && <button className="btn danger" onClick={() => { void remove() }}>{S.a1c.deleteResult}</button>}
      </div>

      <div className="card">
        <h2>{S.a1c.history}</h2>
        {!results || results.length === 0 ? <p className="muted">{S.a1c.none}</p> : (
          <ul className="list">
            {results.map((r) => (
              <li key={r.id}>
                <button className="item" onClick={() => edit(r)} aria-label={`${S.a1c.editResult}: ${r.value_percent.toFixed(1)}%, ${formatDate(r.test_date)}`}>
                  <Badge name="flask" tone="blue" />
                  <div className="grow">
                    <div className="spread">
                      <span><strong className={`num ${rated ? `lvl-${A1C_TONE[a1cBand(r.value_percent)]}` : ''}`}>{r.value_percent.toFixed(1)}</strong> <span className="sub">%</span></span>
                      {rated && <span className={`level lvl-bg-${A1C_TONE[a1cBand(r.value_percent)]}`}>{S.a1c.band[a1cBand(r.value_percent)]}</span>}
                    </div>
                    <div className="sub">{formatDate(r.test_date)} · {a1cToMmolMol(r.value_percent)} mmol/mol</div>
                    {r.note && <div className="sub pre">{r.note}</div>}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Page>
  )
}
