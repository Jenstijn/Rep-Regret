//src/pages/Session.tsx
import React, { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { db } from '../lib/db'
import type { Exercise, SetLog } from '../types'

type WorkingSet = {
  id: string
  exerciseId: string
  setNumber: number
  reps: number
  weight: number
  rpe?: number | null
  isWarmup?: boolean
  doneAt?: Date | null
}

type TimerState = { remaining: number; running: boolean }

export default function Session() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [templateName, setTemplateName] = useState('')
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [working, setWorking] = useState<WorkingSet[]>([])
  const [restPreset, setRestPreset] = useState<number>(120) // seconds
  const [timers, setTimers] = useState<Record<string, TimerState>>({}) // per exercise
  const tickRef = useRef<number | null>(null)

  // Load session + defaults
  useEffect(() => {
    if (!id) return
    ;(async () => {
      const session = await db.sessions.get(id)
      if (!session) return
      const template = await db.workout_templates.get(session.templateId)
      setTemplateName(template?.name ?? 'Workout')
      const exs = await db.exercises.where('templateId').equals(session.templateId).sortBy('order')
      setExercises(exs)

      // preload defaults only once
      setWorking(prev =>
        prev.length
          ? prev
          : exs.flatMap(ex =>
              Array.from({ length: ex.defaultSets }, (_, i) => ({
                id: crypto.randomUUID(),
                exerciseId: ex.id,
                setNumber: i + 1,
                reps: ex.defaultReps,
                weight: ex.defaultWeight,
                rpe: 7.5,
                isWarmup: false,
                doneAt: null,
              }))
            )
      )
    })()
  }, [id])

  // Timer tick (1s) – update all running exercise timers
  useEffect(() => {
    tickRef.current = window.setInterval(() => {
      setTimers(curr => {
        const copy: Record<string, TimerState> = { ...curr }
        for (const k of Object.keys(copy)) {
          const t = copy[k]
          if (!t.running) continue
          const next = Math.max(0, t.remaining - 1)
          copy[k] = { remaining: next, running: next > 0 }
        }
        return copy
      })
    }, 1000)
    return () => {
      if (tickRef.current) window.clearInterval(tickRef.current)
    }
  }, [])

  // ---- helpers ---------------------------------------------------------------
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
        reps: last?.reps ?? 8,
        weight: last?.weight ?? 0,
        rpe: last?.rpe ?? 7.5,
        isWarmup: false,
        doneAt: null,
      },
    ])
  }

  function incReps(wsId: string, delta: number) {
    setWorking(w =>
      w.map(s => (s.id === wsId ? { ...s, reps: Math.max(0, s.reps + delta) } : s))
    )
  }

  function incWeight(wsId: string, delta: number) {
    setWorking(w =>
      w.map(s =>
        s.id === wsId ? { ...s, weight: Math.max(0, Number((s.weight + delta).toFixed(1))) } : s
      )
    )
  }

  async function useLastForExercise(exId: string) {
    if (!id) return
    // Vind meest recente eerdere sessie met sets voor deze oefening
    const sessions = await db.sessions.orderBy('startedAt').reverse().toArray()
    for (const s of sessions) {
      if (s.id === id) continue
      const lastSets = (
        await db.sets
          .where('sessionId')
          .equals(s.id)
          .and(x => x.exerciseId === exId)
          .toArray()
      ).sort((a, b) => a.setNumber - b.setNumber)
      if (lastSets.length) {
        setWorking(w => {
          const others = w.filter(x => x.exerciseId !== exId)
          const mapped: WorkingSet[] = lastSets.map((ls, idx) => ({
            id: crypto.randomUUID(),
            exerciseId: exId,
            setNumber: idx + 1,
            reps: ls.reps,
            weight: ls.weight,
            rpe: ls.rpe ?? 7.5,
            isWarmup: ls.isWarmup ?? false,
            doneAt: null,
          }))
          return [...others, ...mapped]
        })
        return
      }
    }
    alert('Geen vorige data gevonden voor deze oefening.')
  }

  // Markeer set "Done" en start rusttijd voor deze oefening
  function completeSet(ws: WorkingSet) {
    updateSet(ws.id, { doneAt: new Date() })
    startTimer(ws.exerciseId, restPreset)
  }

  // Timer-functies
  function startTimer(exId: string, seconds: number) {
    setTimers(t => ({ ...t, [exId]: { remaining: seconds, running: true } }))
  }
  function pauseTimer(exId: string) {
    setTimers(t => ({ ...t, [exId]: { ...(t[exId] ?? { remaining: 0, running: false }), running: false } }))
  }
  function resetTimer(exId: string) {
    setTimers(t => ({ ...t, [exId]: { remaining: restPreset, running: false } }))
  }

  async function finish() {
    if (!id) return
    const now = new Date()
    await db.sessions.update(id, { endedAt: now })
    const logs: SetLog[] = working
      .slice()
      .sort((a, b) => a.setNumber - b.setNumber)
      .map(ws => ({
        id: crypto.randomUUID(),
        sessionId: id,
        exerciseId: ws.exerciseId,
        setNumber: ws.setNumber,
        reps: ws.reps,
        weight: ws.weight,
        rpe: ws.rpe ?? null,
        isWarmup: ws.isWarmup ?? false,
        completedAt: ws.doneAt ?? now,
      }))
    await db.sets.bulkAdd(logs)
    navigate('/history')
  }

  // ---- UI --------------------------------------------------------------------
  return (
    <div>
      <h1>{templateName}</h1>

      {/* Globale rest preset */}
      <div style={{display:'flex', gap:8, alignItems:'center', margin:'6px 0 12px'}}>
        <span className="small">Rusttijd (sec):</span>
        <Segmented
          value={String(restPreset)}
          onChange={v => setRestPreset(Number(v))}
          options={[
            { value: '60', label: '60' },
            { value: '90', label: '90' },
            { value: '120', label: '120' },
            { value: '180', label: '180' },
          ]}
        />
      </div>

      {exercises.map(ex => {
        const setsForEx = working
          .filter(s => s.exerciseId === ex.id)
          .sort((a, b) => a.setNumber - b.setNumber)
        const timer = timers[ex.id] ?? { remaining: 0, running: false }
        return (
          <section key={ex.id} style={{ marginBottom: 16, paddingBottom: 8, borderBottom: '1px solid #eee' }}>
            {/* Header + timer */}
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:8 }}>
              <h3 style={{ margin:'8px 0' }}>{ex.name}</h3>
              <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                <TimerBadge seconds={timer.remaining} running={timer.running} />
                <button onClick={() => startTimer(ex.id, restPreset)}>Start</button>
                <button onClick={() => pauseTimer(ex.id)}>Pause</button>
                <button onClick={() => resetTimer(ex.id)}>Reset</button>
                <button onClick={() => useLastForExercise(ex.id)}>Vorige keer</button>
                <button onClick={() => addSet(ex.id)}>+ set</button>
              </div>
            </div>

            {/* Sets */}
            {setsForEx.map(w => (
              <div key={w.id} style={{ display:'grid', gridTemplateColumns:'auto 1fr 1fr 1fr auto', gap:8, alignItems:'center', margin:'6px 0', opacity: w.doneAt ? 0.65 : 1 }}>
                <span>Set {w.setNumber}</span>

                <div>
                  <label className="small">Reps</label>
                  <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                    <input type="number" min={0} max={50} value={w.reps} onChange={e=>updateSet(w.id, {reps:Number(e.target.value)})} style={{ width: 80 }} />
                    <button onClick={() => incReps(w.id, -1)}>-</button>
                    <button onClick={() => incReps(w.id, +1)}>+</button>
                  </div>
                </div>

                <div>
                  <label className="small">Gewicht (kg)</label>
                  <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                    <input type="number" min={0} max={500} step={2.5} value={w.weight} onChange={e=>updateSet(w.id, {weight:Number(e.target.value)})} style={{ width: 100 }} />
                    <button onClick={() => incWeight(w.id, -2.5)}>-2.5</button>
                    <button onClick={() => incWeight(w.id, +2.5)}>+2.5</button>
                  </div>
                </div>

                <div>
                  <label className="small">RPE</label>
                  <input type="number" min={5} max={10} step={0.5} value={w.rpe ?? 7.5} onChange={e=>updateSet(w.id, {rpe:Number(e.target.value)})} style={{ width: 80 }} />
                </div>

                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <label style={{ display:'flex', gap:6, alignItems:'center' }}>
                    <input type="checkbox" checked={!!w.isWarmup} onChange={e=>updateSet(w.id, {isWarmup: e.target.checked})} />
                    <span className="small">Warm-up</span>
                  </label>
                  {!w.doneAt
                    ? <button onClick={() => completeSet(w)}>✓ Done</button>
                    : <button onClick={() => updateSet(w.id, {doneAt:null})}>↺ Maak ongedaan</button>}
                </div>
              </div>
            ))}
          </section>
        )
      })}

      <div style={{ display:'flex', gap:12 }}>
        <button onClick={finish} style={{ padding:'8px 12px' }}>Eindig sessie</button>
      </div>
    </div>
  )
}

// Kleine helpers / UI
function TimerBadge({ seconds, running }: { seconds: number; running: boolean }) {
  const mm = Math.floor(seconds / 60).toString().padStart(2,'0')
  const ss = (seconds % 60).toString().padStart(2,'0')
  return <span className="small" style={{ padding:'6px 8px', border:'1px solid var(--line)', borderRadius:8 }}>{mm}:{ss}{running ? ' ⏱️' : ''}</span>
}

function Segmented(props: { value: string, options: {value:string, label:string}[], onChange:(v:string)=>void }) {
  return (
    <div style={{display:'flex', gap:6, flexWrap:'wrap'}}>
      {props.options.map(opt => (
        <button
          key={opt.value}
          onClick={()=>props.onChange(opt.value)}
          style={{
            padding:'6px 10px',
            border:'1px solid var(--line)',
            borderRadius:8,
            background: props.value === opt.value ? '#111' : '#f9f9f9',
            color: props.value === opt.value ? '#fff' : '#111',
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}