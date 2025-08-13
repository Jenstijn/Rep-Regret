//src/lib/db.ts
import Dexie, { Table } from 'dexie'
import type { WorkoutTemplate, Exercise, Session, SetLog } from '../types'

type Meta = { key: string; value: string }

class RepRegretDB extends Dexie {
  workout_templates!: Table<WorkoutTemplate, string>
  exercises!: Table<Exercise, string>
  sessions!: Table<Session, string>
  sets!: Table<SetLog, string>
  meta!: Table<Meta, string>

  constructor() {
    super('repregret')

    // v1: basis-tabellen
    this.version(1).stores({
      workout_templates: 'id, dayOfWeek, name',
      exercises: 'id, templateId, order',
      sessions: 'id, templateId, startedAt, endedAt',
      sets: 'id, sessionId, exerciseId, completedAt',
    })

    // v2: meta-tabel (voor seeded-vlag e.d.)
    this.version(2).stores({
      workout_templates: 'id, dayOfWeek, name',
      exercises: 'id, templateId, order',
      sessions: 'id, templateId, startedAt, endedAt',
      sets: 'id, sessionId, exerciseId, completedAt',
      meta: 'key',
    })
  }
}

export const db = new RepRegretDB()

/**
 * Seed data exact één keer. Door transactie + meta-flag vermijden we dubbele seeds
 * (bijv. door React StrictMode dubbele effect-calls in development).
 */
export async function ensureSeeded() {
  await db.transaction('rw', db.meta, db.workout_templates, db.exercises, async () => {
    const seeded = await db.meta.get('seeded')
    if (seeded) return

    const upperId = crypto.randomUUID()
    const lowerId = crypto.randomUUID()

    await db.workout_templates.bulkAdd([
      { id: upperId, name: 'Upper', dayOfWeek: 1 },
      { id: lowerId, name: 'Lower', dayOfWeek: 3 },
    ])

    await db.exercises.bulkAdd([
      { id: crypto.randomUUID(), templateId: upperId, name: 'Bench Press', defaultSets: 5, defaultReps: 5, defaultWeight: 40, order: 1 },
      { id: crypto.randomUUID(), templateId: upperId, name: 'Row',         defaultSets: 4, defaultReps: 8, defaultWeight: 30, order: 2 },
      { id: crypto.randomUUID(), templateId: lowerId, name: 'Back Squat',  defaultSets: 5, defaultReps: 5, defaultWeight: 50, order: 1 },
      { id: crypto.randomUUID(), templateId: lowerId, name: 'Romanian Deadlift', defaultSets: 4, defaultReps: 8, defaultWeight: 40, order: 2 },
    ])

    await db.meta.put({ key: 'seeded', value: '1' })
  })
}

/**
 * Verwijder per ongeluk dubbele templates (zelfde naam + dag) ZONDER gekoppelde sessies.
 * Houd de eerste, verwijder de rest (incl. bijbehorende exercises).
 */
export async function dedupeTemplates() {
  const templates = await db.workout_templates.toArray()
  const byKey = new Map<string, WorkoutTemplate[]>()

  for (const t of templates) {
    const key = `${t.dayOfWeek}::${t.name.trim().toLowerCase()}`
    const arr = byKey.get(key) ?? []
    arr.push(t)
    byKey.set(key, arr)
  }

  for (const [_, group] of byKey) {
    if (group.length <= 1) continue
    const [keep, ...dupes] = group
    for (const d of dupes) {
      const hasSessions = await db.sessions.where('templateId').equals(d.id).count()
      if (hasSessions > 0) continue // veiligheid: niet verwijderen als gebruikt
      // verwijder exercises + template
      const exIds = await db.exercises.where('templateId').equals(d.id).primaryKeys()
      if (exIds.length) await db.exercises.bulkDelete(exIds as string[])
      await db.workout_templates.delete(d.id)
    }
  }
}