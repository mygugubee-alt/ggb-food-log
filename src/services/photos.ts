import type { NewPhoto } from '../models/types'

export const MAX_IMAGE_PX = 1280
export const MAX_THUMB_PX = 320
export const JPEG_QUALITY = 0.7

function loadImage(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob)
    const img = new Image()
    img.onload = () => { URL.revokeObjectURL(url); resolve(img) }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('This file could not be read as a photo.')) }
    img.src = url
  })
}

/** Draws the image no larger than `max` on its longest side. The browser applies the photo's rotation. */
async function drawJpeg(img: HTMLImageElement, max: number): Promise<{ data: ArrayBuffer; width: number; height: number }> {
  const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight))
  const width = Math.max(1, Math.round(img.naturalWidth * scale))
  const height = Math.max(1, Math.round(img.naturalHeight * scale))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('The photo could not be processed.')
  ctx.fillStyle = '#fff' // JPEG has no transparency
  ctx.fillRect(0, 0, width, height)
  ctx.drawImage(img, 0, 0, width, height)
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', JPEG_QUALITY))
  canvas.width = canvas.height = 0 // release memory on iOS
  if (!blob) throw new Error('The photo could not be processed.')
  return { data: await blob.arrayBuffer(), width, height }
}

/** Resizes a picked file to the stored size and makes its thumbnail. The original is not kept. */
export async function processPhoto(file: Blob): Promise<NewPhoto> {
  const img = await loadImage(file)
  const full = await drawJpeg(img, MAX_IMAGE_PX)
  const thumb = await drawJpeg(img, MAX_THUMB_PX)
  return { image: full.data, thumb: thumb.data, width: full.width, height: full.height }
}

/** Thumbnail for an already-resized image (used by import). */
export async function makeThumb(image: ArrayBuffer): Promise<ArrayBuffer> {
  const img = await loadImage(new Blob([image], { type: 'image/jpeg' }))
  return (await drawJpeg(img, MAX_THUMB_PX)).data
}

export const jpegUrl = (data: ArrayBuffer): string => URL.createObjectURL(new Blob([data], { type: 'image/jpeg' }))

export const AVATAR_PX = 256

/** A small square photo of the user, cropped from the centre of the picked file. */
export async function makeAvatar(file: Blob): Promise<ArrayBuffer> {
  const img = await loadImage(file)
  const side = Math.min(img.naturalWidth, img.naturalHeight)
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = AVATAR_PX
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('The photo could not be processed.')
  ctx.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, AVATAR_PX, AVATAR_PX)
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', 0.85))
  canvas.width = canvas.height = 0
  if (!blob) throw new Error('The photo could not be processed.')
  return blob.arrayBuffer()
}

/**
 * Reads a photo of a monitor's screen on the phone: nothing is stored or sent.
 * Returns the reading and a small preview with the found rows outlined.
 */
export async function readMonitorPhoto(file: Blob): Promise<{ result: import('./segReader').SegResult; preview: string }> {
  const { readMonitor, toGray } = await import('./segReader')
  const img = await loadImage(file)
  const scale = Math.min(1, 1000 / Math.max(img.naturalWidth, img.naturalHeight))
  const width = Math.max(1, Math.round(img.naturalWidth * scale))
  const height = Math.max(1, Math.round(img.naturalHeight * scale))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('The photo could not be processed.')
  ctx.drawImage(img, 0, 0, width, height)
  const pixels = ctx.getImageData(0, 0, width, height)
  const result = readMonitor(toGray(pixels.data, width, height, 1000))
  // Outline what was read, then shrink for the preview.
  ctx.lineWidth = Math.max(2, width / 250)
  ctx.strokeStyle = '#2bb673'
  if (result.lcd) ctx.strokeRect(result.lcd.x, result.lcd.y, result.lcd.w, result.lcd.h)
  ctx.strokeStyle = '#ff7a00'
  for (const r of result.rows) ctx.strokeRect(r.x, r.y, r.w, r.h)
  const preview = canvas.toDataURL('image/jpeg', 0.7)
  canvas.width = canvas.height = 0
  return { result, preview }
}
