import { useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { S } from '../strings/en'
import { formatDate, formatWeekday, todayKL } from '../utils/dates'
import { Thumb } from '../components/photos'
import { mealTitle } from '../components/rows'
import { Page } from '../components/ui'
import { useLoggedDays } from './Timeline'

interface Result { key: string; date: string; kind: string; text: string; photoId: string | null }

/** Substring match (not word-based), so Chinese text is found. English ignores case. */
const matches = (text: string, q: string): boolean => text.toLowerCase().includes(q)

function highlight(text: string, q: string): ReactNode {
  if (!q) return text
  const lower = text.toLowerCase()
  const out: ReactNode[] = []
  let from = 0
  for (;;) {
    const at = lower.indexOf(q, from)
    if (at < 0) break
    out.push(text.slice(from, at), <mark key={at}>{text.slice(at, at + q.length)}</mark>)
    from = at + q.length
  }
  out.push(text.slice(from))
  return out
}

export default function Search() {
  const nav = useNavigate()
  const days = useLoggedDays()
  const [query, setQuery] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [photos, setPhotos] = useState(false)
  const [weight, setWeight] = useState(false)
  const [sugar, setSugar] = useState(false)
  const q = query.trim().toLowerCase()
  const active = q !== '' || from !== '' || to !== '' || photos || weight || sugar

  const results = useMemo<Result[]>(() => {
    if (!days || !active) return []
    const out: Result[] = []
    const sorted = [...days.values()].sort((a, b) => b.day.date.localeCompare(a.day.date))
    for (const info of sorted) {
      const { day } = info
      if (from && day.date < from) continue
      if (to && day.date > to) continue
      if (photos && info.photos.length === 0) continue
      if (weight && day.weight_kg == null) continue
      if (sugar && info.readings.length === 0) continue
      const photoId = info.photos[0]?.id ?? null
      const add = (key: string, kind: string, text: string) => out.push({ key: `${day.id}-${key}`, date: day.date, kind, text, photoId })
      if (!q) {
        // Filters only: one line per day.
        add('day', S.kind.day, info.meals.map((m) => m.description).filter(Boolean).join(' · ') || day.day_note)
        continue
      }
      info.meals.forEach((m) => { if (matches(m.description, q)) add(m.id, mealTitle(m), m.description) })
      if (matches(day.day_note, q)) add('note', S.kind.dayNote, day.day_note)
      info.activities.forEach((a) => { if (matches(a.name, q)) add(a.id, S.kind.activity, `${a.name} · ${a.minutes} ${S.act.min}`) })
      info.readings.forEach((r) => { if (matches(r.note, q)) add(r.id, S.kind.readingNote, r.note) })
    }
    return out
  }, [days, active, q, from, to, photos, weight, sugar])

  const today = todayKL()
  return (
    <Page title={S.tabs.search} tabs>
      <input className="input" type="search" placeholder={S.searchPlaceholder} aria-label={S.searchPlaceholder}
        value={query} onChange={(e) => setQuery(e.target.value)} autoComplete="off" />
      <div className="actions">
        <label className="field grow"><span className="label">{S.from}</span>
          <input className="input" type="date" max={to || today} value={from} onChange={(e) => setFrom(e.target.value)} /></label>
        <label className="field grow"><span className="label">{S.to}</span>
          <input className="input" type="date" min={from} max={today} value={to} onChange={(e) => setTo(e.target.value)} /></label>
      </div>
      <div className="chips">
        <button className="chip" aria-pressed={photos} onClick={() => setPhotos(!photos)}>{S.hasPhotos}</button>
        <button className="chip" aria-pressed={weight} onClick={() => setWeight(!weight)}>{S.hasWeight}</button>
        <button className="chip" aria-pressed={sugar} onClick={() => setSugar(!sugar)}>{S.hasSugar}</button>
      </div>
      {!active && <p className="muted">{S.searchHint}</p>}
      {active && days && (
        <>
          <p className="sub" role="status">{results.length === 0 ? S.noResults : S.resultCount(results.length)}</p>
          {results.length > 0 && (
            <div className="card">
              <ul className="list">
                {results.slice(0, 200).map((r) => (
                  <li key={r.key}>
                    <button className="item" onClick={() => nav(`/day/${r.date}`)}>
                      <div className="grow">
                        <strong>{formatWeekday(r.date)}, {formatDate(r.date)}</strong>
                        <div className="sub">{r.kind}</div>
                        {r.text && <div className="pre">{highlight(r.text, q)}</div>}
                      </div>
                      {r.photoId && <Thumb id={r.photoId} small />}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </Page>
  )
}
