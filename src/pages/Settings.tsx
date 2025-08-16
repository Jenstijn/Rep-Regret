//src/pages/Settings.tsx
import React, { useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../lib/db'

type BackupShape = {
  app: 'rep-regret',
  version: 1,
  exportedAt: string,
  data: {
    workout_templates: any[],
    exercises: any[],
    sessions: any[],
    sets: any[],
    meta: any[],
  }
}

export default function Settings() {
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)

  const [tCount, eCount, sCount, setCount] = useLiveQuery(async () => {
    const [t, e, s, st] = await Promise.all([
      db.workout_templates.count(),
      db.exercises.count(),
      db.sessions.count(),
      db.sets.count(),
    ])
    return [t, e, s, st]
  }, [], [0,0,0,0])!

  const total = useMemo(() => tCount + eCount + sCount + setCount, [tCount, eCount, sCount, setCount])

  async function exportJSON() {
    setBusy(true)
    try {
      const [workout_templates, exercises, sessions, sets, meta] = await Promise.all([
        db.workout_templates.toArray(),
        db.exercises.toArray(),
        db.sessions.toArray(),
        db.sets.toArray(),
        db.meta.toArray(),
      ])
      const payload: BackupShape = {
        app: 'rep-regret',
        version: 1,
        exportedAt: new Date().toISOString(),
        data: { workout_templates, exercises, sessions, sets, meta },
      }
      const fname = `repregret-backup-${new Date().toISOString().slice(0,19).replace(/[:T]/g,'-')}.repregret.json`
      const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = fname
      a.click()
      URL.revokeObjectURL(a.href)
    } finally {
      setBusy(false)
    }
  }

  function onPickFile() { inputRef.current?.click() }

  async function importJSONReplace(ev: React.ChangeEvent<HTMLInputElement>) {
    const file = ev.target.files?.[0]
    ev.target.value = ''
    if (!file) return

    try {
      const parsed = JSON.parse(await file.text()) as BackupShape
      if (!parsed || parsed.app !== 'rep-regret' || parsed.version !== 1 || !parsed.data) {
        alert('Dit bestand lijkt geen geldige Rep & Regret backup.')
        return
      }
      const ok1 = confirm('Backup importeren en ALLE huidige data vervangen?')
      if (!ok1) return
      const ok2 = confirm('Weet je het zeker? Dit kan niet ongedaan worden gemaakt.')
      if (!ok2) return

      setBusy(true)
      // ✅ Belangrijk: tabellen als array meegeven i.p.v. 5 losse args
      await db.transaction(
        'rw',
        [db.workout_templates, db.exercises, db.sessions, db.sets, db.meta],
        async () => {
          await Promise.all([
            db.sets.clear(),
            db.sessions.clear(),
            db.exercises.clear(),
            db.workout_templates.clear(),
            db.meta.clear(),
          ])
          await db.workout_templates.bulkAdd(parsed.data.workout_templates)
          await db.exercises.bulkAdd(parsed.data.exercises)
          await db.sessions.bulkAdd(parsed.data.sessions)
          await db.sets.bulkAdd(parsed.data.sets)
          await db.meta.bulkAdd(parsed.data.meta)
        }
      )
      alert('Backup geïmporteerd. De app wordt herladen.')
      navigate('/', { replace: true })
      location.reload()
    } catch (err) {
      console.error(err)
      alert('Import mislukt. Is het bestand compleet en ongewijzigd?')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <h1>Instellingen</h1>

      <div className="card">
        <div className="row">
          <div>
            <strong>Data & backups</strong><br/>
            <span className="small">
              {total} items · Templates {tCount}, Oefeningen {eCount}, Sessies {sCount}, Sets {setCount}.
            </span>
          </div>
        </div>

        <div className="row" style={{justifyContent:'flex-start', gap:12}}>
          <button onClick={exportJSON} disabled={busy}>Exporteren (JSON)</button>
          <input ref={inputRef} type="file" accept=".json,.repregret.json,application/json" style={{display:'none'}} onChange={importJSONReplace}/>
          <button onClick={onPickFile} disabled={busy}>Importeren (vervangt alles)</button>
          <Link to="/history" className="small" style={{marginLeft:8}}>CSV-export staat bij <b>Historie</b>.</Link>
        </div>

        <ul className="sublist" style={{marginTop:8}}>
          <li className="subrow" style={{borderBottom:'none'}}>
            <div className="grow small">
              Tip: bewaar de JSON-backup in iCloud/Drive. Import vervangt alle lokale data.
            </div>
          </li>
        </ul>
      </div>
    </div>
  )
}