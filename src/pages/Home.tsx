//src/pages/Home.tsx
import React, { useMemo } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../lib/db'
import type { WorkoutTemplate, Session } from '../types'

const DAYS = ['', 'Ma','Di','Wo','Do','Vr','Za','Zo']

export default function Home() {
  const navigate = useNavigate()

  // Live data
  const templates = useLiveQuery(() => db.workout_templates.toArray(), [], [])
  const sessions = useLiveQuery(() => db.sessions.orderBy('startedAt').reverse().toArray(), [], [])

  const activeSession = useMemo(() => (sessions ?? []).find(s => !s.endedAt), [sessions])

  const next = useMemo(() => {
    if (!templates?.length) return null
    const today = getTodayDow()
    // kies template met minste dagen tot volgende occurrence
    const withDelta = templates.map(t => ({ t, delta: ((t.dayOfWeek - today + 7) % 7) }))
    withDelta.sort((a,b) => a.delta - b.delta || a.t.name.localeCompare(b.t.name))
    return withDelta[0].t
  }, [templates])

  async function startSession(templateId: string) {
    const id = crypto.randomUUID()
    await db.sessions.add({ id, templateId, startedAt: new Date(), endedAt: null, notes: '' })
    navigate(`/session/${id}`)
  }

  // Map voor naam lookup
  const tById = useMemo(() => {
    const m = new Map<string, WorkoutTemplate>()
    for (const t of (templates ?? [])) m.set(t.id, t)
    return m
  }, [templates])

  const recent = (sessions ?? []).slice(0, 3)

  return (
    <div>
      <h1>Welkom</h1>

      {/* Active session banner */}
      {activeSession && (
        <div className="card" style={{marginBottom:12, borderColor:'#ddd'}}>
          <div className="row">
            <div>
              <strong>Sessie bezig</strong><br/>
              <span className="small">
                {formatDate(activeSession.startedAt)} — {tById.get(activeSession.templateId)?.name ?? 'Workout'}
              </span>
            </div>
            <div className="actions">
              <button onClick={() => navigate(`/session/${activeSession.id}`)}>Hervat</button>
            </div>
          </div>
        </div>
      )}

      {/* Next workout suggestion */}
      <div className="card" style={{marginBottom:12}}>
        <div className="row">
          <div>
            <strong>Volgende workout</strong><br/>
            <span className="small">
              {next ? `${DAYS[next.dayOfWeek]} — ${next.name}` : 'Nog geen workouts. Maak er één in de Planner.'}
            </span>
          </div>
          <div className="actions">
            {next ? <button onClick={() => startSession(next.id)}>Start</button> : <Link to="/">{'Naar Planner'}</Link>}
          </div>
        </div>
      </div>

      {/* Quick links */}
      <div className="card" style={{marginBottom:12}}>
        <div className="row" style={{borderBottom:'none', paddingBottom:0}}>
          <div className="actions">
            <Link to="/">Planner</Link>
            <Link to="/progress">Progressie</Link>
            <Link to="/history">Historie</Link>
          </div>
        </div>
      </div>

      {/* Recent sessions */}
      <div className="card">
        <div className="row" style={{borderBottom:'none', paddingBottom:0}}>
          <div><strong>Recent</strong></div>
        </div>
        <ul className="sublist" style={{marginTop:6}}>
          {recent.length === 0 && <li className="small">Nog geen sessies gelogd.</li>}
          {recent.map(s => (
            <li key={s.id} className="subrow" style={{borderBottom:'none', padding:'4px 0'}}>
              <div className="grow">
                <strong>{formatDate(s.startedAt)}</strong>
                <div className="small">{tById.get(s.templateId)?.name ?? 'Workout'} • {s.endedAt ? 'Afgerond' : 'Bezig'}</div>
              </div>
              <div className="actions">
                <button onClick={() => navigate(`/session/${s.id}`)}>{s.endedAt ? 'Bekijk' : 'Hervat'}</button>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <p className="small" style={{marginTop:12}}>
        Tip: voeg de app toe aan je beginscherm voor een fullscreen ervaring (iPhone Safari: Deel → Zet op beginscherm).
      </p>
    </div>
  )
}

function getTodayDow() {
  // Map JS getDay (0=Zo) naar onze 1..7 (Ma..Zo)
  const js = new Date().getDay() // 0..6
  return js === 0 ? 7 : js // 1..7, met Ma=1 … Zo=7
}

function formatDate(d: Date | string) {
  const dt = new Date(d)
  return dt.toLocaleString()
}