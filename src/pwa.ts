import { registerSW } from 'virtual:pwa-register'

// The service worker keeps a copy of the app's own files on the phone so it opens offline.
let waiting = false
const listeners = new Set<() => void>()

const update = registerSW({
  onNeedRefresh() {
    waiting = true
    listeners.forEach((fn) => fn())
  },
})

export const updateWaiting = (): boolean => waiting
export function onUpdateWaiting(fn: () => void): () => void {
  listeners.add(fn)
  return () => { listeners.delete(fn) }
}
/** Switches to the new version. Stored data is not touched. */
export const applyUpdate = (): void => { void update(true) }

export const isInstalled = (): boolean =>
  window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true
export const isIos = (): boolean =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
