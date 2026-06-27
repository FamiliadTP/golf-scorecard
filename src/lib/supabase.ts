import { createClient, SupabaseClient } from '@supabase/supabase-js'

let _supabase: SupabaseClient | null = null

function getSupabase(): SupabaseClient {
  if (!_supabase) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!url || !key) throw new Error('Supabase env vars not set')
    _supabase = createClient(url, key)
  }
  return _supabase
}

// Proxy para mantener compatibilidad con supabase.from(...) etc.
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    return (getSupabase() as any)[prop]
  }
})

export type GameMode = 'stroke' | 'matchplay_individual' | 'matchplay_dobles' | 'bismarck' | 'combinado_4' | 'combinado_bismarck' | 'mejor_peor_suma' | 'stroke_grupal'

export interface Course {
  id: string
  name: string
  club: string
  holes_count: number
  loop_label?: string | null
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
  second_course_id?: string | null
  mode: GameMode
  holes_played: number
  date: string
  hcp_pct?: number
  dobles_mode?: 'stroke' | 'matchplay'
  dobles_hcp_pct?: number
  individual_mode?: 'stroke' | 'matchplay'
  individual_hcp_pct?: number
  bismarck_hcp_pct?: number
  grupal?: boolean
  competition_name?: string | null
  side_match?: 'none' | 'dobles' | 'singles'
  side_hcp_pct?: number
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

export interface Player {
  id: string
  name: string
  last_handicap: number
}
