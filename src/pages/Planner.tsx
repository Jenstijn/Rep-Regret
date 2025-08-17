//src/pages/Planner.tsx
import React, { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../lib/db'
import type { Exercise } from '../types'
import { useNavigate } from 'react-router-dom'
import { toInputValue, fromInputValue } from '../lib/num'

type WorkoutForm = { name: string; dayOfWeek: number }
type ExerciseForm = { name: string; defaultSets: number | null; defaultReps: number | null; defaultWeight: number | null }

const DAYS = ['', 'Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo']

export default function Planner() {
  const navigate = useNavigate()
  const templates = useLiveQuery(() => db.workout_templates.orderBy('dayOfWeek').toArray(), [], [])
  const allExercises = useLiveQuery(() => db.exercises.orderBy('order').toArray(), [], [])

  // mapping: templateId -> exercises[]
  const exercisesByTemplate = useMemo(() => {
    const map = new Map<string, Exercise[]>()
    for (const e of allExercises ?? []) {
      const k = String(e.templateId)
      if (!map.has(k)) map.set(k, [])
      map.get(k)!.push(e)
    }
    for (const [k, arr] of map) arr.sort((a,b) => (a.order ?? 0) - (b.order ?? 0))
    return map
  }, [allExercises])

  // UI state
  const [showAddWorkout, setShowAddWorkout] = useState(false)
  const [addingExerciseFor, setAddingExerciseFor] = useState<string | null>(null)
  const [editingWorkoutId, setEditingWorkoutId] = useState<string | null>(null)
  const [editingExerciseId, setEditingExerciseId] = useState<string | null>(null)

  // ── Start sessie: nu mét sets seeden ─────────────────────────────────────────
  async function startSession(templateId: string) {
    const sessionId = crypto.randomUUID()

    // 1) Sessie aanmaken
    await db.sessions.add({
      id: sessionId,
      templateId,
      startedAt: new Date(),
      endedAt: null,
      notes: '',
    })

    // 2) Oefeningen voor deze workout ophalen
    const exs = await db.exercises.where('templateId').equals(templateId).toArray()

    // 3) Sets genereren op basis van defaults
    const setsToAdd: any[] = []
    for (const ex of exs) {
      const count = Number(ex.defaultSets ?? 0) // respecteer 0 = geen sets
      for (let i = 1; i <= count; i++) {
        setsToAdd.push({
          id: crypto.randomUUID(),
          sessionId,
          exerciseId: String(ex.id),
          setNumber: i,
          reps: Number(ex.defaultReps ?? 0),
          weight: Number(ex.defaultWeight ?? 0),
          rpe: null,
          isWarmup: false,
          completedAt: undefined, // jouw SetLog.completedAt is Date | undefined
        })
      }
    }
    if (setsToAdd.length) {
      await db.sets.bulkAdd(setsToAdd)
    }

    // 4) Naar de sessie
    navigate(`/session/${sessionId}`)
  }

  // ── Exercise CRUD + reorder ──────────────────────────────────────────────────
  async function addExercise(templateId: string, form: ExerciseForm) {
    const order = ((exercisesByTemplate.get(templateId) ?? []).map(e => e.order).reduce((a,b)=>Math.max(a,b), 0)) + 1
    await db.exercises.add({
      id: crypto.randomUUID(),
      templateId,
      name: form.name.trim(),
      defaultSets: Number(form.defaultSets ?? 0),
      defaultReps: Number(form.defaultReps ?? 0),
      defaultWeight: Number(form.defaultWeight ?? 0),
      order
    })
    setAddingExerciseFor(null)
  }

  async function updateExercise(exId: string, form: ExerciseForm) {
    await db.exercises.update(exId, {
      name: form.name.trim(),
      defaultSets: Number(form.defaultSets ?? 0),
      defaultReps: Number(form.defaultReps ?? 0),
      defaultWeight: Number(form.defaultWeight ?? 0),
    })
    setEditingExerciseId(null)
  }

  async function deleteExercise(id: string) {
    if (!confirm('Oefening verwijderen?')) return
    await db.exercises.delete(id)
  }

  async function moveExercise(exId: string, dir: -1 | 1) {
    const ex = (allExercises ?? []).find(e => String(e.id) === String(exId))
    if (!ex) return
    const list = (exercisesByTemplate.get(String(ex.templateId)) ?? []).slice()
    const i = list.findIndex(e => String(e.id) === String(exId))
    const j = i + dir
    if (j < 0 || j >= list.length) return
    const a = list[i], b = list[j]
    await db.exercises.bulkPut([
      { ...a, order: (a.order ?? 0) + dir },
      { ...b, order: (b.order ?? 0) - dir },
    ])
  }

  // ── Workout CRUD ──────────────────────────────────────────────────────────────
  async function addWorkout(form: WorkoutForm) {
    const id = crypto.randomUUID()
    await db.workout_templates.add({ id, name: form.name.trim(), dayOfWeek: form.dayOfWeek })
    setShowAddWorkout(false)
  }

  async function updateWorkout(id: string, form: WorkoutForm) {
    await db.workout_templates.update(id, { name: form.name.trim(), dayOfWeek: form.dayOfWeek })
    setEditingWorkoutId(null)
  }

  async function deleteWorkout(id: string) {
    // eenvoudige blokkade als er data aan hangt
    const exCount = await db.exercises.where('templateId').equals(id).count()
    const sessCount = await db.sessions.where('templateId').equals(id).count()
    if (exCount > 0 || sessCount > 0) {
      alert('Verwijderen is geblokkeerd omdat er al oefeningen/sessies aan hangen.')
      return
    }
    if (!confirm('Workout verwijderen?')) return
    await db.workout_templates.delete(id)
  }

  // ── UI ───────────────────────────────────────────────────────────────────────
  return (
    <div>
      <h1>Planner</h1>
      <p>Kies een workout van deze week en start een sessie. Of bewerk je schema hieronder.</p>

      <div className="toolbar">
        {!showAddWorkout ? (
          <button onClick={() => setShowAddWorkout(true)}>+ Nieuwe workout</button>
        ) : (
          <WorkoutEditor
            title="Nieuwe workout"
            initial={{ name: '', dayOfWeek: 1 }}
            onCancel={() => setShowAddWorkout(false)}
            onSave={addWorkout}
          />
        )}
      </div>

      {(templates ?? []).map(t => {
        const tid = String(t.id)
        const isEditingWorkout = editingWorkoutId === tid
        const list = exercisesByTemplate.get(tid) ?? []

        return (
          <div key={tid} className="card">
            <div className="row">
              <div className="grow">
                <strong>{DAYS[t.dayOfWeek]} · {t.name}</strong>
              </div>
              <div className="actions">
                <button onClick={() => startSession(tid)}>Start sessie</button>
                <button onClick={() => setAddingExerciseFor(tid)}>+ oefening</button>
                {!isEditingWorkout ? (
                  <>
                    <button onClick={() => setEditingWorkoutId(tid)}>Bewerk</button>
                    <button onClick={() => deleteWorkout(tid)}>Verwijder</button>
                  </>
                ) : null}
              </div>
            </div>

            {/* Workout inline editor */}
            {isEditingWorkout && (
              <WorkoutEditor
                title="Bewerk workout"
                initial={{ name: t.name, dayOfWeek: t.dayOfWeek }}
                onSave={(form) => updateWorkout(tid, form)}
                onCancel={() => setEditingWorkoutId(null)}
              />
            )}

            {/* Oefeningen in deze workout */}
            <ul className="sublist">
              {list.map(e => {
                const eid = String(e.id)
                const isEditingExercise = editingExerciseId === eid
                return (
                  <li key={eid} className="subrow">
                    {!isEditingExercise ? (
                      <>
                        <div className="grow">
                          <div><b>{e.name}</b></div>
                          <div className="small">Sets {e.defaultSets} · Reps {e.defaultReps} · {e.defaultWeight} kg</div>
                        </div>
                        <div className="actions">
                          <button onClick={() => moveExercise(eid, -1)}>↑</button>
                          <button onClick={() => moveExercise(eid, +1)}>↓</button>
                          <button onClick={() => setEditingExerciseId(eid)}>Bewerk</button>
                          <button onClick={() => deleteExercise(eid)}>Verwijder</button>
                        </div>
                      </>
                    ) : (
                      <ExerciseEditor
                        title="Bewerk oefening"
                        initial={{ name: e.name, defaultSets: e.defaultSets ?? 0, defaultReps: e.defaultReps ?? 0, defaultWeight: e.defaultWeight ?? 0 }}
                        onSave={(form) => updateExercise(eid, form)}
                        onCancel={() => setEditingExerciseId(null)}
                      />
                    )}
                  </li>
                )
              })}
            </ul>

            {/* Nieuwe oefening toevoegen */}
            {addingExerciseFor === tid && (
              <ExerciseEditor
                title="Nieuwe oefening"
                initial={{ name: '', defaultSets: null, defaultReps: null, defaultWeight: null }}
                onSave={(form) => addExercise(tid, form)}
                onCancel={() => setAddingExerciseFor(null)}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

function WorkoutEditor(props: {
  title: string
  initial: WorkoutForm
  onSave: (form: WorkoutForm) => void
  onCancel: () => void
}) {
  const [form, setForm] = useState<WorkoutForm>(props.initial)
  return (
    <div className="editbox">
      <div className="editbox-head">{props.title}</div>
      <div className="editbox-body">
        <label className="field">
          <span>Naam</span>
          <input value={form.name} onChange={e=>setForm({...form, name: e.target.value})} placeholder="Bijv. Upper" />
        </label>
        <label className="field">
          <span>Dag</span>
          <select value={form.dayOfWeek} onChange={e=>setForm({...form, dayOfWeek: Number(e.target.value)})}>
            <option value={1}>Maandag</option>
            <option value={2}>Dinsdag</option>
            <option value={3}>Woensdag</option>
            <option value={4}>Donderdag</option>
            <option value={5}>Vrijdag</option>
            <option value={6}>Zaterdag</option>
            <option value={7}>Zondag</option>
          </select>
        </label>
      </div>
      <div className="editbox-actions">
        <button onClick={() => props.onSave(form)} disabled={!form.name.trim()}>Opslaan</button>
        <button onClick={props.onCancel}>Annuleren</button>
      </div>
    </div>
  )
}

function ExerciseEditor(props: {
  title: string
  initial: ExerciseForm
  onSave: (form: ExerciseForm) => void
  onCancel: () => void
}) {
  const [form, setForm] = useState<ExerciseForm>(props.initial)
  return (
    <div className="editbox" style={{width:'100%'}}>
      <div className="editbox-head">{props.title}</div>
      <div className="editbox-body" style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:12}}>
        <label className="field">
          <span>Naam</span>
          <input value={form.name} onChange={e=>setForm({...form, name: e.target.value})} placeholder="Bijv. Bench Press" />
        </label>
        <label className="field">
          <span>Sets</span>
          <input
            type="number" min={1} max={10}
            value={toInputValue(form.defaultSets)}
            onChange={e=>setForm({...form, defaultSets: fromInputValue(e.target.value)})}
          />
        </label>
        <label className="field">
          <span>Reps</span>
          <input
            type="number" min={1} max={50}
            value={toInputValue(form.defaultReps)}
            onChange={e=>setForm({...form, defaultReps: fromInputValue(e.target.value)})}
          />
        </label>
        <label className="field">
          <span>Gewicht (kg)</span>
          <input
            type="number" min={0} max={500} step={2.5}
            value={toInputValue(form.defaultWeight)}
            onChange={e=>setForm({...form, defaultWeight: fromInputValue(e.target.value)})}
          />
        </label>
      </div>
      <div className="editbox-actions">
        <button onClick={() => props.onSave(form)} disabled={!form.name.trim()}>Opslaan</button>
        <button onClick={props.onCancel}>Annuleren</button>
      </div>
    </div>
  )
}