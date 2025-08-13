import React from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../lib/db'
import { exportCSV, download } from '../lib/csv'

export default function History() {
  const sessions = useLiveQuery(() => db.sessions.orderBy('startedAt').reverse().toArray(), [], [])

  async function onExport() {
    const csv = await exportCSV()
    download(`repregret_${new Date().toISOString().slice(0,10)}.csv`, csv)
  }

  return (
    <div>
      <h1>Historie</h1>
      <button onClick={onExport}>Exporteer CSV</button>
      <ul style={{padding:0, listStyle:'none', marginTop:12}}>
        {sessions?.map(s => (
          <li key={s.id} style={{padding:'8px 0', borderBottom:'1px solid #eee'}}>
            <div><strong>{formatDate(s.startedAt)}</strong> – {s.endedAt ? 'Afgerond' : 'Bezig'}</div>
          </li>
        ))}
      </ul>
    </div>
  )
}

function formatDate(d: Date) {
  const dt = new Date(d)
  return dt.toLocaleString()
}
