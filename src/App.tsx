//src/App.tsx
import React, { useEffect, useState } from 'react'
import { Routes, Route, Link } from 'react-router-dom'
import Home from './pages/Home'
import Planner from './pages/Planner'
import Session from './pages/Session'
import History from './pages/History'
import Progress from './pages/Progress'
import Settings from './pages/Settings'
import { ensureSeeded, dedupeTemplates } from './lib/db'
import './styles.css'

function GearIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" {...props}>
      <path fill="currentColor" d="M12 8.5a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7Zm8.9 3.2-1.7-.3a6.9 6.9 0 0 0-.7-1.7l1-1.4a.9.9 0 0 0-.1-1.2l-1.6-1.6a.9.9 0 0 0-1.2-.1l-1.4 1a6.9 6.9 0 0 0-1.7-.7l-.3-1.7a.9.9 0 0 0-.9-.7H10a.9.9 0 0 0-.9.7l-.3 1.7a6.9 6.9 0 0 0-1.7.7l-1.4-1a.9.9 0 0 0-1.2.1L2.9 6.1a.9.9 0 0 0-.1 1.2l1 1.4c-.3.5-.5 1.1-.7 1.7l-1.7.3a.9.9 0 0 0-.7.9v2.3c0 .4.3.8.7.9l1.7.3c.2.6.4 1.2.7 1.7l-1 1.4a.9.9 0 0 0 .1 1.2l1.6 1.6c.3.3.8.3 1.2.1l1.4-1c.5.3 1.1.5 1.7.7l.3 1.7c.1.4.5.7.9.7h2.3c.4 0 .8-.3.9-.7l.3-1.7c.6-.2 1.2-.4 1.7-.7l1.4 1c.4.2.9.2 1.2-.1l1.6-1.6c.3-.3.3-.8.1-1.2l-1-1.4c.3-.5.5-1.1.7-1.7l1.7-.3c.4-.1.7-.5.7-.9v-2.3a.9.9 0 0 0-.7-.9Z"/>
    </svg>
  )
}

function Navbar() {
  useEffect(() => {
    try { delete (document.body as any).dataset.solid } catch {}
    try { localStorage.removeItem('solid') } catch {}
  }, [])

  return (
    <nav className="nav">
      <div style={{display:'flex', gap:8, alignItems:'center'}}>
        <Link to="/">Home</Link>
        <Link to="/planner">Planner</Link>
        <Link to="/history">Historie</Link>
        <Link to="/progress">Progressie</Link>
      </div>
      <div className="right">
        <Link to="/settings" aria-label="Instellingen" title="Instellingen" className="icon-btn">
          <GearIcon />
        </Link>
      </div>
    </nav>
  )
}

export default function App() {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    ;(async () => {
      await ensureSeeded()
      await dedupeTemplates()
      setReady(true)
    })()
  }, [])
  if (!ready) return <div className="container">Bezig met initialiseren…</div>

  return (
    <div className="container theme-glass">
      <Navbar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/index.html" element={<Home />} />
        <Route path="/planner" element={<Planner />} />
        <Route path="/session/:id" element={<Session />} />
        <Route path="/history" element={<History />} />
        <Route path="/progress" element={<Progress />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Home />} />
      </Routes>
    </div>
  )
}