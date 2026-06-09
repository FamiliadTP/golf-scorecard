import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseKey)

export type GameMode = 'stroke' | 'matchplay_individual' | 'matchplay_dobles' | 'bismarck' | 'combinado_4' | 'combinado_bismarck'

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
  dobles_mode?: 'stroke' | 'matchplay'
  dobles_hcp_pct?: number
  individual_mode?: 'stroke' | 'matchplay'
  individual_hcp_pct?: number
  bismarck_hcp_pct?: number
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

// Jugador registrado (lista maestra)
export interface Player {
  id: string
  name: string
  last_handicap: number
}
