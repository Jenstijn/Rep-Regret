import React, { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { db } from '../lib/db'
import type { Exercise, SetLog } from '../types'

type WorkingSet = { id: string, exerciseId: string, setNumber: number, reps: number, weight: number }

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
      setWorking(prev => prev.length ? prev : exs.flatMap(ex => {
        return Array.from({length: ex.defaultSets}, (_,i) => ({
          id: crypto.randomUUID(),
          exerciseId: ex.id,
          setNumber: i+1,
          reps: ex.defaultReps,
          weight: ex.defaultWeight
        }))
      }))
    })()
  }, [id])

  function updateSet(wsId: string, patch: Partial<WorkingSet>) {
    setWorking(w => w.map(s => s.id === wsId ? { ...s, ...patch } : s))
  }
  function addSet(exId: string) {
    const max = Math.max(0, ...working.filter(s=>s.exerciseId===exId).map(s=>s.setNumber))
    setWorking(w => [...w, { id: crypto.randomUUID(), exerciseId: exId, setNumber: max+1, reps: 8, weight: 0 }])
  }

  async function finish() {
    if (!id) return
    const now = new Date()
    await db.sessions.update(id, { endedAt: now })
    const logs: SetLog[] = working.map(ws => ({
      id: crypto.randomUUID(),
      sessionId: id,
      exerciseId: ws.exerciseId,
      setNumber: ws.setNumber,
      reps: ws.reps,
      weight: ws.weight,
      completedAt: now
    }))
    await db.sets.bulkAdd(logs)
    navigate('/history')
  }

  return (
    <div>
      <h1>{templateName}</h1>
      {exercises.map(ex => (
        <section key={ex.id} style={{marginBottom:16, paddingBottom:8, borderBottom:'1px solid #eee'}}>
          <h3 style={{margin:'8px 0'}}>{ex.name}</h3>
          {working.filter(s=>s.exerciseId===ex.id).sort((a,b)=>a.setNumber-b.setNumber).map(w => (
            <div key={w.id} style={{display:'flex', gap:8, alignItems:'center', margin:'6px 0'}}>
              <span>Set {w.setNumber}</span>
              <label>Reps <input type="number" min={1} max={50} value={w.reps} onChange={e=>updateSet(w.id,{reps: Number(e.target.value)})} style={{width:64}}/></label>
              <label>Gewicht (kg) <input type="number" min={0} max={500} step={2.5} value={w.weight} onChange={e=>updateSet(w.id,{weight: Number(e.target.value)})} style={{width:96}}/></label>
            </div>
          ))}
          <button onClick={()=>addSet(ex.id)}>+ set</button>
        </section>
      ))}
      <div style={{display:'flex', gap:12}}>
        <button onClick={finish} style={{padding:'8px 12px'}}>Eindig sessie</button>
      </div>
    </div>
  )
}
