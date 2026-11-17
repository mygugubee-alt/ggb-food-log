import { useEffect, useState, type ChangeEvent } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { getProfilePhoto } from '../db/repo'
import type { NewPhoto } from '../models/types'
import { jpegUrl, processPhoto } from '../services/photos'
import { S } from '../strings/en'
import { Icon } from './icons'
import { useUI } from './ui'

/** Object URL for stored image data. Released when the component goes away. */
export function useStoredUrl(photoId: string | null, kind: 'thumb' | 'image'): string | null {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    if (!photoId) { setUrl(null); return }
    let made: string | null = null
    let cancelled = false
    const load = kind === 'thumb'
      ? db.thumbs.get(photoId).then((r) => r?.thumb)
      : db.images.get(photoId).then((r) => r?.image)
    void load.then((data) => {
      if (cancelled || !data) return
      made = jpegUrl(data)
      setUrl(made)
    })
    return () => {
      cancelled = true
      if (made) URL.revokeObjectURL(made)
      setUrl(null)
    }
  }, [photoId, kind])
  return url
}

/** A thumbnail. Lists use this; full-size images are only loaded by the photo viewer. */
export function Thumb({ id, small, onClick, label }: { id: string; small?: boolean; onClick?: () => void; label?: string }) {
  const url = useStoredUrl(id, 'thumb')
  const cls = `thumb ${small ? 'small' : ''}`
  const img = url ? <img src={url} alt={onClick ? '' : (label ?? S.photo)} /> : null
  return onClick
    ? <button type="button" className={cls} onClick={onClick} aria-label={label ?? S.openPhoto}>{img}</button>
    : <span className={cls}>{img}</span>
}

/** Camera and gallery buttons. Files are resized before they are handed back. */
export function PhotoButtons({ onPhotos }: { onPhotos: (photos: NewPhoto[]) => void | Promise<void> }) {
  const ui = useUI()
  const pick = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (files.length === 0) return
    await ui.run(async () => {
      const out: NewPhoto[] = []
      for (const f of files) out.push(await processPhoto(f))
      await onPhotos(out)
    }, S.processingPhotos)
  }
  return (
    <div className="actions">
      <label className="btn">
        <input className="sr-only" type="file" accept="image/*" capture="environment" onChange={pick} />
        {S.takePhoto}
      </label>
      <label className="btn">
        <input className="sr-only" type="file" accept="image/*" multiple onChange={pick} />
        {S.choosePhotos}
      </label>
    </div>
  )
}

/** The user's own photo in a circle, or a plain person icon when none is set. */
export function Avatar({ large }: { large?: boolean }) {
  const data = useLiveQuery(getProfilePhoto)
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    if (!data) { setUrl(null); return }
    const made = jpegUrl(data)
    setUrl(made)
    return () => URL.revokeObjectURL(made)
  }, [data])
  return (
    <span className={`avatar ${large ? 'large' : ''}`}>
      {url ? <img src={url} alt={S.profilePhoto} /> : <Icon name="user" size={large ? 44 : 22} />}
    </span>
  )
}
