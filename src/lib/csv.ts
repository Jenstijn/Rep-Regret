import { db } from './db'
import { volume } from './metrics'

export async function exportCSV(): Promise<string> {
  const sessions = await db.sessions.toArray()
  const sets = await db.sets.toArray()
  const templates = await db.workout_templates.toArray()
  const exercises = await db.exercises.toArray()

  const header = 'session_id,session_date,workout,exercise,set_number,reps,weight,volume'
  const rows = [header]

  for (const s of sessions) {
    const workout = templates.find(t => t.id === s.templateId)?.name ?? 'Workout'
    const sessSets = sets.filter(x => x.sessionId === s.id).sort((a,b)=>a.completedAt.getTime()-b.completedAt.getTime())
    for (const set of sessSets) {
      const ex = exercises.find(e => e.id === set.exerciseId)?.name ?? 'Exercise'
      const vol = volume(set.weight, set.reps)
      rows.push([
        s.id,
        new Date(s.startedAt).toISOString(),
        quote(workout),
        quote(ex),
        set.setNumber,
        set.reps,
        set.weight,
        vol
      ].join(','))
    }
  }
  return rows.join('\n')
}

function quote(v: string) {
  const s = String(v)
  return /[",\n]/.test(s) ? `"${s.replaceAll('"','""')}"` : s
}

export function download(filename: string, content: string, mime='text/csv') {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
