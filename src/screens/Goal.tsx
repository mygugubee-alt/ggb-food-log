import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { getGoalChanges, setGoal } from '../db/repo'
import { S } from '../strings/en'
import { formatDateTime } from '../utils/dates'
import { formatKg, parseWeight } from '../utils/units'
import { Field, goBack, Page, useUI } from '../components/ui'

export default function Goal() {
  const nav = useNavigate()
  const ui = useUI()
  const history = useLiveQuery(getGoalChanges)
  const current = history ? (history[0]?.dream_weight_kg ?? null) : undefined
  const [text, setText] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    if (current !== undefined && text === null) setText(current == null ? '' : formatKg(current))
  }, [current, text])

  if (history === undefined || text === null) return <Page title={S.goalTitle} back><span /></Page>
  const shown = current == null ? '' : formatKg(current)
  const dirty = text.trim() !== shown

  const cancel = async () => {
    if (!dirty || (await ui.confirm(S.discardConfirm, S.discard, true))) goBack(nav)
  }
  const save = async () => {
    const value = parseWeight(text)
    if (value == null) { setError(S.weightError); return }
    setError(null)
    if ((await ui.run(() => setGoal(value))) !== undefined) {
      ui.toast(S.goalSaved)
      goBack(nav)
    }
  }
  const clear = async () => {
    if (!(await ui.confirm(S.confirmClearGoal, S.clear, true))) return
    await ui.run(() => setGoal(null))
    setText('')
  }

  return (
    <Page title={S.goalTitle} back={() => { void cancel() }}>
      <div className="card stack">
        <Field label={S.goalField} htmlFor="goal" error={error}>
          <input id="goal" className="input" inputMode="decimal" autoComplete="off" value={text}
            onChange={(e) => setText(e.target.value)} />
        </Field>
        <p className="muted">{S.goalNote}</p>
      </div>
      <div className="actions">
        <button className="btn" onClick={() => { void cancel() }}>{S.cancel}</button>
        <button className="btn primary" disabled={!dirty} onClick={() => { void save() }}>{S.save}</button>
      </div>
      <div className="card">
        <h2>{S.goalHistory}</h2>
        {history.length === 0 ? <p className="muted">{S.noGoalHistory}</p> : (
          <ul className="list">
            {history.map((g) => (
              <li key={g.id} className="spread" style={{ minHeight: 44 }}>
                <strong>{g.dream_weight_kg == null ? S.goalCleared : `${formatKg(g.dream_weight_kg)} ${S.kg}`}</strong>
                <span className="sub">{formatDateTime(g.changed_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      {current != null && <button className="btn danger" onClick={() => { void clear() }}>{S.clearGoal}</button>}
    </Page>
  )
}
