//src/pages/Session.tsx
import React, { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { db } from '../lib/db'
import type { Exercise, SetLog } from '../types'
import { toInputValue, fromInputValue, addFromNull } from '../lib/num'

type WorkingSet = {
  id: string
  exerciseId: string
  setNumber: number
  reps: number | null
  weight: number | null
  rpe?: number | null
  isWarmup?: boolean
  doneAt?: Date | null
}

type TimerState = {
  endAt: number | null   // epoch ms; null = uit
  totalMs: number        // totale duur
  running: boolean
}

export default function SessionPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [working, setWorking] = useState<WorkingSet[]>([])
  const [tick, setTick] = useState(0)
  const tickRef = useRef<number | null>(null)

  // ---- timer (visuele tick; resterend rekent vs Date.now()) ------------------
  const [timer, setTimer] = useState<TimerState>(() => {
    const raw = localStorage.getItem('repregret.timer')
    if (!raw) return { endAt: null, totalMs: 0, running: false }
    try {
      const p = JSON.parse(raw)
      return { endAt: p.endAt ?? null, totalMs: p.totalMs ?? 0, running: Boolean(p.endAt) }
    } catch {
      return { endAt: null, totalMs: 0, running: false }
    }
  })
  useEffect(() => {
    localStorage.setItem('repregret.timer', JSON.stringify(timer))
  }, [timer])

  useEffect(() => {
    const go = () => setTick(t => t + 1)
    const start = () => { tickRef.current = window.setInterval(go, 250) }
    const stop  = () => { if (tickRef.current) { window.clearInterval(tickRef.current); tickRef.current = null } }
    if (document.visibilityState === 'visible') start()
    const onVis = () => { go(); if (document.visibilityState === 'visible') start(); else stop() }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      if (tickRef.current) window.clearInterval(tickRef.current)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [])

  function updateSet(wsId: string, patch: Partial<WorkingSet>) {
    setWorking(w => w.map(s => (s.id === wsId ? { ...s, ...patch } : s)))
  }

  function addSet(exId: string) {
    const list = working.filter(s => s.exerciseId === exId)
    const last = list.reduce<WorkingSet | null>(
      (acc, s) => (acc === null || s.setNumber > acc.setNumber ? s : acc),
      null
    )
    const nextNum = (last?.setNumber ?? 0) + 1
    setWorking(w => [
      ...w,
      {
        id: crypto.randomUUID(),
        exerciseId: exId,
        setNumber: nextNum,
        reps: 0,
        weight: 0,
        rpe: null,
        isWarmup: false,
        doneAt: null,
      },
    ])
  }

  function incReps(wsId: string, delta: number) {
    setWorking(w =>
      w.map(s => (s.id === wsId ? { ...s, reps: Math.max(0, addFromNull(s.reps, delta)) } : s))
    )
  }

  function incWeight(wsId: string, delta: number) {
    setWorking(w =>
      w.map(s =>
        s.id === wsId ? { ...s, weight: Math.max(0, Number((addFromNull(s.weight, delta)).toFixed(1))) } : s
      )
    )
  }

  async function useLastForExercise(exId: string) {
    if (!id) return
    // Meest recente eerdere sessie met sets voor deze oefening
    const sessions = await db.sessions.orderBy('startedAt').reverse().toArray()
    for (const s of sessions) {
      if (!s || String(s.id) === String(id)) continue
      const prev = await db.sets
        .where('sessionId').equals(String(s.id))
        .and(x => String(x.exerciseId) === String(exId))
        .toArray()

      if (prev.length) {
        // helper: Date|undefined → epoch ms
        const t = (d: any) => (d ? new Date(d).getTime() : 0)
        prev.sort((a, b) => (t(b.completedAt) - t(a.completedAt)) || (Number(b.setNumber ?? 0) - Number(a.setNumber ?? 0)))
        const last = prev.find(p => !p.isWarmup) ?? prev[0]
        setWorking(w =>
          w.map(s2 =>
            s2.exerciseId === exId && s2.setNumber === 1
              ? { ...s2, reps: last.reps ?? 0, weight: last.weight ?? 0 }
              : s2
          )
        )
        break
      }
    }
  }

  // ---- init data -------------------------------------------------------------
  useEffect(() => {
    let alive = true
    async function load() {
      const allEx = await db.exercises.toArray()
      const sessionSets = await db.sets.where('sessionId').equals(String(id)).toArray()
      if (!alive) return

      setExercises(allEx as Exercise[])
      setWorking(
        sessionSets
          .map(s => ({
            id: String(s.id),
            exerciseId: String(s.exerciseId),
            setNumber: Number(s.setNumber ?? 0),
            reps: s.reps ?? 0,
            weight: s.weight ?? 0,
            rpe: (s as any).rpe ?? null,
            isWarmup: !!s.isWarmup,
            // s.completedAt is een Date (volgens jouw types)
            doneAt: s.completedAt ? new Date(s.completedAt as unknown as Date) : null,
          }))
          .sort((a, b) => a.exerciseId.localeCompare(b.exerciseId) || a.setNumber - b.setNumber)
      )
    }
    load()
    return () => { alive = false }
  }, [id])

  // ---- persist on unmount ----------------------------------------------------
  useEffect(() => {
    return () => {
      // schrijf terug naar DB; completedAt als Date | undefined
      const updates = working.map(ws =>
        db.sets.update(String(ws.id), {
          reps: Number(ws.reps ?? 0),
          weight: Number(ws.weight ?? 0),
          rpe: ws.rpe ?? null,
          isWarmup: !!ws.isWarmup,
          completedAt: ws.doneAt ?? undefined, // <-- FIX: Date of undefined (geen number/null)
        } as Partial<SetLog>)
      )
      Promise.allSettled(updates)
    }
  }, [working])

  // ---- timer helpers ---------------------------------------------------------
  function startTimer(ms: number) {
    setTimer({ endAt: Date.now() + ms, totalMs: ms, running: true })
  }
  function stopTimer() {
    setTimer({ endAt: null, totalMs: 0, running: false })
  }
  function remainingSeconds(): number {
    if (!timer.endAt) return 0
    return Math.max(0, Math.ceil((timer.endAt - Date.now()) / 1000))
  }

  // ---- UI --------------------------------------------------------------------
  return (
    <div>
      <h1>Sessie</h1>

      {/* Rusttimer */}
      <div className="card">
        <div className="row">
          <div className="grow">
            <strong>Rusttimer</strong><br/>
            <span className="small">Loopt door als je even wisselt van app of het scherm uit is.</span>
          </div>
          <div className="actions">
            <button className="chip" onClick={() => startTimer(60_000)}>60s</button>
            <button className="chip" onClick={() => startTimer(90_000)}>90s</button>
            <button className="chip" onClick={() => startTimer(120_000)}>120s</button>
            <TimerBadge running={timer.running} seconds={remainingSeconds()} />
            {timer.running && <button className="chip" onClick={stopTimer}>Stop</button>}
          </div>
        </div>
      </div>

      {/* Oefeningen */}
      {exercises
        .map(ex => ({
          ex,
          setsForEx: working.filter(s => s.exerciseId === String(ex.id)),
        }))
        .filter(x => x.setsForEx.length > 0)
        .map(({ ex, setsForEx }) => (
          <div key={String(ex.id)} className="card">
            <div className="row">
              <div className="grow">
                <strong>{ex.name}</strong>
              </div>
              <div className="actions">
                <button onClick={() => addSet(String(ex.id))}>+ set</button>
                <button onClick={() => useLastForExercise(String(ex.id))}>Use last</button>
              </div>
            </div>

            {/* Sets */}
            {setsForEx.map(w => (
              <div key={w.id} style={{ display:'grid', gridTemplateColumns:'80px 1fr 1fr 1fr auto', gap:12, alignItems:'center', margin:'6px 0', opacity: w.doneAt ? 0.65 : 1 }}>
                <span>Set {w.setNumber}</span>

                <div>
                  <label className="small">Reps</label>
                  <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                    <input
                      type="number" min={0} max={50}
                      value={toInputValue(w.reps)}
                      onChange={e=>updateSet(w.id, {reps: fromInputValue(e.target.value)})}
                      style={{ width: 80 }}
                    />
                    <button onClick={() => incReps(w.id, -1)}>-</button>
                    <button onClick={() => incReps(w.id, +1)}>+</button>
                  </div>
                </div>

                <div>
                  <label className="small">Gewicht (kg)</label>
                  <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                    <input
                      type="number" min={0} max={500} step={2.5}
                      value={toInputValue(w.weight)}
                      onChange={e=>updateSet(w.id, {weight: fromInputValue(e.target.value)})}
                      style={{ width: 100 }}
                    />
                    <button onClick={() => incWeight(w.id, -2.5)}>-2.5</button>
                    <button onClick={() => incWeight(w.id, +2.5)}>+2.5</button>
                  </div>
                </div>

                <div>
                  <label className="small">RPE</label>
                  <input
                    type="number" min={5} max={10} step={0.5}
                    value={toInputValue(w.rpe ?? null)}
                    onChange={e=>updateSet(w.id, {rpe: fromInputValue(e.target.value)})}
                    style={{ width: 80 }}
                  />
                </div>

                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <label style={{ display:'flex', gap:6, alignItems:'center' }}>
                    <input
                      type="checkbox"
                      checked={!!w.isWarmup}
                      onChange={e=>updateSet(w.id, {isWarmup: e.target.checked})}
                    />
                    <span className="small">Warm-up</span>
                  </label>
                  {!w.doneAt
                    ? <button className="chip success" onClick={()=>updateSet(w.id, {doneAt: new Date()})}>✓ Done</button>
                    : <button className="chip" onClick={()=>updateSet(w.id, {doneAt: null})}>Undo</button>
                  }
                </div>
              </div>
            ))}
          </div>
        ))
      }

      {/* Afronden */}
      <div className="card">
        <div className="row" style={{justifyContent:'flex-end'}}>
          <div className="actions">
            <button onClick={async () => {
              await db.sessions.update(String(id), { endedAt: new Date(), status: 'completed', state: 'completed' } as any)
              navigate('/history')
            }}>Sessie afronden</button>
          </div>
        </div>
      </div>
    </div>
  )
}

function TimerBadge({ running, seconds }: { running: boolean, seconds: number }) {
  const mm = Math.floor(seconds / 60).toString().padStart(2,'0')
  const ss = (seconds % 60).toString().padStart(2,'0')
  return <span className="small" style={{ padding:'6px 8px', border:'1px dashed var(--hair)', borderRadius:8 }}>{mm}:{ss}{running ? ' ⏱️' : ''}</span>
}