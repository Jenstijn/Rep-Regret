export type ID = string

export interface WorkoutTemplate {
  id: ID
  name: string
  dayOfWeek: number // 1=Mon ... 7=Sun
}

export interface Exercise {
  id: ID
  templateId: ID
  name: string
  defaultSets: number
  defaultReps: number
  defaultWeight: number
  order: number
}

export interface Session {
  id: ID
  templateId: ID
  startedAt: Date
  endedAt?: Date | null
  notes?: string
}

export interface SetLog {
  id: ID
  sessionId: ID
  exerciseId: ID
  setNumber: number
  reps: number
  weight: number
  rpe?: number | null
  isWarmup?: boolean
  completedAt: Date
}
