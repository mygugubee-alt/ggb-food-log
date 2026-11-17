import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { db } from './db/db'
import { purge, setSetting } from './db/repo'
import './theme/app.css'
import { applyCachedTheme } from './theme/themes'

applyCachedTheme()

async function startUp(): Promise<void> {
  // Remove anything deleted in an earlier session that was still waiting for Undo.
  await purge()
  if (!(await db.settings.get('first_use_at'))) await setSetting('first_use_at', new Date().toISOString())
  // Ask the browser to keep this app's storage.
  await navigator.storage?.persist?.()
}
void startUp().catch((e) => console.error(e))

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
