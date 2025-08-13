//src/lib/csv.ts
import { db } from './db'
import { volume, est1RM } from './metrics'

export async function exportCSV(): Promise<string> {
  const sessions = await db.sessions.toArray()
  const sets = await db.sets.toArray()
  const templates = await db.workout_templates.toArray()
  const exercises = await db.exercises.toArray()

  const header = 'session_id,session_date,workout,exercise,set_number,reps,weight,rpe,is_warmup,volume,est_1rm'
  const rows = [header]

  for (const s of sessions) {
    const workout = templates.find(t => t.id === s.templateId)?.name ?? 'Workout'
    const sessSets = sets
      .filter(x => x.sessionId === s.id)
      .sort((a,b)=> new Date(a.completedAt).getTime() - new Date(b.completedAt).getTime())

    for (const set of sessSets) {
      const ex = exercises.find(e => e.id === set.exerciseId)?.name ?? 'Exercise'
      const vol = volume(set.weight, set.reps)
      const e1 = est1RM(set.weight, set.reps)
      rows.push([
        s.id,
        new Date(s.startedAt).toISOString(),
        quote(workout),
        quote(ex),
        set.setNumber,
        set.reps,
        set.weight,
        set.rpe ?? '',
        set.isWarmup ? 1 : 0,
        vol,
        e1.toFixed(2)
      ].join(','))
    }
  }
  return rows.join('\n')
}

// ES2020-safe: geen replaceAll; gebruik regex global replace
function quote(v: string) {
  const s = String(v)
  if (/[",\n]/.test(s)) {
    return '"' + s.replace(/"/g, '""') + '"'
  }
  return s
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