import { Hole, RoundPlayer, Score, GameMode } from './supabase'

// ─── Handicap helpers ────────────────────────────────────────────────
export function getExtraStrokes(holeHcp: number, playerHcp: number, totalHoles: number): number {
  const adj = totalHoles === 9 ? Math.round(playerHcp / 2) : playerHcp
  const base = Math.floor(adj / totalHoles)
  const remainder = adj % totalHoles
  return base + (holeHcp <= remainder ? 1 : 0)
}

export function getNetStrokes(strokes: number, holeHcp: number, playerHcp: number, totalHoles: number): number {
  return strokes - getExtraStrokes(holeHcp, playerHcp, totalHoles)
}

// ─── Stableford ──────────────────────────────────────────────────────
export function stablefordPoints(strokes: number | null, par: number, extra: number): number {
  if (!strokes) return 0
  const net = strokes - extra
  return Math.max(0, par - net + 2)
}

export interface StrokeResult {
  playerId: string
  name: string
  gross: number
  net: number
  stableford: number
  overUnder: number
  holesPlayed: number
}

export function calcStroke(
  players: RoundPlayer[],
  scores: Score[],
  holes: Hole[],
  totalHoles: number
): StrokeResult[] {
  return players.map(p => {
    let gross = 0, net = 0, sf = 0, played = 0, par = 0
    holes.forEach(h => {
      const s = scores.find(sc => sc.player_id === p.id && sc.hole_number === h.hole_number)
      if (s?.strokes) {
        const extra = getExtraStrokes(h.handicap, p.handicap, totalHoles)
        gross += s.strokes
        net += s.strokes - extra
        sf += stablefordPoints(s.strokes, h.par, extra)
        par += h.par
        played++
      }
    })
    return {
      playerId: p.id,
      name: p.name,
      gross,
      net,
      stableford: sf,
      overUnder: gross - par,
      holesPlayed: played
    }
  })
}

// ─── Match Play ───────────────────────────────────────────────────────
export interface MatchHoleResult {
  hole: number
  winner: string | null // playerId or 'halved'
  runningStatus: number // positive = p1 leads, negative = p2 leads
}

export interface MatchPlayResult {
  holeResults: MatchHoleResult[]
  status: string  // e.g. "2&1", "All Square", "1 UP"
  leaderId: string | null
  concluded: boolean
  concludedAt: number | null
}

export function calcMatchPlay(
  p1: RoundPlayer,
  p2: RoundPlayer,
  scores: Score[],
  holes: Hole[],
  totalHoles: number
): MatchPlayResult {
  let running = 0
  const holeResults: MatchHoleResult[] = []
  let concluded = false
  let concludedAt: number | null = null

  const holesLeft = (holeIdx: number) => holes.length - holeIdx - 1

  holes.forEach((h, i) => {
    if (concluded) return
    const s1 = scores.find(s => s.player_id === p1.id && s.hole_number === h.hole_number)
    const s2 = scores.find(s => s.player_id === p2.id && s.hole_number === h.hole_number)
    if (!s1?.strokes || !s2?.strokes) return

    const n1 = getNetStrokes(s1.strokes, h.handicap, p1.handicap, totalHoles)
    const n2 = getNetStrokes(s2.strokes, h.handicap, p2.handicap, totalHoles)

    let winner: string | null = null
    if (n1 < n2) { running++; winner = p1.id }
    else if (n2 < n1) { running--; winner = p2.id }
    else winner = 'halved'

    holeResults.push({ hole: h.hole_number, winner, runningStatus: running })

    // Check if match is over (lead > holes remaining)
    if (Math.abs(running) > holesLeft(i)) {
      concluded = true
      concludedAt = h.hole_number
    }
  })

  const leaderId = running > 0 ? p1.id : running < 0 ? p2.id : null
  const abs = Math.abs(running)
  const holesRemaining = holes.length - (holeResults.length)

  let status = 'All Square'
  if (concluded && concludedAt) {
    const holesLeft2 = holes.length - concludedAt
    status = `${abs}&${holesLeft2}`
  } else if (abs > 0) {
    status = `${abs} UP`
  }

  return { holeResults, status, leaderId, concluded, concludedAt }
}

// Match Play Dobles (2v2, mejor bola del equipo)
export interface DoublesResult {
  holeResults: MatchHoleResult[]
  status: string
  leadingTeam: number | null
  concluded: boolean
}

export function calcMatchPlayDobles(
  players: RoundPlayer[],
  scores: Score[],
  holes: Hole[],
  totalHoles: number
): DoublesResult {
  const team1 = players.filter(p => p.team === 1)
  const team2 = players.filter(p => p.team === 2)
  let running = 0
  const holeResults: MatchHoleResult[] = []
  let concluded = false

  holes.forEach((h, i) => {
    if (concluded) return

    // Best ball per team
    const best = (team: RoundPlayer[]) => {
      const nets = team.map(p => {
        const s = scores.find(sc => sc.player_id === p.id && sc.hole_number === h.hole_number)
        if (!s?.strokes) return Infinity
        return getNetStrokes(s.strokes, h.handicap, p.handicap, totalHoles)
      })
      return Math.min(...nets)
    }

    const b1 = best(team1)
    const b2 = best(team2)
    if (b1 === Infinity || b2 === Infinity) return

    let winner: string | null = null
    if (b1 < b2) { running++; winner = 'team1' }
    else if (b2 < b1) { running--; winner = 'team2' }
    else winner = 'halved'

    holeResults.push({ hole: h.hole_number, winner, runningStatus: running })
    if (Math.abs(running) > holes.length - i - 1) concluded = true
  })

  const abs = Math.abs(running)
  const leadingTeam = running > 0 ? 1 : running < 0 ? 2 : null
  const holesRemaining = holes.length - holeResults.length
  let status = 'All Square'
  if (concluded) {
    status = `${abs}&${holesRemaining}`
  } else if (abs > 0) {
    status = `${abs} UP`
  }

  return { holeResults, status, leadingTeam, concluded }
}

// ─── Bismarck ─────────────────────────────────────────────────────────
// 4-2-0 / 4-1-1 / 3-3-0 / 2-2-2
export interface BismarckHoleResult {
  hole: number
  points: { playerId: string; name: string; pts: number }[]
  netStrokes: { playerId: string; strokes: number }[]
}

export interface BismarckResult {
  holeResults: BismarckHoleResult[]
  totals: { playerId: string; name: string; total: number }[]
}

export function calcBismarck(
  players: RoundPlayer[],
  scores: Score[],
  holes: Hole[],
  totalHoles: number
): BismarckResult {
  const totals: Record<string, number> = {}
  players.forEach(p => { totals[p.id] = 0 })

  const holeResults: BismarckHoleResult[] = []

  holes.forEach(h => {
    const nets = players.map(p => {
      const s = scores.find(sc => sc.player_id === p.id && sc.hole_number === h.hole_number)
      const strokes = s?.strokes ?? null
      const net = strokes !== null
        ? getNetStrokes(strokes, h.handicap, p.handicap, totalHoles)
        : null
      return { playerId: p.id, name: p.name, net }
    })

    // Only score if all 3 have entered
    if (nets.some(n => n.net === null)) return

    const sorted = [...nets].sort((a, b) => a.net! - b.net!)
    const [s1, s2, s3] = sorted.map(n => n.net!)

    let pts: number[]
    if (s1 < s2 && s2 < s3) pts = [4, 2, 0]          // todos diferentes
    else if (s1 < s2 && s2 === s3) pts = [4, 1, 1]    // 1° solo, 2° y 3° empatan
    else if (s1 === s2 && s2 < s3) pts = [3, 3, 0]    // 1° y 2° empatan, 3° solo
    else pts = [2, 2, 2]                                // todos empatan

    const result = sorted.map((n, i) => {
      totals[n.playerId] += pts[i]
      return { playerId: n.playerId, name: n.name, pts: pts[i] }
    })

    holeResults.push({
      hole: h.hole_number,
      points: result,
      netStrokes: nets.map(n => ({ playerId: n.playerId, strokes: n.net! }))
    })
  })

  const totalArr = players.map(p => ({
    playerId: p.id,
    name: p.name,
    total: totals[p.id]
  })).sort((a, b) => b.total - a.total)

  return { holeResults, totals: totalArr }
}
