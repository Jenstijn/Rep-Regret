import React, { useEffect, useMemo, useState } from 'react'
import { db } from '../lib/db'
import { est1RM, volume } from '../lib/metrics'

// Minimal placeholder: computes simple totals per exercise name.
export default function Progress() {
  const [data, setData] = useState<{exercise: string, date: string, weight: number, reps: number, vol: number, est1RM: number}[]>([])

  useEffect(() => {
    (async () => {
      const sets = await db.sets.toArray()
      const exercises = await db.exercises.toArray()
      const sessions = await db.sessions.toArray()
      const map: any[] = []
      for (const set of sets) {
        const ex = exercises.find(e => e.id === set.exerciseId)
        const sess = sessions.find(s => s.id === set.sessionId)
        if (!ex || !sess) continue
        const d = new Date(sess.startedAt).toISOString().slice(0,10)
        map.push({
          exercise: ex.name,
          date: d,
          weight: set.weight,
          reps: set.reps,
          vol: volume(set.weight, set.reps),
          est1RM: est1RM(set.weight, set.reps)
        })
      }
      setData(map)
    })()
  }, [])

  return (
    <div>
      <h1>Progressie</h1>
      <p>(Placeholder) Hieronder ruwe logs per set. We voegen later mooie grafieken toe.</p>
      <table style={{width:'100%', borderCollapse:'collapse'}}>
        <thead>
          <tr><th style={th}>Oefening</th><th style={th}>Datum</th><th style={th}>Gewicht</th><th style={th}>Reps</th><th style={th}>Volume</th><th style={th}>est. 1RM</th></tr>
        </thead>
        <tbody>
          {data.map((r, i) => (
            <tr key={i}>
              <td style={td}>{r.exercise}</td>
              <td style={td}>{r.date}</td>
              <td style={td}>{r.weight}</td>
              <td style={td}>{r.reps}</td>
              <td style={td}>{r.vol.toFixed(1)}</td>
              <td style={td}>{r.est1RM.toFixed(1)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const th: React.CSSProperties = {textAlign:'left', borderBottom:'1px solid #ddd', padding:'6px'}
const td: React.CSSProperties = {borderBottom:'1px solid #eee', padding:'6px'}
