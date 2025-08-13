//src/pages/Planner.tsx
import React, { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../lib/db'
import type { Exercise, WorkoutTemplate } from '../types'
import { useNavigate } from 'react-router-dom'

type WorkoutForm = { name: string; dayOfWeek: number }
type ExerciseForm = { name: string; defaultSets: number; defaultReps: number; defaultWeight: number }

const DAYS = ['', 'Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo']

export default function Planner() {
  const navigate = useNavigate()
  const templates = useLiveQuery(() => db.workout_templates.orderBy('dayOfWeek').toArray(), [], [])
  const allExercises = useLiveQuery(() => db.exercises.orderBy('order').toArray(), [], [])
  const sessions = useLiveQuery(() => db.sessions.toArray(), [], [])

  const [showAddWorkout, setShowAddWorkout] = useState(false)
  const [editingWorkoutId, setEditingWorkoutId] = useState<string | null>(null)
  const [addingExerciseFor, setAddingExerciseFor] = useState<string | null>(null)
  const [editingExerciseId, setEditingExerciseId] = useState<string | null>(null)

  const exercisesByTemplate = useMemo(() => {
    const map = new Map<string, Exercise[]>()
    ;(allExercises ?? []).forEach(e => {
      const arr = map.get(e.templateId) ?? []
      arr.push(e)
      map.set(e.templateId, arr)
    })
    return map
  }, [allExercises])

  async function startSession(templateId: string) {
    const id = crypto.randomUUID()
    await db.sessions.add({ id, templateId, startedAt: new Date(), endedAt: null, notes: '' })
    navigate(`/session/${id}`)
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
  async function deleteWorkout(t: WorkoutTemplate) {
    const sessCount = await db.sessions.where('templateId').equals(t.id).count()
    if (sessCount > 0) return alert('Kan niet verwijderen: er bestaan sessies voor deze workout.')
    // verwijder exercises onder deze template
    const exIds = await db.exercises.where('templateId').equals(t.id).primaryKeys()
    if (exIds.length) await db.exercises.bulkDelete(exIds as string[])
    await db.workout_templates.delete(t.id)
  }

  // ── Exercise CRUD + reorder ──────────────────────────────────────────────────
  async function addExercise(templateId: string, form: ExerciseForm) {
    const order = ((exercisesByTemplate.get(templateId) ?? []).map(e => e.order).reduce((a,b)=>Math.max(a,b), 0)) + 1
    await db.exercises.add({
      id: crypto.randomUUID(),
      templateId,
      name: form.name.trim(),
      defaultSets: form.defaultSets,
      defaultReps: form.defaultReps,
      defaultWeight: form.defaultWeight,
      order
    })
    setAddingExerciseFor(null)
  }

  async function updateExercise(exId: string, form: ExerciseForm) {
    await db.exercises.update(exId, {
      name: form.name.trim(),
      defaultSets: form.defaultSets,
      defaultReps: form.defaultReps,
      defaultWeight: form.defaultWeight
    })
    setEditingExerciseId(null)
  }

  async function deleteExercise(ex: Exercise) {
    const setCount = await db.sets.where('exerciseId').equals(ex.id).count()
    if (setCount > 0) return alert('Kan niet verwijderen: er zijn sets gelogd met deze oefening.')
    await db.exercises.delete(ex.id)
  }

  async function moveExercise(ex: Exercise, dir: -1 | 1) {
    const list = (exercisesByTemplate.get(ex.templateId) ?? []).slice().sort((a,b)=>a.order-b.order)
    const idx = list.findIndex(e => e.id === ex.id)
    const targetIdx = idx + dir
    if (targetIdx < 0 || targetIdx >= list.length) return
    const other = list[targetIdx]
    // swap orders
    await db.transaction('rw', db.exercises, async () => {
      await db.exercises.update(ex.id, { order: other.order })
      await db.exercises.update(other.id, { order: ex.order })
    })
  }

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

      <ul className="list">
        {(templates ?? []).map(t => (
          <li key={t.id} className="card">
            <div className="row">
              <div><strong>{DAYS[t.dayOfWeek]}</strong> — {t.name}</div>
              <div className="actions">
                <button onClick={() => startSession(t.id)}>Start</button>
                <button onClick={() => setEditingWorkoutId(editingWorkoutId === t.id ? null : t.id)}>Bewerk</button>
                <button onClick={() => deleteWorkout(t)}>Verwijder</button>
              </div>
            </div>

            {editingWorkoutId === t.id && (
              <WorkoutEditor
                title="Bewerk workout"
                initial={{ name: t.name, dayOfWeek: t.dayOfWeek }}
                onCancel={() => setEditingWorkoutId(null)}
                onSave={(form) => updateWorkout(t.id, form)}
              />
            )}

            <div className="subhead">Oefeningen</div>
            <ul className="sublist">
              {(exercisesByTemplate.get(t.id) ?? []).sort((a,b)=>a.order-b.order).map(ex => (
                <li key={ex.id} className="subrow">
                  {editingExerciseId === ex.id ? (
                    <ExerciseEditor
                      initial={{
                        name: ex.name,
                        defaultSets: ex.defaultSets,
                        defaultReps: ex.defaultReps,
                        defaultWeight: ex.defaultWeight
                      }}
                      onCancel={() => setEditingExerciseId(null)}
                      onSave={(form) => updateExercise(ex.id, form)}
                    />
                  ) : (
                    <>
                      <div className="grow">
                        <strong>{ex.name}</strong>
                        <div className="small">Sets {ex.defaultSets} • Reps {ex.defaultReps} • {ex.defaultWeight} kg</div>
                      </div>
                      <div className="actions">
                        <button onClick={() => moveExercise(ex, -1)}>↑</button>
                        <button onClick={() => moveExercise(ex, +1)}>↓</button>
                        <button onClick={() => setEditingExerciseId(ex.id)}>Bewerk</button>
                        <button onClick={() => deleteExercise(ex)}>Verwijder</button>
                      </div>
                    </>
                  )}
                </li>
              ))}
            </ul>

            {addingExerciseFor === t.id ? (
              <ExerciseEditor
                initial={{ name: '', defaultSets: 3, defaultReps: 10, defaultWeight: 0 }}
                onCancel={() => setAddingExerciseFor(null)}
                onSave={(form) => addExercise(t.id, form)}
              />
            ) : (
              <div className="toolbar">
                <button onClick={() => setAddingExerciseFor(t.id)}>+ Oefening toevoegen</button>
              </div>
            )}
          </li>
        ))}
      </ul>

      <p className="small" style={{marginTop:16}}>
        Seed templates zijn toegevoegd voor een snelle start. Je kunt alles hier bewerken of verwijderen. Verwijderen is geblokkeerd als er al data aan hangt.
      </p>
    </div>
  )
}

// ── Kleine inline editors ───────────────────────────────────────────────────────
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
            {[1,2,3,4,5,6,7].map(n => <option key={n} value={n}>{DAYS[n]}</option>)}
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
  initial: ExerciseForm
  onSave: (form: ExerciseForm) => void
  onCancel: () => void
}) {
  const [form, setForm] = useState<ExerciseForm>(props.initial)
  return (
    <div className="editbox">
      <div className="editbox-body grid">
        <label className="field">
          <span>Naam</span>
          <input value={form.name} onChange={e=>setForm({...form, name: e.target.value})} placeholder="Bijv. Bench Press" />
        </label>
        <label className="field">
          <span>Sets</span>
          <input type="number" min={1} max={10} value={form.defaultSets} onChange={e=>setForm({...form, defaultSets: Number(e.target.value)})}/>
        </label>
        <label className="field">
          <span>Reps</span>
          <input type="number" min={1} max={50} value={form.defaultReps} onChange={e=>setForm({...form, defaultReps: Number(e.target.value)})}/>
        </label>
        <label className="field">
          <span>Gewicht (kg)</span>
          <input type="number" min={0} max={500} step={2.5} value={form.defaultWeight} onChange={e=>setForm({...form, defaultWeight: Number(e.target.value)})}/>
        </label>
      </div>
      <div className="editbox-actions">
        <button onClick={() => props.onSave(form)} disabled={!form.name.trim()}>Opslaan</button>
        <button onClick={props.onCancel}>Annuleren</button>
      </div>
    </div>
  )
}