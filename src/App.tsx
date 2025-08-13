//src/App.tsx
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
  return (
    <nav className="nav">
      <Link to="/">Home</Link>
      <Link to="/planner">Planner</Link>
      <Link to="/history">Historie</Link>
      <Link to="/progress">Progressie</Link>
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
    <div className="container">
      <Navbar />
      <Routes>
        {/* Root en index.html moeten Home tonen */}
        <Route path="/" element={<Home />} />
        <Route path="/index.html" element={<Home />} />
        {/* Overige pagina's */}
        <Route path="/planner" element={<Planner />} />
        <Route path="/session/:id" element={<Session />} />
        <Route path="/history" element={<History />} />
        <Route path="/progress" element={<Progress />} />
        {/* Fallback voor elke onbekende route */}
        <Route path="*" element={<Home />} />
      </Routes>
    </div>
  )
}