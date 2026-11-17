import { useEffect, useState, useSyncExternalStore } from 'react'
import { HashRouter, Link, NavLink, Route, Routes, useLocation } from 'react-router-dom'
import { useExportDue, useSettings } from './components/hooks'
import { Avatar } from './components/photos'
import { UIProvider } from './components/ui'
import { useLiveQuery } from 'dexie-react-hooks'
import { getSettings } from './db/repo'
import { applyUpdate, isInstalled, isIos, onUpdateWaiting, updateWaiting } from './pwa'
import A1c from './screens/A1c'
import ActivityEditor from './screens/ActivityEditor'
import DayEditor from './screens/DayEditor'
import Ranges from './screens/Ranges'
import Goal from './screens/Goal'
import MealEditor from './screens/MealEditor'
import PhotoViewer from './screens/PhotoViewer'
import Report from './screens/Report'
import Search from './screens/Search'
import Settings from './screens/Settings'
import SugarEntry from './screens/SugarEntry'
import Timeline from './screens/Timeline'
import Today from './screens/Today'
import { S } from './strings/en'
import { applyTheme } from './theme/themes'

const TABS = [
  { to: '/', label: S.tabs.today, icon: <path d="M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" /> },
  { to: '/timeline', label: S.tabs.timeline, icon: <><rect x="3.5" y="5" width="17" height="15.5" rx="2" /><path d="M3.500 10h17M8 3v4M16 3v4" /></> },
  { to: '/report', label: S.tabs.report, icon: <path d="M4 20V4M4 20h16M7.500 15l3.500-4 3 2.500L19 8" /> },
  { to: '/search', label: S.tabs.search, icon: <><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4.500 4.500" /></> },
  { to: '/settings', label: S.tabs.settings, icon: <><path d="M4 7h10M18 7h2M4 17h2M10 17h10" /><circle cx="16" cy="7" r="2" /><circle cx="8" cy="17" r="2" /></> },
]

function TabBar() {
  const { due } = useExportDue()
  return (
    <div className="tabbar">
      <nav aria-label={S.appName}>
        {TABS.map((t) => (
          <NavLink key={t.to} to={t.to} end className={({ isActive }) => (isActive ? 'active' : '')}>
            <svg viewBox="0 0 24 24" aria-hidden="true">{t.icon}</svg>
            <span>{t.label}</span>
            {t.to === '/settings' && due && <span className="tab-dot" aria-label={S.exportNow} />}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}

/** The app header shown on the five main screens: logo, name, and the user's photo. */
function AppHeader() {
  return (
    <header className="appbar no-print">
      <Link to="/settings" className="avatar-link" aria-label={S.openSettings}><Avatar /></Link>
      <Link to="/" className="brand" aria-label={S.appName}>
        <span className="brand-top">{S.brandShort}</span>
        <span className="brand-sub">{S.brandRest}</span>
      </Link>
      <span className="brand-rule" aria-hidden="true" />
    </header>
  )
}

/** "New version available" and "add to home screen" notices. */
function Notices() {
  const waiting = useSyncExternalStore(onUpdateWaiting, updateWaiting)
  const [hidden, setHidden] = useState(() => isInstalled() || sessionStorage.getItem('install-dismissed') === '1')
  return (
    <div className="no-print" style={{ padding: waiting || !hidden ? '8px 16px 0' : 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
      {waiting && (
        <div className="banner" role="status">
          <span className="grow">{S.updateReady}</span>
          <button className="btn primary" onClick={applyUpdate}>{S.reload}</button>
        </div>
      )}
      {!hidden && (
        <div className="banner">
          <span className="grow"><strong>{S.installTitle}</strong><br />{isIos() ? S.installIos : S.installOther}</span>
          <button className="link" onClick={() => { sessionStorage.setItem('install-dismissed', '1'); setHidden(true) }}>{S.dismiss}</button>
        </div>
      )}
    </div>
  )
}

/** Blanks the screen when the app goes to the background. Best effort only. */
function PrivacyCover() {
  const [covered, setCovered] = useState(false)
  useEffect(() => {
    const touch = window.matchMedia('(pointer: coarse)').matches
    const sync = () => setCovered(document.visibilityState === 'hidden')
    const hide = () => setCovered(true)
    const show = () => setCovered(document.visibilityState === 'hidden')
    document.addEventListener('visibilitychange', sync)
    window.addEventListener('pagehide', hide)
    window.addEventListener('pageshow', show)
    if (touch) {
      window.addEventListener('blur', hide)
      window.addEventListener('focus', show)
    }
    return () => {
      document.removeEventListener('visibilitychange', sync)
      window.removeEventListener('pagehide', hide)
      window.removeEventListener('pageshow', show)
      window.removeEventListener('blur', hide)
      window.removeEventListener('focus', show)
    }
  }, [])
  return covered ? <div className="cover" aria-hidden="true" /> : null
}

function Shell() {
  const { pathname } = useLocation()
  const onTab = TABS.some((t) => t.to === pathname)
  const theme = useSettings().theme
  const settingsLoaded = useLiveQuery(async () => { await getSettings(); return true }) === true
  useEffect(() => { if (settingsLoaded) applyTheme(theme) }, [theme, settingsLoaded])
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])
  return (
    <div className="app">
      {onTab && <AppHeader />}
      {onTab && <Notices />}
      <Routes>
        <Route path="/" element={<Today />} />
        <Route path="/timeline" element={<Timeline />} />
        <Route path="/report" element={<Report />} />
        <Route path="/search" element={<Search />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/day/:date" element={<DayEditor />} />
        <Route path="/meal/:id" element={<MealEditor />} />
        <Route path="/sugar/:id" element={<SugarEntry />} />
        <Route path="/goal" element={<Goal />} />
        <Route path="/a1c" element={<A1c />} />
        <Route path="/activity/:id" element={<ActivityEditor />} />
        <Route path="/ranges" element={<Ranges />} />
        <Route path="/photo/:id" element={<PhotoViewer />} />
        <Route path="*" element={<Today />} />
      </Routes>
      {onTab && <TabBar />}
      <PrivacyCover />
    </div>
  )
}

export default function App() {
  return (
    <HashRouter>
      <UIProvider>
        <Shell />
      </UIProvider>
    </HashRouter>
  )
}
