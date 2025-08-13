//src/pages/Session.tsx
import React, { useEffect, useState } from 'react'
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
}

export default function Session() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [templateName, setTemplateName] = useState('')
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [working, setWorking] = useState<WorkingSet[]>([])

  useEffect(() => {
    if (!id) return
    ;(async () => {
      const session = await db.sessions.get(id)
      if (!session) return
      const template = await db.workout_templates.get(session.templateId)
      setTemplateName(template?.name ?? 'Workout')
      const exs = await db.exercises.where('templateId').equals(session.templateId).sortBy('order')
      setExercises(exs)

      // preload defaults once
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
              }))
            )
      )
    })()
  }, [id])

  // --- helpers ---------------------------------------------------------------
  function updateSet(wsId: string, patch: Partial<WorkingSet>) {
    setWorking(w => w.map(s => (s.id === wsId ? { ...s, ...patch } : s)))
  }

  function addSet(exId: string) {
    const list = working.filter(s => s.exerciseId === exId)
    // vind "last" zonder .at():
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
      w.map(s => (s.id === wsId ? { ...s, weight: Math.max(0, Number((s.weight + delta).toFixed(1))) } : s))
    )
  }

  async function useLastForExercise(exId: string) {
    if (!id) return
    // Meest recente eerdere sessie met sets voor deze oefening
    const sessions = await db.sessions.orderBy('startedAt').reverse().toArray()
    for (const s of sessions) {
      if (s.id === id) continue
      const lastSets = (await db.sets
        .where('sessionId')
        .equals(s.id)
        .and(x => x.exerciseId === exId)
        .toArray()).sort((a, b) => a.setNumber - b.setNumber)
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
          }))
          return [...others, ...mapped]
        })
        return
      }
    }
    alert('Geen vorige data gevonden voor deze oefening.')
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
        completedAt: now,
      }))
    await db.sets.bulkAdd(logs)
    navigate('/history')
  }

  // --- UI --------------------------------------------------------------------
  return (
    <div>
      <h1>{templateName}</h1>

      {exercises.map(ex => {
        const setsForEx = working
          .filter(s => s.exerciseId === ex.id)
          .sort((a, b) => a.setNumber - b.setNumber)

        return (
          <section key={ex.id} style={{ marginBottom: 16, paddingBottom: 8, borderBottom: '1px solid #eee' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <h3 style={{ margin: '8px 0' }}>{ex.name}</h3>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => useLastForExercise(ex.id)}>Hetzelfde als vorige keer</button>
                <button onClick={() => addSet(ex.id)}>+ set</button>
              </div>
            </div>

            {setsForEx.map(w => (
              <div key={w.id} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr 1fr 1fr auto', gap: 8, alignItems: 'center', margin: '6px 0' }}>
                <span>Set {w.setNumber}</span>

                <div>
                  <label className="small">Reps</label>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <input
                      type="number"
                      min={0}
                      max={50}
                      value={w.reps}
                      onChange={e => updateSet(w.id, { reps: Number(e.target.value) })}
                      style={{ width: 80 }}
                    />
                    <button onClick={() => incReps(w.id, -1)}>-</button>
                    <button onClick={() => incReps(w.id, +1)}>+</button>
                  </div>
                </div>

                <div>
                  <label className="small">Gewicht (kg)</label>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <input
                      type="number"
                      min={0}
                      max={500}
                      step={2.5}
                      value={w.weight}
                      onChange={e => updateSet(w.id, { weight: Number(e.target.value) })}
                      style={{ width: 100 }}
                    />
                    <button onClick={() => incWeight(w.id, -2.5)}>-2.5</button>
                    <button onClick={() => incWeight(w.id, +2.5)}>+2.5</button>
                  </div>
                </div>

                <div>
                  <label className="small">RPE</label>
                  <input
                    type="number"
                    min={5}
                    max={10}
                    step={0.5}
                    value={w.rpe ?? 7.5}
                    onChange={e => updateSet(w.id, { rpe: Number(e.target.value) })}
                    style={{ width: 80 }}
                  />
                </div>

                <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <input
                    type="checkbox"
                    checked={!!w.isWarmup}
                    onChange={e => updateSet(w.id, { isWarmup: e.target.checked })}
                  />
                  <span className="small">Warm-up</span>
                </label>
              </div>
            ))}
          </section>
        )
      })}

      <div style={{ display: 'flex', gap: 12 }}>
        <button onClick={finish} style={{ padding: '8px 12px' }}>Eindig sessie</button>
      </div>
    </div>
  )
}