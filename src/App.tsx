// src/App.tsx
import React, { useEffect, useState } from 'react'
import { Routes, Route, Link } from 'react-router-dom'
import Home from './pages/Home'
import Planner from './pages/Planner'
import Session from './pages/Session'
import History from './pages/History'
import Progress from './pages/Progress'
import { ensureSeeded, dedupeTemplates } from './lib/db'
import './styles.css'

function Navbar() {
  const [solid, setSolid] = useState<boolean>(() => {
    try { return localStorage.getItem('solid') === '1' } catch { return false }
  })
  useEffect(() => {
    document.body.dataset.solid = solid ? '1' : '0'
    try { localStorage.setItem('solid', solid ? '1' : '0') } catch {}
  }, [solid])

  return (
    <nav className="nav">
      <div style={{display:'flex', gap:8, alignItems:'center'}}>
        <Link to="/">Home</Link>
        <Link to="/planner">Planner</Link>
        <Link to="/history">Historie</Link>
        <Link to="/progress">Progressie</Link>
      </div>
      <div className="right">
        <button onClick={() => setSolid(s => !s)} title="Schakel solide/glass">
          {solid ? '🔳 Solide' : '🪟 Glass'}
        </button>
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
        <Route path="*" element={<Home />} />
      </Routes>
    </div>
  )
}