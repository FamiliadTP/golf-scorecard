import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseKey)

export type GameMode = 'stroke' | 'matchplay_individual' | 'matchplay_dobles' | 'bismarck'

export interface Course {
  id: string
  name: string
  club: string
  holes_count: number
  holes: Hole[]
}

export interface Hole {
  id?: string
  course_id?: string
  hole_number: number
  par: number
  handicap: number
}

export interface Round {
  id: string
  course_id: string
  mode: GameMode
  holes_played: number
  date: string
  course?: Course
  players?: RoundPlayer[]
}

export interface RoundPlayer {
  id: string
  round_id: string
  name: string
  handicap: number
  team?: number
  position: number
}

export interface Score {
  id?: string
  round_id: string
  player_id: string
  hole_number: number
  strokes: number | null
}
