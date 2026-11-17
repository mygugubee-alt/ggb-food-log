import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { useNavigate, type NavigateFunction } from 'react-router-dom'
import { purge, restore, softDelete, type DeleteKind } from '../db/repo'
import { S } from '../strings/en'

export interface Choice<T> { label: string; value: T; kind?: 'primary' | 'danger' }
interface DialogState { message: string; choices: Choice<unknown>[]; cancel: string | null; resolve: (v: unknown) => void }

export interface UI {
  /** Shows buttons and resolves with the chosen value, or null when cancelled. */
  choose<T>(message: string, choices: Choice<T>[], cancel?: string | null): Promise<T | null>
  confirm(message: string, ok: string, danger?: boolean): Promise<boolean>
  alert(message: string): Promise<void>
  toast(message: string): void
  /** Shows the 5-second Undo snackbar for a soft delete. */
  deleted(message: string, stamp: string): void
  /** Runs a task behind a blocking "please wait" and reports any error in plain words. */
  run<T>(task: () => Promise<T>, busyMessage?: string): Promise<T | undefined>
}

const Ctx = createContext<UI | null>(null)
export const useUI = (): UI => {
  const ui = useContext(Ctx)
  if (!ui) throw new Error('UIProvider is missing')
  return ui
}

export const UNDO_MS = 5000

export function errorMessage(e: unknown): string {
  const name = (e as { name?: string })?.name ?? ''
  const inner = (e as { inner?: { name?: string } })?.inner?.name ?? ''
  if (name === 'QuotaExceededError' || inner === 'QuotaExceededError') return S.storageFull
  return e instanceof Error && e.message ? e.message : S.genericError
}

export function UIProvider({ children }: { children: ReactNode }) {
  const [dialog, setDialog] = useState<DialogState | null>(null)
  const [snack, setSnack] = useState<{ message: string; undo: boolean } | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const timer = useRef<number | undefined>(undefined)
  const pending = useRef<string | null>(null)

  // Ends the current snackbar. A delete that was not undone is removed for good.
  const settle = useCallback(() => {
    window.clearTimeout(timer.current)
    if (pending.current) {
      void purge(pending.current)
      pending.current = null
    }
  }, [])
  useEffect(() => settle, [settle])

  const show = useCallback((message: string, stamp: string | null, ms: number) => {
    settle()
    pending.current = stamp
    setSnack({ message, undo: stamp != null })
    timer.current = window.setTimeout(() => { settle(); setSnack(null) }, ms)
  }, [settle])

  const undo = () => {
    const stamp = pending.current
    pending.current = null
    window.clearTimeout(timer.current)
    setSnack(null)
    if (stamp) void restore(stamp)
  }

  const api = useRef<UI>(null as unknown as UI)
  api.current = {
    choose: (message, choices, cancel = S.cancel) =>
      new Promise((resolve) => setDialog({ message, choices, cancel, resolve: resolve as (v: unknown) => void })),
    confirm: async (message, ok, danger = false) =>
      (await api.current.choose(message, [{ label: ok, value: true, kind: danger ? 'danger' : 'primary' }])) === true,
    alert: async (message) => { await api.current.choose(message, [{ label: S.ok, value: true, kind: 'primary' }], null) },
    toast: (message) => show(message, null, 2200),
    deleted: (message, stamp) => show(message, stamp, UNDO_MS),
    run: async (task, busyMessage) => {
      if (busyMessage) setBusy(busyMessage)
      try {
        return await task()
      } catch (e) {
        setBusy(null)
        await api.current.alert(errorMessage(e))
        return undefined
      } finally {
        setBusy(null)
      }
    },
  }
  const stable = useRef<UI>({
    choose: (...a) => api.current.choose(...a),
    confirm: (...a) => api.current.confirm(...a),
    alert: (...a) => api.current.alert(...a),
    toast: (...a) => api.current.toast(...a),
    deleted: (...a) => api.current.deleted(...a),
    run: (...a) => api.current.run(...a),
  })

  const answer = (value: unknown) => {
    dialog?.resolve(value)
    setDialog(null)
  }

  return (
    <Ctx.Provider value={stable.current}>
      {children}
      {snack && (
        <div className="snack" role="status">
          <span>{snack.message}</span>
          {snack.undo && <button onClick={undo}>{S.undo}</button>}
        </div>
      )}
      {dialog && (
        <div className="overlay" role="dialog" aria-modal="true">
          <div className="dialog">
            <p>{dialog.message}</p>
            <div className="stack">
              {dialog.choices.map((c) => (
                <button key={c.label} className={`btn block ${c.kind ?? ''}`} onClick={() => answer(c.value)}>{c.label}</button>
              ))}
              {dialog.cancel && <button className="btn block" onClick={() => answer(null)}>{dialog.cancel}</button>}
            </div>
          </div>
        </div>
      )}
      {busy && (
        <div className="overlay" role="alert" aria-busy="true">
          <div className="dialog"><div className="spinner" /><p style={{ textAlign: 'center' }}>{busy}</p></div>
        </div>
      )}
    </Ctx.Provider>
  )
}

/** Confirm, soft delete, then show Undo. Resolves true if the item was deleted. */
export function useDelete() {
  const ui = useUI()
  return useCallback(async (kind: DeleteKind, id: string, question: string): Promise<boolean> => {
    if (!(await ui.confirm(question, S.delete, true))) return false
    const stamp = await ui.run(() => softDelete(kind, id))
    if (!stamp) return false
    ui.deleted(S.deletedMessage[kind], stamp)
    return true
  }, [ui])
}

export function goBack(nav: NavigateFunction): void {
  const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0
  if (idx > 0) nav(-1)
  else nav('/', { replace: true })
}

export function Page({ title, back, right, tabs, children }: {
  title: string
  /** true for the normal back button, or a function to run instead (for example an unsaved-changes check) */
  back?: boolean | (() => void)
  right?: ReactNode
  tabs?: boolean
  children: ReactNode
}) {
  const nav = useNavigate()
  return (
    <div className={`page ${tabs ? 'with-tabs' : ''}`}>
      <header className="topbar no-print">
        {back && (
          <button className="icon-btn" aria-label={S.back} onClick={() => (typeof back === 'function' ? back() : goBack(nav))}>‹</button>
        )}
        <h1>{title}</h1>
        <div className="topbar-right">{right}</div>
      </header>
      <main className="content">{children}</main>
    </div>
  )
}

export function Field({ label, htmlFor, note, error, children }: {
  label: string; htmlFor?: string; note?: ReactNode; error?: string | null; children: ReactNode
}) {
  return (
    <div className="field">
      <label htmlFor={htmlFor}><span>{label}</span>{note}</label>
      {children}
      {error && <div className="error" role="alert">{error}</div>}
    </div>
  )
}

export function Chips<T extends string>({ options, value, onChange, label }: {
  options: { value: T; label: string }[]; value: T | null; onChange: (v: T) => void; label: string
}) {
  return (
    <div className="chips" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" className="chip" aria-pressed={value === o.value} onClick={() => onChange(o.value)}>{o.label}</button>
      ))}
    </div>
  )
}
