import { Hole, RoundPlayer, Score } from './supabase'

// ─── Corrección de ventajas para canchas combinadas (loops de 9 hoyos) ──
//
// En clubes con 3 o más vueltas de 9 hoyos (p.ej. Las Brisas de Santo Domingo:
// Sur, Este, Norte) cada vuelta se guarda con sus ventajas propias 1–9. Al
// jugar 18 hoyos se combinan dos vueltas, y las ventajas deben repartirse en
// el rango 1–18: la PRIMERA vuelta toma los impares (v*2-1) y la SEGUNDA los
// pares (v*2).
//
// Sin esta corrección, la asignación de palos se DUPLICA: un hoyo con ventaja 1
// existe en ambas vueltas, así que una diferencia de 3 de HDCP daría 3 palos en
// cada vuelta (6 en total) en lugar de 3 en las 18. Esta función se aplica al
// usar el campo en una partida (no al crearlo): el campo se sigue guardando con
// ventajas 1–9 por vuelta.
export function correctCombinedHandicaps(holes: Hole[]): Hole[] {
  // Solo aplica cuando se juegan 18 hoyos formados por dos vueltas 1–9.
  if (holes.length !== 18) return holes
  const sorted = [...holes].sort((a, b) => a.hole_number - b.hole_number)
  const isLoop1to9 = (arr: Hole[]) => {
    const vals = Array.from(new Set(arr.map(h => h.handicap)))
    return vals.length === 9 && vals.every(v => v >= 1 && v <= 9)
  }
  // Si alguna vuelta no usa exactamente 1–9 es un campo normal (ya 1–18): no tocar.
  if (!isLoop1to9(sorted.slice(0, 9)) || !isLoop1to9(sorted.slice(9, 18))) return holes
  return sorted.map((h, i) => ({
    ...h,
    handicap: i < 9 ? h.handicap * 2 - 1 : h.handicap * 2,
  }))
}

// Combina dos vueltas de 9 hoyos en una tarjeta de 18, aplicando la corrección
// de ventajas: la PRIMERA vuelta toma los impares (v*2-1) y la SEGUNDA los
// pares (v*2). Las vueltas se siguen guardando con ventajas 1–9; esta función
// arma los 18 hoyos al momento de jugar. `secondLoop` puede ser la misma vuelta
// que `firstLoop` (cancha de 9 jugada dos veces).
export function buildLoopRoundHoles(firstLoop: Hole[], secondLoop: Hole[]): Hole[] {
  const f = [...firstLoop].sort((a, b) => a.hole_number - b.hole_number).slice(0, 9)
  const s = [...secondLoop].sort((a, b) => a.hole_number - b.hole_number).slice(0, 9)
  const out: Hole[] = []
  f.forEach((h, i) => out.push({
    id: `loop1-${i + 1}`, hole_number: i + 1, par: h.par, handicap: h.handicap * 2 - 1,
  }))
  s.forEach((h, i) => out.push({
    id: `loop2-${i + 1}`, hole_number: i + 10, par: h.par, handicap: h.handicap * 2,
  }))
  return out
}

// ─── Handicap helpers ────────────────────────────────────────────────

// Ventaja individual contra el campo (usada en Stroke Play)
export function getExtraStrokes(holeHcp: number, playerHcp: number, totalHoles: number, pct: number = 100): number {
  const adj = Math.round((totalHoles === 9 ? playerHcp / 2 : playerHcp) * pct / 100)
  const base = Math.floor(adj / totalHoles)
  const remainder = adj % totalHoles
  return base + (holeHcp <= remainder ? 1 : 0)
}

// Ventaja relativa en un grupo: el jugador con menor HCP ajustado es la referencia (0 golpes).
// Cada jugador recibe (su HCP ajustado - minHCP) golpes, en los hoyos con ventaja <= esa diferencia.
export function getRelativeExtra(holeHcp: number, playerHcp: number, allHcps: number[], totalHoles: number, pct: number = 100): number {
  const adj = (hcp: number) => Math.round((totalHoles === 9 ? hcp / 2 : hcp) * pct / 100)
  const minAdj = Math.min(...allHcps.map(adj))
  const playerAdj = adj(playerHcp)
  const diff = playerAdj - minAdj
  return diff > 0 && holeHcp <= diff ? 1 : 0
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
  const allHcps = [p1.handicap, p2.handicap]

  holes.forEach((h, i) => {
    if (concluded) return
    const s1 = scores.find(s => s.player_id === p1.id && s.hole_number === h.hole_number)
    const s2 = scores.find(s => s.player_id === p2.id && s.hole_number === h.hole_number)
    if (!s1?.strokes || !s2?.strokes) return

    const e1 = getRelativeExtra(h.handicap, p1.handicap, allHcps, totalHoles, pct)
    const e2 = getRelativeExtra(h.handicap, p2.handicap, allHcps, totalHoles, pct)
    const n1 = s1.strokes - e1
    const n2 = s2.strokes - e2

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
  const holesRemaining = holes.length - (concludedAt ? holes.findIndex(h => h.hole_number === concludedAt) + 1 : holeResults.length)
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
  const allHcps = players.map(p => p.handicap)
  let running = 0
  const holeResults: MatchHoleResult[] = []
  let concluded = false

  holes.forEach((h, i) => {
    if (concluded) return
    const best = (team: RoundPlayer[]) => {
      const nets = team.map(p => {
        const s = scores.find(sc => sc.player_id === p.id && sc.hole_number === h.hole_number)
        if (!s?.strokes) return Infinity
        const extra = getRelativeExtra(h.handicap, p.handicap, allHcps, totalHoles, pct)
        return s.strokes - extra
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

// ─── Mejor, Peor y Suma (parejas, neto) ──────────────────────────────
// Cada hoyo reparte hasta 4 puntos entre las dos parejas (neto, menor gana):
//   Mejor (best ball) = 2 pts · Suma (suma de los 2 netos) = 1 pt · Peor (worst ball) = 1 pt
// Empate en una categoría = 0 a ambos. El acumulado (margin) es el saldo a favor
// del Equipo 1: positivo = Equipo 1 arriba, negativo = Equipo 2 arriba.

export interface MpsHoleResult {
  hole: number
  nets: { playerId: string; net: number | null }[]
  t1: { best: number; worst: number; sum: number } | null
  t2: { best: number; worst: number; sum: number } | null
  winners: { mejor: 0 | 1 | 2; suma: 0 | 1 | 2; peor: 0 | 1 | 2 } // 0 empate, 1 Eq1, 2 Eq2
  pts1: number
  pts2: number
  margin: number // acumulado Eq1 − Eq2 tras este hoyo
}

export interface MpsResult {
  holeResults: MpsHoleResult[]
  totalT1: number
  totalT2: number
  margin: number
}

export function calcMejorPeorSuma(
  players: RoundPlayer[], scores: Score[], holes: Hole[], totalHoles: number, pct: number = 100
): MpsResult {
  const team1 = players.filter(p => p.team === 1)
  const team2 = players.filter(p => p.team === 2)
  const holeResults: MpsHoleResult[] = []
  let totalT1 = 0, totalT2 = 0, margin = 0

  holes.forEach(h => {
    const netOf = (p: RoundPlayer): number | null => {
      const s = scores.find(sc => sc.player_id === p.id && sc.hole_number === h.hole_number)
      if (!s?.strokes) return null
      return s.strokes - getExtraStrokes(h.handicap, p.handicap, totalHoles, pct)
    }
    const n1 = team1.map(netOf), n2 = team2.map(netOf)
    const complete = team1.length === 2 && team2.length === 2 && n1.every(v => v !== null) && n2.every(v => v !== null)
    if (!complete) return // hoyo aún no jugado por las 4 personas

    const a1 = n1 as number[], a2 = n2 as number[]
    const nets = players.map(p => {
      const s = scores.find(sc => sc.player_id === p.id && sc.hole_number === h.hole_number)
      return { playerId: p.id, net: s?.strokes ? s.strokes - getExtraStrokes(h.handicap, p.handicap, totalHoles, pct) : null }
    })
    const t1 = { best: Math.min(...a1), worst: Math.max(...a1), sum: a1[0] + a1[1] }
    const t2 = { best: Math.min(...a2), worst: Math.max(...a2), sum: a2[0] + a2[1] }
    const cmp = (x: number, y: number): 0 | 1 | 2 => (x < y ? 1 : y < x ? 2 : 0)
    const winners = { mejor: cmp(t1.best, t2.best), suma: cmp(t1.sum, t2.sum), peor: cmp(t1.worst, t2.worst) }
    let pts1 = 0, pts2 = 0
    if (winners.mejor === 1) pts1 += 2; else if (winners.mejor === 2) pts2 += 2
    if (winners.suma === 1) pts1 += 1; else if (winners.suma === 2) pts2 += 1
    if (winners.peor === 1) pts1 += 1; else if (winners.peor === 2) pts2 += 1
    totalT1 += pts1; totalT2 += pts2; margin += pts1 - pts2
    holeResults.push({ hole: h.hole_number, nets, t1, t2, winners, pts1, pts2, margin })
  })

  return { holeResults, totalT1, totalT2, margin }
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
  const allHcps = players.map(p => p.handicap)

  holes.forEach(h => {
    const nets = players.map(p => {
      const s = scores.find(sc => sc.player_id === p.id && sc.hole_number === h.hole_number)
      const strokes = s?.strokes ?? null
      const extra = strokes !== null ? getRelativeExtra(h.handicap, p.handicap, allHcps, totalHoles, pct) : 0
      const net = strokes !== null ? strokes - extra : null
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
  players: RoundPlayer[],
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

  let dobles: DoublesResult | null = null
  let doblesStroke: StrokeResult[] | null = null
  if (doblesMode === 'matchplay') {
    dobles = calcMatchPlayDobles(players, scores, holes, totalHoles, doblesHcpPct)
  } else {
    doblesStroke = calcStroke(players, scores, holes, totalHoles, doblesHcpPct)
  }

  const pairs = [
    [team1[0], team2[0]],
    [team1[0], team2[1]],
    [team1[1], team2[0]],
    [team1[1], team2[1]],
  ].filter(pair => pair[0] && pair[1])

  const individuales = pairs.map(([p1, p2]) => {
    if (individualMode === 'matchplay') {
      return { p1, p2, match: calcMatchPlay(p1, p2, scores, holes, totalHoles, individualHcpPct), stroke: null }
    } else {
      const results = calcStroke([p1, p2], scores, holes, totalHoles, individualHcpPct)
      return { p1, p2, match: null, stroke: { p1: results[0], p2: results[1] } }
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
  players: RoundPlayer[],
  scores: Score[],
  holes: Hole[],
  totalHoles: number,
  bismarckHcpPct: number,
  individualMode: 'stroke' | 'matchplay',
  individualHcpPct: number
): CombinadoBismarckResult {
  const bismarck = calcBismarck(players, scores, holes, totalHoles, bismarckHcpPct)

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
