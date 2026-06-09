import { Hole, RoundPlayer, Score } from './supabase'

// ─── Handicap helpers ────────────────────────────────────────────────

export function getExtraStrokes(holeHcp: number, playerHcp: number, totalHoles: number, pct: number = 100): number {
  const adj = Math.round((totalHoles === 9 ? playerHcp / 2 : playerHcp) * pct / 100)
  const base = Math.floor(adj / totalHoles)
  const remainder = adj % totalHoles
  return base + (holeHcp <= remainder ? 1 : 0)
}

export function getNetStrokes(strokes: number, holeHcp: number, playerHcp: number, totalHoles: number, pct: number = 100): number {
  return strokes - getExtraStrokes(holeHcp, playerHcp, totalHoles, pct)
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
  players: RoundPlayer[], scores: Score[], holes: Hole[], totalHoles: number, pct: number = 100
): StrokeResult[] {
  return players.map(p => {
    let gross = 0, net = 0, sf = 0, played = 0, par = 0
    holes.forEach(h => {
      const s = scores.find(sc => sc.player_id === p.id && sc.hole_number === h.hole_number)
      if (s?.strokes) {
        const extra = getExtraStrokes(h.handicap, p.handicap, totalHoles, pct)
        gross += s.strokes
        net += s.strokes - extra
        sf += stablefordPoints(s.strokes, h.par, extra)
        par += h.par
        played++
      }
    })
    return { playerId: p.id, name: p.name, gross, net, stableford: sf, overUnder: gross - par, holesPlayed: played }
  })
}

// ─── Match Play Individual ────────────────────────────────────────────

export interface MatchHoleResult {
  hole: number
  winner: string | null
  runningStatus: number
}

export interface MatchPlayResult {
  holeResults: MatchHoleResult[]
  status: string
  leaderId: string | null
  concluded: boolean
  concludedAt: number | null
}

export function calcMatchPlay(
  p1: RoundPlayer, p2: RoundPlayer,
  scores: Score[], holes: Hole[], totalHoles: number, pct: number = 100
): MatchPlayResult {
  let running = 0
  const holeResults: MatchHoleResult[] = []
  let concluded = false
  let concludedAt: number | null = null

  holes.forEach((h, i) => {
    if (concluded) return
    const s1 = scores.find(s => s.player_id === p1.id && s.hole_number === h.hole_number)
    const s2 = scores.find(s => s.player_id === p2.id && s.hole_number === h.hole_number)
    if (!s1?.strokes || !s2?.strokes) return

    const n1 = getNetStrokes(s1.strokes, h.handicap, p1.handicap, totalHoles, pct)
    const n2 = getNetStrokes(s2.strokes, h.handicap, p2.handicap, totalHoles, pct)

    let winner: string | null = null
    if (n1 < n2) { running++; winner = p1.id }
    else if (n2 < n1) { running--; winner = p2.id }
    else winner = 'halved'

    holeResults.push({ hole: h.hole_number, winner, runningStatus: running })

    if (Math.abs(running) > holes.length - i - 1) {
      concluded = true
      concludedAt = h.hole_number
    }
  })

  const leaderId = running > 0 ? p1.id : running < 0 ? p2.id : null
  const abs = Math.abs(running)
  const holesRemaining = holes.length - concludedAt!
  let status = 'All Square'
  if (concluded && concludedAt) status = `${abs}&${holesRemaining}`
  else if (abs > 0) status = `${abs} UP`

  return { holeResults, status, leaderId, concluded, concludedAt }
}

// ─── Match Play Dobles (mejor bola 2v2) ──────────────────────────────

export interface DoublesResult {
  holeResults: MatchHoleResult[]
  status: string
  leadingTeam: number | null
  concluded: boolean
}

export function calcMatchPlayDobles(
  players: RoundPlayer[], scores: Score[], holes: Hole[], totalHoles: number, pct: number = 100
): DoublesResult {
  const team1 = players.filter(p => p.team === 1)
  const team2 = players.filter(p => p.team === 2)
  let running = 0
  const holeResults: MatchHoleResult[] = []
  let concluded = false

  holes.forEach((h, i) => {
    if (concluded) return
    const best = (team: RoundPlayer[]) => {
      const nets = team.map(p => {
        const s = scores.find(sc => sc.player_id === p.id && sc.hole_number === h.hole_number)
        if (!s?.strokes) return Infinity
        return getNetStrokes(s.strokes, h.handicap, p.handicap, totalHoles, pct)
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
  if (concluded) status = `${abs}&${holesRemaining}`
  else if (abs > 0) status = `${abs} UP`

  return { holeResults, status, leadingTeam, concluded }
}

// ─── Bismarck ─────────────────────────────────────────────────────────

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
  players: RoundPlayer[], scores: Score[], holes: Hole[], totalHoles: number, pct: number = 100
): BismarckResult {
  const totals: Record<string, number> = {}
  players.forEach(p => { totals[p.id] = 0 })
  const holeResults: BismarckHoleResult[] = []

  holes.forEach(h => {
    const nets = players.map(p => {
      const s = scores.find(sc => sc.player_id === p.id && sc.hole_number === h.hole_number)
      const strokes = s?.strokes ?? null
      const net = strokes !== null ? getNetStrokes(strokes, h.handicap, p.handicap, totalHoles, pct) : null
      return { playerId: p.id, name: p.name, net }
    })
    if (nets.some(n => n.net === null)) return

    const sorted = [...nets].sort((a, b) => a.net! - b.net!)
    const [s1, s2, s3] = sorted.map(n => n.net!)
    let pts: number[]
    if (s1 < s2 && s2 < s3) pts = [4, 2, 0]
    else if (s1 < s2 && s2 === s3) pts = [4, 1, 1]
    else if (s1 === s2 && s2 < s3) pts = [3, 3, 0]
    else pts = [2, 2, 2]

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

  const totalArr = players.map(p => ({ playerId: p.id, name: p.name, total: totals[p.id] }))
    .sort((a, b) => b.total - a.total)

  return { holeResults, totals: totalArr }
}

// ─── Combinado 4 jugadores ────────────────────────────────────────────
// Un dobles (A&B vs C&D) + 4 individuales cruzados

export interface Combinado4Result {
  dobles: DoublesResult | null
  doblesStroke: StrokeResult[] | null
  individuales: {
    p1: RoundPlayer
    p2: RoundPlayer
    match: MatchPlayResult | null
    stroke: { p1: StrokeResult; p2: StrokeResult } | null
  }[]
}

export function calcCombinado4(
  players: RoundPlayer[],  // posición 0,1 = team1 / posición 2,3 = team2
  scores: Score[],
  holes: Hole[],
  totalHoles: number,
  doblesMode: 'stroke' | 'matchplay',
  doblesHcpPct: number,
  individualMode: 'stroke' | 'matchplay',
  individualHcpPct: number
): Combinado4Result {
  const team1 = players.filter(p => p.team === 1)
  const team2 = players.filter(p => p.team === 2)

  // Dobles
  let dobles: DoublesResult | null = null
  let doblesStroke: StrokeResult[] | null = null
  if (doblesMode === 'matchplay') {
    dobles = calcMatchPlayDobles(players, scores, holes, totalHoles, doblesHcpPct)
  } else {
    // Stroke dobles: mejor bola por equipo, comparar totales stableford
    doblesStroke = calcStroke(players, scores, holes, totalHoles, doblesHcpPct)
  }

  // Individuales cruzados: T1[0] vs T2[0], T1[0] vs T2[1], T1[1] vs T2[0], T1[1] vs T2[1]
  const pairs = [
    [team1[0], team2[0]],
    [team1[0], team2[1]],
    [team1[1], team2[0]],
    [team1[1], team2[1]],
  ].filter(pair => pair[0] && pair[1])

  const individuales = pairs.map(([p1, p2]) => {
    if (individualMode === 'matchplay') {
      return {
        p1, p2,
        match: calcMatchPlay(p1, p2, scores, holes, totalHoles, individualHcpPct),
        stroke: null
      }
    } else {
      const results = calcStroke([p1, p2], scores, holes, totalHoles, individualHcpPct)
      return {
        p1, p2,
        match: null,
        stroke: { p1: results[0], p2: results[1] }
      }
    }
  })

  return { dobles, doblesStroke, individuales }
}

// ─── Combinado Bismarck + individuales ───────────────────────────────

export interface CombinadoBismarckResult {
  bismarck: BismarckResult
  individuales: {
    p1: RoundPlayer
    p2: RoundPlayer
    match: MatchPlayResult | null
    stroke: { p1: StrokeResult; p2: StrokeResult } | null
  }[]
}

export function calcCombinadoBismarck(
  players: RoundPlayer[],  // exactamente 3
  scores: Score[],
  holes: Hole[],
  totalHoles: number,
  bismarckHcpPct: number,
  individualMode: 'stroke' | 'matchplay',
  individualHcpPct: number
): CombinadoBismarckResult {
  const bismarck = calcBismarck(players, scores, holes, totalHoles, bismarckHcpPct)

  // 3 pares: 0v1, 0v2, 1v2
  const pairs = [
    [players[0], players[1]],
    [players[0], players[2]],
    [players[1], players[2]],
  ]

  const individuales = pairs.map(([p1, p2]) => {
    if (individualMode === 'matchplay') {
      return { p1, p2, match: calcMatchPlay(p1, p2, scores, holes, totalHoles, individualHcpPct), stroke: null }
    } else {
      const results = calcStroke([p1, p2], scores, holes, totalHoles, individualHcpPct)
      return { p1, p2, match: null, stroke: { p1: results[0], p2: results[1] } }
    }
  })

  return { bismarck, individuales }
}
