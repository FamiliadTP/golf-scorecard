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
  // Para modos combinados, config de handicap y modalidad
  dobles_mode?: 'stroke' | 'matchplay'
  dobles_hcp_pct?: number       // 0, 80, 100
  individual_mode?: 'stroke' | 'matchplay'
  individual_hcp_pct?: number   // 0, 80, 100
  // Para combinado_bismarck
  bismarck_hcp_pct?: number
  course?: Course
  players?: RoundPlayer[]
}

export interface RoundPlayer {
  id: string
  round_id: string
  name: string
  handicap: number
  team?: number   // 1 o 2 para dobles dentro de combinado_4
  position: number
}

export interface Score {
  id?: string
  round_id: string
  player_id: string
  hole_number: number
  strokes: number | null
}
