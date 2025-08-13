//src/pages/Progress.tsx
import React, { useEffect, useMemo, useState } from 'react'
import { db } from '../lib/db'
import { est1RM, volume } from '../lib/metrics'
import type { Exercise, SetLog } from '../types'

// Chart.js + React wrapper
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend
} from 'chart.js'
import { Line } from 'react-chartjs-2'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend)

type Metric = 'weight' | 'volume' | 'est1rm'
type Range = 7 | 30 | 90 | 'all'

type Row = {
  date: string // YYYY-MM-DD
  value: number
}

export default function Progress() {
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [sets, setSets] = useState<SetLog[]>([])
  const [sessions, setSessions] = useState<any[]>([]) // session heeft Date velden

  const [exerciseId, setExerciseId] = useState<string | null>(null)
  const [metric, setMetric] = useState<Metric>('weight')
  const [range, setRange] = useState<Range>(30)
  const [excludeWarmup, setExcludeWarmup] = useState(true)
  const [showSMA, setShowSMA] = useState(true)

  useEffect(() => {
    ;(async () => {
      const exs = await db.exercises.toArray()
      const st = await db.sets.toArray()
      const ss = await db.sessions.toArray()
      setExercises(exs)
      setSets(st)
      setSessions(ss)
      if (!exerciseId && exs.length) setExerciseId(exs[0].id)
    })()
  }, []) // initial load

  const dataRows = useMemo(() => {
    if (!exerciseId) return []
    // join sets -> sessions (datum per sessie)
    const rows: Record<string, number[]> = {} // date -> values (per set)
    for (const s of sets) {
      if (s.exerciseId !== exerciseId) continue
      if (excludeWarmup && s.isWarmup) continue
      const sess = sessions.find(ss => ss.id === s.sessionId)
      if (!sess || !sess.startedAt) continue
      const date = toDateKey(sess.startedAt)
      const val =
        metric === 'weight' ? s.weight :
        metric === 'volume' ? volume(s.weight, s.reps) :
        est1RM(s.weight, s.reps)
      if (!rows[date]) rows[date] = []
      rows[date].push(val)
    }
    // reduce per dag: weight -> max, est1rm -> max, volume -> sum
    const out: Row[] = Object.entries(rows).map(([date, vals]) => {
      const value = (metric === 'volume') ? vals.reduce((a,b)=>a+b,0) : Math.max(...vals)
      return { date, value }
    })
    // sort ascending
    out.sort((a,b) => a.date.localeCompare(b.date))

    // range filter
    const filtered = applyRange(out, range)
    return filtered
  }, [exerciseId, metric, excludeWarmup, range, sets, sessions])

  const smaRows = useMemo(() => (showSMA ? SMA(dataRows, 7) : []), [dataRows, showSMA])

  const chartData = useMemo(() => {
    const labels = dataRows.map(r => r.date)
    return {
      labels,
      datasets: [
        {
          label: labelFor(metric),
          data: dataRows.map(r => r.value),
          borderWidth: 2,
          pointRadius: 2,
          tension: 0.25,
        },
        ...(showSMA ? [{
          label: `${labelFor(metric)} (7-d SMA)`,
          data: smaRows.map(r => r?.value ?? null),
          borderWidth: 2,
          pointRadius: 0,
          borderDash: [6,4],
          tension: 0.25,
        }] : [])
      ]
    }
  }, [dataRows, smaRows, metric, showSMA])

  const chartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index' as const, intersect: false },
    plugins: {
      legend: { display: true },
      tooltip: { enabled: true }
    },
    scales: {
      x: {
        ticks: { autoSkip: true, maxTicksLimit: 8 }
      },
      y: {
        beginAtZero: true,
      }
    }
  }), [])

  const currentExerciseName = exercises.find(e => e.id === exerciseId)?.name ?? '—'

  return (
    <div>
      <h1>Progressie</h1>

      {exercises.length === 0 ? (
        <p>Geen oefeningen gevonden. Voeg eerst oefeningen toe in de Planner.</p>
      ) : (
        <>
          {/* Controls */}
          <div style={{display:'grid', gap:10, gridTemplateColumns:'1fr'}}>
            <label className="field">
              <span>Oefening</span>
              <select value={exerciseId ?? ''} onChange={e => setExerciseId(e.target.value)}>
                {exercises.map(ex => <option key={ex.id} value={ex.id}>{ex.name}</option>)}
              </select>
            </label>

            <div className="toolbar" style={{display:'flex', gap:8, flexWrap:'wrap', alignItems:'center'}}>
              <strong>Metriek:</strong>
              <Segmented value={metric} onChange={(v)=>setMetric(v as Metric)} options={[
                {value:'weight', label:'Gewicht (max/dag)'},
                {value:'volume', label:'Volume (som/dag)'},
                {value:'est1rm', label:'est. 1RM (max/dag)'},
              ]}/>
            </div>

            <div className="toolbar" style={{display:'flex', gap:8, flexWrap:'wrap', alignItems:'center'}}>
              <strong>Periode:</strong>
              <Segmented value={String(range)} onChange={(v)=>setRange(v==='all'?'all':(Number(v) as Range))} options={[
                {value:'7', label:'7d'},
                {value:'30', label:'30d'},
                {value:'90', label:'90d'},
                {value:'all', label:'Alles'},
              ]}/>
              <label style={{display:'flex', alignItems:'center', gap:6}}>
                <input type="checkbox" checked={excludeWarmup} onChange={e=>setExcludeWarmup(e.target.checked)} />
                Warm-ups uitsluiten
              </label>
              <label style={{display:'flex', alignItems:'center', gap:6}}>
                <input type="checkbox" checked={showSMA} onChange={e=>setShowSMA(e.target.checked)} />
                7-dagen gemiddelde
              </label>
            </div>
          </div>

          {/* Chart */}
          <div style={{height: 340, marginTop: 12}}>
            {dataRows.length === 0 ? (
              <div className="small">Nog geen data voor <strong>{currentExerciseName}</strong> in deze periode.</div>
            ) : (
              <Line data={chartData as any} options={chartOptions as any} />
            )}
          </div>

          {/* Tabel (optioneel voor debug) */}
          {/* <pre>{JSON.stringify(dataRows, null, 2)}</pre> */}
        </>
      )}
    </div>
  )
}

// Helpers
function toDateKey(d: Date | string) {
  const dt = new Date(d)
  return dt.toISOString().slice(0,10) // YYYY-MM-DD
}

function labelFor(metric: Metric) {
  switch(metric) {
    case 'weight': return 'Gewicht (kg)'
    case 'volume': return 'Volume (kg·reps)'
    case 'est1rm': return 'Geschatte 1RM (kg)'
  }
}

function applyRange(rows: Row[], range: Range): Row[] {
  if (range === 'all') return rows
  const now = new Date()
  const from = new Date(now)
  from.setDate(from.getDate() - range + 1)
  return rows.filter(r => new Date(r.date) >= from)
}

function SMA(rows: Row[], window: number): (Row | null)[] {
  if (rows.length === 0) return []
  const out: (Row | null)[] = []
  const vals = rows.map(r => r.value)
  for (let i=0;i<rows.length;i++) {
    const start = Math.max(0, i - window + 1)
    const slice = vals.slice(start, i+1)
    const avg = slice.reduce((a,b)=>a+b,0) / slice.length
    out.push({ date: rows[i].date, value: Number(avg.toFixed(2)) })
  }
  return out
}

// Mini segmented control
function Segmented(props: { value: string, options: {value:string, label:string}[], onChange:(v:string)=>void }) {
  return (
    <div style={{display:'flex', gap:6, flexWrap:'wrap'}}>
      {props.options.map(opt => (
        <button
          key={opt.value}
          onClick={()=>props.onChange(opt.value)}
          style={{
            padding:'6px 10px',
            border:'1px solid var(--line)',
            borderRadius:8,
            background: props.value === opt.value ? '#111' : '#f9f9f9',
            color: props.value === opt.value ? '#fff' : '#111',
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}