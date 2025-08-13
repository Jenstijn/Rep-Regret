import React, { useMemo } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../lib/db'
import type { WorkoutTemplate } from '../types'

const DAYS = ['', 'Ma','Di','Wo','Do','Vr','Za','Zo']

export default function Home() {
  const navigate = useNavigate()

  const templates = useLiveQuery(() => db.workout_templates.toArray(), [], [])
  const sessions = useLiveQuery(() => db.sessions.orderBy('startedAt').reverse().toArray(), [], [])

  const activeSession = useMemo(() => (sessions ?? []).find(s => !s.endedAt), [sessions])

  const next = useMemo(() => {
    if (!templates?.length) return null
    const today = getTodayDow()
    const withDelta = templates.map(t => ({ t, delta: ((t.dayOfWeek - today + 7) % 7) }))
    withDelta.sort((a,b) => a.delta - b.delta || a.t.name.localeCompare(b.t.name))
    return withDelta[0].t
  }, [templates])

  async function startSession(templateId: string) {
    const id = crypto.randomUUID()
    await db.sessions.add({ id, templateId, startedAt: new Date(), endedAt: null, notes: '' })
    navigate(`/session/${id}`)
  }

  const tById = useMemo(() => {
    const m = new Map<string, WorkoutTemplate>()
    for (const t of (templates ?? [])) m.set(t.id, t)
    return m
  }, [templates])

  const recent = (sessions ?? []).slice(0, 3)

  return (
    <div>
      <h1>Welkom</h1>

      {/* Actieve sessie (indien bezig) */}
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

      {/* Volgende workout */}
      <div className="card" style={{marginBottom:12}}>
        <div className="row">
          <div>
            <strong>Volgende workout</strong><br/>
            <span className="small">
              {next ? `${DAYS[next.dayOfWeek]} — ${next.name}` : 'Nog geen workouts. Maak er één in de Planner.'}
            </span>
          </div>
          <div className="actions">
            {next ? <button onClick={() => startSession(next.id)}>Start</button> : <Link to="/planner">{'Naar Planner'}</Link>}
          </div>
        </div>
      </div>

      {/* Recent */}
      <div className="card" style={{marginBottom:12}}>
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

      {/* Hoe werkt het? (korte uitleg) */}
      <div className="card">
        <div className="row" style={{borderBottom:'none', paddingBottom:0}}>
          <div><strong>Hoe werkt het?</strong></div>
        </div>
        <ul className="sublist" style={{marginTop:8}}>
          <li className="subrow" style={{borderBottom:'none'}}>
            <div className="grow">
              <strong>1. Planner</strong>
              <div className="small">Maak workouts per weekdag en voeg oefeningen toe met standaard sets/reps/gewicht. <Link to="/planner">Ga naar Planner</Link>.</div>
            </div>
          </li>
          <li className="subrow" style={{borderBottom:'none'}}>
            <div className="grow">
              <strong>2. Start sessie</strong>
              <div className="small">Start vanaf Home (Volgende workout) of via de Planner.</div>
            </div>
          </li>
          <li className="subrow" style={{borderBottom:'none'}}>
            <div className="grow">
              <strong>3. Log snel</strong>
              <div className="small">Gebruik ±reps, ±2.5 kg, **Vorige keer** en markeer sets met **✓ Done**. Optioneel: RPE en Warm-up. Timer helpt met rustpauzes.</div>
            </div>
          </li>
          <li className="subrow" style={{borderBottom:'none'}}>
            <div className="grow">
              <strong>4. Afronden</strong>
              <div className="small">Eindig sessie. Alles staat in <Link to="/history">Historie</Link> en is te exporteren als CSV.</div>
            </div>
          </li>
          <li className="subrow" style={{borderBottom:'none'}}>
            <div className="grow">
              <strong>5. Progressie</strong>
              <div className="small">Bekijk grafieken per oefening (Gewicht, Volume, est. 1RM) met filters. <Link to="/progress">Naar Progressie</Link>.</div>
            </div>
          </li>
          <li className="subrow" style={{borderBottom:'none'}}>
            <div className="grow">
              <strong>6. PWA & privacy</strong>
              <div className="small">Voeg toe aan je beginscherm (iPhone: Deel → Zet op beginscherm). Data blijft lokaal in je browser. Backup? Exporteer CSV.</div>
            </div>
          </li>
        </ul>
      </div>
    </div>
  )
}

function getTodayDow() {
  const js = new Date().getDay() // 0..6
  return js === 0 ? 7 : js // 1..7 (Ma=1 … Zo=7)
}

function formatDate(d: Date | string) {
  const dt = new Date(d)
  return dt.toLocaleString()
}