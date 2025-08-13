//src/App.tsx
import React, { useEffect, useState } from 'react'
import { Routes, Route, Link } from 'react-router-dom'
import Planner from './pages/Planner'
import Session from './pages/Session'
import History from './pages/History'
import Progress from './pages/Progress'
import { ensureSeeded, dedupeTemplates } from './lib/db'
import './styles.css'

function Navbar() {
  return (
    <nav className="nav">
      <Link to="/">Planner</Link>
      <Link to="/history">Historie</Link>
      <Link to="/progress">Progressie</Link>
    </nav>
  )
}

export default function App() {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    (async () => {
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
        <Route path="/" element={<Planner />} />
        <Route path="/session/:id" element={<Session />} />
        <Route path="/history" element={<History />} />
        <Route path="/progress" element={<Progress />} />
      </Routes>
    </div>
  )
}