import { useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { loadDayBundle } from '../db/repo'
import { S } from '../strings/en'
import { formatDate } from '../utils/dates'
import { useStoredUrl } from '../components/photos'
import { mealTitle } from '../components/rows'
import { goBack, useDelete } from '../components/ui'

export default function PhotoViewer() {
  const { id = '' } = useParams()
  const nav = useNavigate()
  const del = useDelete()
  const touchX = useRef<number | null>(null)
  const url = useStoredUrl(id, 'image')
  const data = useLiveQuery(async () => {
    const photo = await db.photos.get(id)
    const day = photo && !photo.deleted_at ? await db.days.get(photo.day_id) : undefined
    if (!photo || !day) return null
    const bundle = await loadDayBundle(day.date)
    // Meal order, then photo order, with the day's own photos last.
    const ordered = [
      ...bundle.meals.flatMap((m) => bundle.photos.filter((p) => p.meal_id === m.id)),
      ...bundle.photos.filter((p) => p.meal_id == null),
    ]
    return { photo, date: day.date, ordered, meal: bundle.meals.find((m) => m.id === photo.meal_id) ?? null }
  }, [id])

  const close = () => goBack(nav)
  if (data === undefined) return <div className="viewer" />
  if (data === null) {
    return <div className="viewer"><div className="viewer-bar"><button className="icon-btn" aria-label={S.close} onClick={close}>×</button><span>{S.notFound}</span></div></div>
  }
  const index = data.ordered.findIndex((p) => p.id === id)
  const prev = index > 0 ? data.ordered[index - 1].id : null
  const next = index >= 0 && index < data.ordered.length - 1 ? data.ordered[index + 1].id : null
  const show = (other: string | null) => { if (other) nav(`/photo/${other}`, { replace: true }) }
  const zoomed = () => (window.visualViewport?.scale ?? 1) > 1.05

  const remove = async () => {
    if (!(await del('photo', id, S.confirmDeletePhoto))) return
    if (next ?? prev) show(next ?? prev)
    else close()
  }

  return (
    <div className="viewer">
      <div className="viewer-bar">
        <button className="icon-btn" aria-label={S.close} onClick={close}>×</button>
        <div className="grow">
          <div>{formatDate(data.date)}</div>
          <div style={{ opacity: 0.8, fontSize: '0.9rem' }}>{data.meal ? mealTitle(data.meal) : S.dayPhoto}</div>
        </div>
        <span>{S.photoCount(index + 1, data.ordered.length)}</span>
      </div>
      <div className="viewer-img"
        onTouchStart={(e) => { touchX.current = e.touches.length === 1 ? e.touches[0].clientX : null }}
        onTouchEnd={(e) => {
          const start = touchX.current
          touchX.current = null
          if (start == null || zoomed()) return
          const dx = e.changedTouches[0].clientX - start
          if (dx < -60) show(next)
          if (dx > 60) show(prev)
        }}>
        {url && <img src={url} alt={data.meal ? `${S.photo}: ${mealTitle(data.meal)}` : S.dayPhoto} />}
      </div>
      <div className="viewer-bar">
        <button className="btn" aria-label={S.prevPhoto} disabled={!prev} onClick={() => show(prev)}>‹</button>
        <button className="btn" aria-label={S.nextPhoto} disabled={!next} onClick={() => show(next)}>›</button>
        <span className="grow" />
        <button className="btn" onClick={() => { void remove() }}>{S.deletePhoto}</button>
      </div>
    </div>
  )
}
