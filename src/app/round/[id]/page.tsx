'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase, Round, RoundPlayer, Score, Hole, Course } from '@/lib/supabase'
import {
  calcStroke, calcMatchPlay, calcMatchPlayDobles, calcBismarck,
  calcCombinado4, calcCombinadoBismarck, getExtraStrokes, getRelativeExtra,
  correctCombinedHandicaps, buildLoopRoundHoles
} from '@/lib/golf'

const PLAYER_COLORS = ['#2dd4bf', '#f59e0b', '#a78bfa', '#f87171']
const PLAYER_BG = ['#0d9488', '#d97706', '#7c3aed', '#dc2626']

const MODE_LABELS: Record<string, string> = {
  stroke: 'Stroke Play', matchplay_individual: 'Match Play',
  matchplay_dobles: 'Dobles', bismarck: 'Bismarck',
  combinado_4: 'Ryder', combinado_bismarck: 'Bismarck + Individuales'
}

// Modes that use handicap (show Score Neto tab)
const MODES_WITH_HCP = ['stroke', 'matchplay_individual', 'matchplay_dobles', 'bismarck', 'combinado_4', 'combinado_bismarck']

function ScoreBadge({ strokes, par }: { strokes: number | null; par: number }) {
  if (!strokes) return <span style={{ color: 'var(--text3)', fontSize: 13 }}>—</span>
  const d = strokes - par
  const styles: Record<string, React.CSSProperties> = {
    eagle: { background: '#fbbf24', color: '#1a0f00', borderRadius: '50%' },
    birdie: { background: '#2dd4bf', color: '#051209', borderRadius: 4 },
    par: { background: 'var(--surface2)', color: 'var(--text)', border: '1px solid var(--border2)', borderRadius: 4 },
    bogey: { background: 'rgba(248,113,113,0.15)', color: '#f87171', border: '1px solid rgba(248,113,113,0.3)', borderRadius: 4 },
    double: { background: 'rgba(248,113,113,0.3)', color: '#fca5a5', border: '2px solid #f87171', borderRadius: 4 },
    triple: { background: '#7f1d1d', color: '#fca5a5', borderRadius: 4 },
  }
  const k = d <= -2 ? 'eagle' : d === -1 ? 'birdie' : d === 0 ? 'par' : d === 1 ? 'bogey' : d === 2 ? 'double' : 'triple'
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, fontSize: 12, fontWeight: 700, ...styles[k] }}>
      {strokes}
    </span>
  )
}

function MatchStatusBadge({ status, concluded, label }: { status: string; concluded: boolean; label: string }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 4 }}>{label}</div>
      <div style={{ fontFamily: 'var(--display)', fontSize: 22, letterSpacing: 1, color: concluded ? '#f59e0b' : '#2dd4bf' }}>{status}</div>
    </div>
  )
}

function PlayerChip({ name, pi, side }: { name: string; pi: number; side: 'left' | 'right' }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexDirection: side === 'right' ? 'row-reverse' : 'row', flex: 1, justifyContent: side === 'right' ? 'flex-end' : 'flex-start' }}>
      <div style={{ width: 22, height: 22, borderRadius: '50%', background: PLAYER_BG[pi], display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: 'white', flexShrink: 0 }}>{name[0]?.toUpperCase()}</div>
      <span style={{ fontSize: 13, fontWeight: 600, color: PLAYER_COLORS[pi] }}>{name}</span>
    </div>
  )
}

function IndividualResultCard({ p1, p2, match, stroke, pi1, pi2 }: any) {
  // Determine winner for match play
  const winnerId = match?.concluded ? match.leaderId : null
  const loser = winnerId === p1.id ? p2 : winnerId === p2.id ? p1 : null
  const winner = winnerId === p1.id ? p1 : winnerId === p2.id ? p2 : null
  const winnerPi = winnerId === p1.id ? pi1 : pi2
  const loserPi = winnerId === p1.id ? pi2 : pi1

  if (match) {
    // Show: [winner chip] [score] [loser chip]  or  [p1] [score] [p2] if all square
    const isAllSquare = match.status === 'AS' || match.status === 'ALL SQUARE'
    const leftP = isAllSquare ? p1 : (winner || p1)
    const leftPi = isAllSquare ? pi1 : winnerPi
    const rightP = isAllSquare ? p2 : (loser || p2)
    const rightPi = isAllSquare ? pi2 : loserPi
    return (
      <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <PlayerChip name={leftP.name} pi={leftPi} side="left" />
          <div style={{ fontFamily: 'var(--display)', fontSize: 20, color: match.concluded ? '#f59e0b' : '#2dd4bf', minWidth: 52, textAlign: 'center', flexShrink: 0 }}>{match.status}</div>
          <PlayerChip name={rightP.name} pi={rightPi} side="right" />
        </div>
      </div>
    )
  }

  if (stroke) {
    const s1 = stroke.p1.stableford
    const s2 = stroke.p2.stableford
    const leftP = s1 >= s2 ? p1 : p2
    const leftPi = s1 >= s2 ? pi1 : pi2
    const rightP = s1 >= s2 ? p2 : p1
    const rightPi = s1 >= s2 ? pi2 : pi1
    const leftSb = s1 >= s2 ? s1 : s2
    const rightSb = s1 >= s2 ? s2 : s1
    return (
      <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <PlayerChip name={leftP.name} pi={leftPi} side="left" />
          <div style={{ display: 'flex', gap: 10, flexShrink: 0 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ color: 'var(--text3)', fontSize: 9 }}>Stbl</div>
              <div style={{ color: PLAYER_COLORS[leftPi], fontFamily: 'var(--display)', fontSize: 18 }}>{leftSb}</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ color: 'var(--text3)', fontSize: 9 }}>Stbl</div>
              <div style={{ color: PLAYER_COLORS[rightPi], fontFamily: 'var(--display)', fontSize: 18 }}>{rightSb}</div>
            </div>
          </div>
          <PlayerChip name={rightP.name} pi={rightPi} side="right" />
        </div>
      </div>
    )
  }

  return null
}

export default function RoundPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [round, setRound] = useState<Round | null>(null)
  const [players, setPlayers] = useState<RoundPlayer[]>([])
  const [scores, setScores] = useState<Score[]>([])
  const [holes, setHoles] = useState<Hole[]>([])
  const [course, setCourse] = useState<Course | null>(null)
  const [secondCourse, setSecondCourse] = useState<Course | null>(null)
  const [activeTab, setActiveTab] = useState<'card' | 'neto' | 'results'>('card')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteCode, setDeleteCode] = useState<string | null>(null)
  const [deleteInput, setDeleteInput] = useState('')
  const [deleteError, setDeleteError] = useState(false)

  useEffect(() => {
    if (!id) return
    async function load() {
      const { data: r } = await supabase.from('rounds').select('*, course:courses!course_id(*, holes(*))').eq('id', id).single()
      if (!r) return
      const { data: p } = await supabase.from('round_players').select('*').eq('round_id', id).order('position')
      const { data: s } = await supabase.from('scores').select('*').eq('round_id', id)
      setRound(r as any)
      setCourse((r as any).course)
      if ((r as any).second_course_id) {
        // Partida de dos vueltas de 9: combinar con corrección impares/pares.
        const { data: sc } = await supabase.from('courses').select('*, holes(*)').eq('id', (r as any).second_course_id).single()
        setSecondCourse(sc as any)
        const firstLoop = [...((r as any).course?.holes || [])]
        setHoles(buildLoopRoundHoles(firstLoop as any, ((sc as any)?.holes || []) as any) as any)
      } else {
        const sortedHoles = [...((r as any).course?.holes || [])].sort((a: any, b: any) => a.hole_number - b.hole_number).slice(0, r.holes_played)
        // Cancha combinada de dos vueltas de 9 (ventajas 1–9 c/u): corregir a 1–18.
        setHoles(correctCombinedHandicaps(sortedHoles as any) as any)
      }
      setPlayers((p || []) as any)
      setScores((s || []) as any)
      setLoading(false)
    }
    load()
  }, [id])

  const getScore = useCallback((playerId: string, hole: number) =>
    scores.find(s => s.player_id === playerId && s.hole_number === hole)?.strokes ?? null, [scores])

  const handleScoreChange = async (playerId: string, holeNumber: number, val: string) => {
    const strokes = val === '' ? null : Math.max(1, parseInt(val) || 1)
    const key = `${playerId}-${holeNumber}`
    setSaving(key)
    setScores(prev => {
      const filtered = prev.filter(s => !(s.player_id === playerId && s.hole_number === holeNumber))
      if (strokes === null) return filtered
      return [...filtered, { round_id: id, player_id: playerId, hole_number: holeNumber, strokes }]
    })
    if (strokes === null) {
      await supabase.from('scores').delete().eq('round_id', id).eq('player_id', playerId).eq('hole_number', holeNumber)
    } else {
      await supabase.from('scores').upsert({ round_id: id, player_id: playerId, hole_number: holeNumber, strokes }, { onConflict: 'round_id,player_id,hole_number' })
    }
    setSaving(null)
  }

  const initiateDelete = () => {
    const code = Math.floor(1000 + Math.random() * 9000).toString()
    setDeleteCode(code)
    setDeleteInput('')
    setDeleteError(false)
  }

  const cancelDelete = () => {
    setDeleteCode(null)
    setDeleteInput('')
    setDeleteError(false)
  }

  const confirmDelete = async () => {
    if (deleteInput !== deleteCode) {
      setDeleteError(true)
      return
    }
    setDeleting(true)
    await supabase.from('rounds').delete().eq('id', id)
    router.push('/')
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)' }}>Cargando…</div>
  )

  // Calculate results
  const r = round!
  const hcpPct = (r as any).hcp_pct ?? 100
  const strokeResults = calcStroke(players, scores, holes, holes.length, hcpPct)
  const matchResult = r.mode === 'matchplay_individual' && players.length >= 2
    ? calcMatchPlay(players[0], players[1], scores, holes, holes.length, hcpPct) : null
  const doublesResult = r.mode === 'matchplay_dobles' && players.length === 4
    ? calcMatchPlayDobles(players, scores, holes, holes.length, hcpPct) : null
  const bismarckResult = r.mode === 'bismarck' && players.length === 3
    ? calcBismarck(players, scores, holes, holes.length, hcpPct) : null
  const combinado4Result = r.mode === 'combinado_4' && players.length === 4
    ? calcCombinado4(players, scores, holes, holes.length, (r as any).dobles_mode || 'matchplay', (r as any).dobles_hcp_pct ?? 100, (r as any).individual_mode || 'matchplay', (r as any).individual_hcp_pct ?? 80) : null
  const combinadoBismarckResult = r.mode === 'combinado_bismarck' && players.length === 3
    ? calcCombinadoBismarck(players, scores, holes, holes.length, (r as any).bismarck_hcp_pct ?? 100, (r as any).individual_mode || 'matchplay', (r as any).individual_hcp_pct ?? 80) : null

  const front9 = holes.slice(0, 9)
  const back9 = holes.length > 9 ? holes.slice(9) : []

  const showNetoTab = MODES_WITH_HCP.includes(r.mode)

  // Build tabs
  type Tab = 'card' | 'neto' | 'results'
  const tabs: { key: Tab; label: string }[] = [
    { key: 'card', label: 'Gross' },
    ...(showNetoTab ? [{ key: 'neto' as Tab, label: 'Score Neto' }] : []),
    { key: 'results', label: 'Resultados' },
  ]

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <header style={{ background: 'linear-gradient(135deg, #0a1f0f 0%, #071409 100%)', borderBottom: '1px solid var(--border)', padding: '18px 16px 14px' }}>
        <div style={{ maxWidth: 800, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <Link href="/" style={{ color: 'var(--text3)', fontSize: 18 }}>←</Link>
            <div>
              <h1 style={{ fontFamily: 'var(--display)', fontSize: 22, letterSpacing: 1, lineHeight: 1 }}>{course?.name}{secondCourse ? (
                <span style={{ fontSize: 14, color: 'var(--text3)', display: 'block', marginTop: 4, letterSpacing: 0 }}>
                  {course?.loop_label || 'Vuelta 1'} + {secondCourse?.loop_label || 'Vuelta 2'}
                </span>
              ) : (course?.loop_label ? (
                <span style={{ fontSize: 14, color: 'var(--text3)', display: 'block', marginTop: 4, letterSpacing: 0 }}>{course.loop_label}</span>
              ) : null)}</h1>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
                {new Date(r.date).toLocaleDateString('es-CL', { day: 'numeric', month: 'long' })} · {holes.length} hoyos · {MODE_LABELS[r.mode]}
              </div>
            </div>
            {saving && <div style={{ marginLeft: 'auto', fontSize: 11, color: '#2dd4bf' }}>💾</div>}
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, flexShrink: 0 }}>
              <Link href={`/round/${id}/edit`} style={{
                background: 'rgba(245,158,11,0.1)',
                border: '1px solid rgba(245,158,11,0.25)', color: '#f59e0b',
                borderRadius: 8, padding: '6px 12px', fontSize: 12,
                textDecoration: 'none'
              }}>✎ Editar</Link>
              <button onClick={initiateDelete} disabled={deleting} style={{
                background: 'rgba(248,113,113,0.1)',
                border: '1px solid rgba(248,113,113,0.2)', color: '#f87171',
                borderRadius: 8, padding: '6px 12px', fontSize: 12,
                cursor: 'pointer'
              }}>🗑 Borrar</button>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
            {players.map((p, i) => (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 20, background: `${PLAYER_BG[i]}20`, border: `1px solid ${PLAYER_BG[i]}40` }}>
                <div style={{ width: 18, height: 18, borderRadius: '50%', background: PLAYER_BG[i], display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: 'white' }}>{p.name[0]?.toUpperCase()}</div>
                <span style={{ fontSize: 12, color: PLAYER_COLORS[i], fontWeight: 500 }}>{p.name}</span>
                <span style={{ fontSize: 10, color: 'var(--text3)' }}>HCP {p.handicap}</span>
                {(r.mode === 'matchplay_dobles' || r.mode === 'combinado_4') && p.team && (
                  <span style={{ fontSize: 10, color: 'var(--text3)' }}>T{p.team}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </header>

      {/* TABS */}
      <div style={{ borderBottom: '1px solid var(--border)', padding: '0 16px', display: 'flex', gap: 2 }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)} style={{
            padding: '10px 16px', background: 'transparent', border: 'none',
            borderBottom: `2px solid ${activeTab === t.key ? '#2dd4bf' : 'transparent'}`,
            color: activeTab === t.key ? '#2dd4bf' : 'var(--text3)',
            fontFamily: 'var(--body)', fontSize: 13, fontWeight: 500, cursor: 'pointer'
          }}>{t.label}</button>
        ))}
      </div>

      <main style={{ maxWidth: 800, margin: '0 auto', padding: '16px 12px' }}>

        {/* ── GROSS (tarjeta bruta) ── */}
        {activeTab === 'card' && (
          <>
            {[front9, ...(back9.length > 0 ? [back9] : [])].map((holeSet, si) => {
              const isBack = back9.length > 0 && si === 1
              const setLabel = isBack ? 'VUELTA' : 'IDA'
              return (
              <div key={si} style={{ marginBottom: 24 }}>
                <div style={{ fontFamily: 'var(--display)', fontSize: 13, letterSpacing: 2, color: 'var(--text3)', paddingBottom: 8 }}>
                  {si === 0 ? 'IDA — HOYOS 1–9' : 'VUELTA — HOYOS 10–18'}
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 500 }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: 'left', padding: '8px 10px', fontSize: 11, color: 'var(--text3)', letterSpacing: 1, background: 'var(--surface2)', border: '1px solid var(--border)', minWidth: 100 }}>JUGADOR</th>
                        {holeSet.map(h => (
                          <th key={h.hole_number} style={{ width: 42, padding: '6px 4px', fontSize: 12, color: 'var(--text3)', background: 'var(--surface2)', border: '1px solid var(--border)' }}>
                            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text2)' }}>{h.hole_number}</div>
                            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)' }}>P{h.par}</div><div style={{ fontSize: 11, fontWeight: 700, color: '#2dd4bf' }}>V{h.handicap}</div>
                          </th>
                        ))}
                        <th style={{ width: 52, padding: '6px 8px', fontSize: 11, color: '#2dd4bf', background: 'var(--surface2)', border: '1px solid var(--border)' }}>
                          {setLabel}
                        </th>
                        {isBack && (
                          <th style={{ width: 56, padding: '6px 8px', fontSize: 11, color: '#fbbf24', background: 'var(--surface2)', border: '1px solid var(--border)' }}>
                            TOTAL
                          </th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {players.map((p, pi) => {
                        const setSum = holeSet.reduce((s, h) => s + (getScore(p.id, h.hole_number) || 0), 0)
                        const totalSum = holes.reduce((s, h) => s + (getScore(p.id, h.hole_number) || 0), 0)
                        return (
                          <tr key={p.id}>
                            <td style={{ padding: '6px 10px', border: '1px solid var(--border)', background: 'var(--surface)' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <div style={{ width: 20, height: 20, borderRadius: '50%', background: PLAYER_BG[pi], display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: 'white', flexShrink: 0 }}>{p.name[0]?.toUpperCase()}</div>
                                <span style={{ fontSize: 12, fontWeight: 500, whiteSpace: 'nowrap' }}>{p.name}</span>
                              </div>
                            </td>
                            {holeSet.map(h => {
                              const s = getScore(p.id, h.hole_number)
                              return (
                                <td key={h.hole_number} style={{ padding: 3, border: '1px solid var(--border)', background: 'var(--surface)', textAlign: 'center' }}>
                                  <div style={{ position: 'relative', width: 34, margin: '0 auto' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 30 }}>
                                      <ScoreBadge strokes={s} par={h.par} />
                                    </div>
                                    <input type="number" min="1" max="15" value={s || ''} onChange={e => handleScoreChange(p.id, h.hole_number, e.target.value)}
                                      style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: 'transparent', border: 'none', color: 'transparent', textAlign: 'center', fontSize: 13, cursor: 'pointer', outline: 'none', zIndex: 2, MozAppearance: 'textfield' as any }} />
                                  </div>
                                </td>
                              )
                            })}
                            <td style={{ padding: '6px 8px', border: '1px solid var(--border)', background: 'var(--surface)', textAlign: 'center', fontWeight: 700, color: PLAYER_COLORS[pi], fontSize: 14 }}>
                              {setSum > 0 ? setSum : '—'}
                            </td>
                            {isBack && (
                              <td style={{ padding: '6px 8px', border: '1px solid var(--border)', background: 'var(--surface)', textAlign: 'center', fontWeight: 700, color: '#fbbf24', fontSize: 14 }}>
                                {totalSum > 0 ? totalSum : '—'}
                              </td>
                            )}
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
              )
            })}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, paddingTop: 8 }}>
              {[
                { label: 'Eagle', bg: '#fbbf24', r: '50%' }, { label: 'Birdie', bg: '#2dd4bf', r: 4 },
                { label: 'Par', bg: 'var(--surface2)', border: '1px solid var(--border2)' },
                { label: 'Bogey', bg: 'rgba(248,113,113,0.15)', border: '1px solid rgba(248,113,113,0.3)' },
              ].map((l: any) => (
                <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--text3)' }}>
                  <div style={{ width: 14, height: 14, background: l.bg, borderRadius: l.r || 3, border: l.border }} />
                  {l.label}
                </div>
              ))}
            </div>
          </>
        )}

        {/* ── SCORE NETO ── */}
        {activeTab === 'neto' && (() => {
          // pct and strategy depend on mode
          const isRyder = r.mode === 'combinado_4'
          const isCombBismarck = r.mode === 'combinado_bismarck'
          const isStroke = r.mode === 'stroke'

          // Compute running match-play status per hole (from groupPlayers[0] perspective).
          // Stops emitting once the match is mathematically concluded.
          const computeIndivStatuses = (p1: typeof players[0], p2: typeof players[0], pct: number): (number | null)[] => {
            const allHcps = [p1.handicap, p2.handicap]
            let running = 0
            let concluded = false
            return holes.map((h, i) => {
              if (concluded) return null
              const s1 = getScore(p1.id, h.hole_number)
              const s2 = getScore(p2.id, h.hole_number)
              if (s1 === null || s2 === null) return null
              const e1 = getRelativeExtra(h.handicap, p1.handicap, allHcps, holes.length, pct)
              const e2 = getRelativeExtra(h.handicap, p2.handicap, allHcps, holes.length, pct)
              const n1 = s1 - e1, n2 = s2 - e2
              if (n1 < n2) running++
              else if (n2 < n1) running--
              if (Math.abs(running) > holes.length - i - 1) concluded = true
              return running
            })
          }

          // Compute team best-ball net per hole + running team1-perspective status
          const computeDoublesData = (team1Players: typeof players, team2Players: typeof players, pct: number) => {
            const allHcps = players.map(p => p.handicap)
            const bestBall = (team: typeof players, h: Hole) => {
              let best = Infinity
              team.forEach(p => {
                const s = getScore(p.id, h.hole_number)
                if (s !== null) {
                  const extra = getRelativeExtra(h.handicap, p.handicap, allHcps, holes.length, pct)
                  const n = s - extra
                  if (n < best) best = n
                }
              })
              return best === Infinity ? null : best
            }
            let running = 0
            let concluded = false
            const perHole = holes.map((h, i) => {
              const b1 = bestBall(team1Players, h)
              const b2 = bestBall(team2Players, h)
              let status: number | null = null
              if (!concluded && b1 !== null && b2 !== null) {
                if (b1 < b2) running++
                else if (b2 < b1) running--
                status = running
                if (Math.abs(running) > holes.length - i - 1) concluded = true
              }
              return { hole: h.hole_number, b1, b2, status }
            })
            return perHole
          }

          // ── Status row renderer (reused by NetTable & DoublesNetTable) ──
          const renderStatusRow = (
            holeSet: typeof holes,
            statuses: (number | null)[],
            label: string,
            color: string,
            isBack: boolean
          ) => {
            const lastInSet = (() => {
              // find the last non-null status that falls inside holeSet
              let v: number | null = null
              holeSet.forEach(h => {
                const idx = holes.findIndex(x => x.hole_number === h.hole_number)
                if (idx >= 0 && statuses[idx] !== null) v = statuses[idx]
              })
              return v
            })()
            const lastOverall = (() => {
              let v: number | null = null
              statuses.forEach(s => { if (s !== null) v = s })
              return v
            })()
            const colorize = (n: number | null) =>
              n === null ? 'var(--text3)' : n > 0 ? '#2dd4bf' : n < 0 ? '#f87171' : 'var(--text)'
            const fmt = (n: number | null) => n === null ? '—' : n > 0 ? `+${n}` : `${n}`
            return (
              <tr>
                <td style={{ padding: '6px 10px', border: '1px solid var(--border)', background: 'var(--surface2)' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color, letterSpacing: 1 }}>{label}</span>
                </td>
                {holeSet.map(h => {
                  const idx = holes.findIndex(x => x.hole_number === h.hole_number)
                  const s = idx >= 0 ? statuses[idx] : null
                  return (
                    <td key={h.hole_number} style={{ padding: 3, border: '1px solid var(--border)', background: 'var(--surface2)', textAlign: 'center' }}>
                      <span style={{ fontFamily: 'var(--display)', fontSize: 13, color: colorize(s), fontWeight: 700 }}>{fmt(s)}</span>
                    </td>
                  )
                })}
                <td style={{ padding: '6px 8px', border: '1px solid var(--border)', background: 'var(--surface2)', textAlign: 'center', fontFamily: 'var(--display)', fontSize: 14, fontWeight: 700, color: colorize(lastInSet) }}>
                  {fmt(lastInSet)}
                </td>
                {isBack && (
                  <td style={{ padding: '6px 8px', border: '1px solid var(--border)', background: 'var(--surface2)', textAlign: 'center', fontFamily: 'var(--display)', fontSize: 14, fontWeight: 700, color: colorize(lastOverall) }}>
                    {fmt(lastOverall)}
                  </td>
                )}
              </tr>
            )
          }

          // Render a net scorecard for a group of players
          const NetTable = ({ groupPlayers, pct, strategy, title, titleColor, matchPlay }: {
            groupPlayers: typeof players; pct: number; strategy: 'individual' | 'relative';
            title?: string; titleColor?: string;
            matchPlay?: boolean
          }) => {
            const allHcps = groupPlayers.map(p => p.handicap)
            const showStatus = matchPlay === true && groupPlayers.length === 2
            const statuses = showStatus ? computeIndivStatuses(groupPlayers[0], groupPlayers[1], pct) : null
            const p1pi = showStatus ? players.findIndex(pl => pl.id === groupPlayers[0].id) : -1
            return (
              <div style={{ marginBottom: 16 }}>
                {title && (
                  <div style={{ fontFamily: 'var(--display)', fontSize: 12, letterSpacing: 2, color: titleColor || 'var(--text3)', paddingBottom: 8, display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span>{title}</span>
                    <span style={{ color: 'var(--text3)', fontSize: 11 }}>· HCP {pct}%</span>
                  </div>
                )}
                {[front9, ...(back9.length > 0 ? [back9] : [])].map((holeSet, si) => {
                  const isBack = back9.length > 0 && si === 1
                  const setLabel = isBack ? 'VUELTA' : 'IDA'
                  return (
                    <div key={si} style={{ marginBottom: 10 }}>
                      <div style={{ fontSize: 11, color: 'var(--text3)', letterSpacing: 1, paddingBottom: 4 }}>
                        {si === 0 ? 'IDA — HOYOS 1–9' : 'VUELTA — HOYOS 10–18'}
                      </div>
                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 500 }}>
                          <thead>
                            <tr>
                              <th style={{ textAlign: 'left', padding: '8px 10px', fontSize: 11, color: 'var(--text3)', letterSpacing: 1, background: 'var(--surface2)', border: '1px solid var(--border)', minWidth: 100 }}>JUGADOR</th>
                              {holeSet.map(h => (
                                <th key={h.hole_number} style={{ width: 42, padding: '6px 4px', fontSize: 12, color: 'var(--text3)', background: 'var(--surface2)', border: '1px solid var(--border)' }}>
                                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text2)' }}>{h.hole_number}</div>
                                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)' }}>P{h.par}</div><div style={{ fontSize: 11, fontWeight: 700, color: '#2dd4bf' }}>V{h.handicap}</div>
                                </th>
                              ))}
                              <th style={{ width: 52, padding: '6px 8px', fontSize: 11, color: '#2dd4bf', background: 'var(--surface2)', border: '1px solid var(--border)' }}>
                                {setLabel}
                              </th>
                              {isBack && (
                                <th style={{ width: 56, padding: '6px 8px', fontSize: 11, color: '#fbbf24', background: 'var(--surface2)', border: '1px solid var(--border)' }}>
                                  TOTAL
                                </th>
                              )}
                            </tr>
                          </thead>
                          <tbody>
                            {groupPlayers.map(p => {
                              const pi = players.findIndex(pl => pl.id === p.id)
                              let rowNeto = 0; let hasRow = true
                              let totalNeto = 0; let hasTotal = true
                              holes.forEach(h => {
                                const s = getScore(p.id, h.hole_number)
                                const extra = strategy === 'individual'
                                  ? getExtraStrokes(h.handicap, p.handicap, holes.length, pct)
                                  : getRelativeExtra(h.handicap, p.handicap, allHcps, holes.length, pct)
                                if (s !== null) totalNeto += s - extra; else hasTotal = false
                              })
                              return (
                                <tr key={p.id}>
                                  <td style={{ padding: '6px 10px', border: '1px solid var(--border)', background: 'var(--surface)' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                      <div style={{ width: 20, height: 20, borderRadius: '50%', background: PLAYER_BG[pi], display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: 'white', flexShrink: 0 }}>{p.name[0]?.toUpperCase()}</div>
                                      <span style={{ fontSize: 12, fontWeight: 500, whiteSpace: 'nowrap' }}>{p.name}</span>
                                      <span style={{ fontSize: 10, color: 'var(--text3)' }}>HCP {p.handicap}</span>
                                    </div>
                                  </td>
                                  {holeSet.map(h => {
                                    const s = getScore(p.id, h.hole_number)
                                    const extra = strategy === 'individual'
                                      ? getExtraStrokes(h.handicap, p.handicap, holes.length, pct)
                                      : getRelativeExtra(h.handicap, p.handicap, allHcps, holes.length, pct)
                                    const neto = s !== null ? s - extra : null
                                    if (neto !== null) rowNeto += neto; else hasRow = false
                                    return (
                                      <td key={h.hole_number} style={{ padding: 3, border: '1px solid var(--border)', background: 'var(--surface)', textAlign: 'center' }}>
                                        {neto !== null ? (
                                          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, fontSize: 12, fontWeight: 700,
                                            background: extra > 0 ? 'rgba(45,212,191,0.15)' : 'var(--surface2)',
                                            border: extra > 0 ? '1px solid rgba(45,212,191,0.4)' : '1px solid var(--border)',
                                            borderRadius: 4, position: 'relative'
                                          }}>
                                            {neto}
                                            {extra > 0 && <span style={{ position: 'absolute', top: -4, right: -4, width: 10, height: 10, background: '#2dd4bf', borderRadius: '50%', fontSize: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#051209', fontWeight: 900 }}>{extra}</span>}
                                          </div>
                                        ) : (
                                          <span style={{ color: 'var(--text3)', fontSize: 13 }}>—</span>
                                        )}
                                      </td>
                                    )
                                  })}
                                  <td style={{ padding: '6px 8px', border: '1px solid var(--border)', background: 'var(--surface)', textAlign: 'center', fontWeight: 700, fontSize: 14 }}>
                                    {hasRow ? <span style={{ color: PLAYER_COLORS[pi] }}>{rowNeto}</span> : '—'}
                                  </td>
                                  {isBack && (
                                    <td style={{ padding: '6px 8px', border: '1px solid var(--border)', background: 'var(--surface)', textAlign: 'center', fontWeight: 700, fontSize: 14 }}>
                                      {hasTotal ? <span style={{ color: '#fbbf24' }}>{totalNeto}</span> : '—'}
                                    </td>
                                  )}
                                </tr>
                              )
                            })}
                            {showStatus && statuses && renderStatusRow(
                              holeSet, statuses, 'ESTADO', PLAYER_COLORS[p1pi] || '#2dd4bf', isBack
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          }

          // Render a doubles match-play scorecard: 2 team rows (best ball net per hole) + ESTADO row
          const DoublesNetTable = ({ team1Players, team2Players, pct, title, titleColor }: {
            team1Players: typeof players; team2Players: typeof players; pct: number;
            title?: string; titleColor?: string
          }) => {
            const data = computeDoublesData(team1Players, team2Players, pct)
            const statuses = data.map(d => d.status)
            const teamRow = (teamPlayers: typeof players, key: 'b1' | 'b2', teamIdx: 1 | 2) => {
              // sum per set
              const inSet = (holeSet: typeof holes) => {
                let sum = 0; let ok = true
                holeSet.forEach(h => {
                  const d = data.find(x => x.hole === h.hole_number)
                  const v = d ? d[key] : null
                  if (v === null) ok = false; else sum += v
                })
                return { sum, ok }
              }
              const inAll = () => {
                let sum = 0; let ok = true
                data.forEach(d => { if (d[key] === null) ok = false; else sum += d[key]! })
                return { sum, ok }
              }
              return { inSet, inAll, teamPlayers, key, teamIdx }
            }
            const t1 = teamRow(team1Players, 'b1', 1)
            const t2 = teamRow(team2Players, 'b2', 2)
            const teamColor = (t: 1 | 2) => t === 1 ? PLAYER_COLORS[0] : PLAYER_COLORS[2]
            const teamBg = (t: 1 | 2) => t === 1 ? PLAYER_BG[0] : PLAYER_BG[2]
            const teamLabel = (tp: typeof players) =>
              tp.length === 2 ? `${tp[0].name} y ${tp[1].name}` : tp.map(p => p.name).join(' y ')

            return (
              <div style={{ marginBottom: 16 }}>
                {title && (
                  <div style={{ fontFamily: 'var(--display)', fontSize: 12, letterSpacing: 2, color: titleColor || 'var(--text3)', paddingBottom: 8, display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span>{title}</span>
                    <span style={{ color: 'var(--text3)', fontSize: 11 }}>· HCP {pct}% · Mejor bola</span>
                  </div>
                )}
                {[front9, ...(back9.length > 0 ? [back9] : [])].map((holeSet, si) => {
                  const isBack = back9.length > 0 && si === 1
                  const setLabel = isBack ? 'VUELTA' : 'IDA'
                  return (
                    <div key={si} style={{ marginBottom: 10 }}>
                      <div style={{ fontSize: 11, color: 'var(--text3)', letterSpacing: 1, paddingBottom: 4 }}>
                        {si === 0 ? 'IDA — HOYOS 1–9' : 'VUELTA — HOYOS 10–18'}
                      </div>
                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 500 }}>
                          <thead>
                            <tr>
                              <th style={{ textAlign: 'left', padding: '8px 10px', fontSize: 11, color: 'var(--text3)', letterSpacing: 1, background: 'var(--surface2)', border: '1px solid var(--border)', minWidth: 140 }}>EQUIPO</th>
                              {holeSet.map(h => (
                                <th key={h.hole_number} style={{ width: 42, padding: '6px 4px', fontSize: 12, color: 'var(--text3)', background: 'var(--surface2)', border: '1px solid var(--border)' }}>
                                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text2)' }}>{h.hole_number}</div>
                                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)' }}>P{h.par}</div><div style={{ fontSize: 11, fontWeight: 700, color: '#2dd4bf' }}>V{h.handicap}</div>
                                </th>
                              ))}
                              <th style={{ width: 52, padding: '6px 8px', fontSize: 11, color: '#2dd4bf', background: 'var(--surface2)', border: '1px solid var(--border)' }}>{setLabel}</th>
                              {isBack && (
                                <th style={{ width: 56, padding: '6px 8px', fontSize: 11, color: '#fbbf24', background: 'var(--surface2)', border: '1px solid var(--border)' }}>TOTAL</th>
                              )}
                            </tr>
                          </thead>
                          <tbody>
                            {[t1, t2].map(team => {
                              const setRes = team.inSet(holeSet)
                              const totalRes = team.inAll()
                              return (
                                <tr key={team.teamIdx}>
                                  <td style={{ padding: '6px 10px', border: '1px solid var(--border)', background: 'var(--surface)' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                      <div style={{ width: 22, height: 22, borderRadius: 6, background: teamBg(team.teamIdx), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: 'white', flexShrink: 0 }}>T{team.teamIdx}</div>
                                      <span style={{ fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', color: teamColor(team.teamIdx) }}>{teamLabel(team.teamPlayers)}</span>
                                    </div>
                                  </td>
                                  {holeSet.map(h => {
                                    const d = data.find(x => x.hole === h.hole_number)
                                    const v = d ? d[team.key] : null
                                    const otherKey = team.key === 'b1' ? 'b2' : 'b1'
                                    const other = d ? d[otherKey] : null
                                    const isWin = v !== null && other !== null && v < other
                                    return (
                                      <td key={h.hole_number} style={{ padding: 3, border: '1px solid var(--border)', background: 'var(--surface)', textAlign: 'center' }}>
                                        {v !== null ? (
                                          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, fontSize: 12, fontWeight: 700,
                                            background: isWin ? `${teamBg(team.teamIdx)}30` : 'var(--surface2)',
                                            border: isWin ? `1px solid ${teamColor(team.teamIdx)}` : '1px solid var(--border)',
                                            color: isWin ? teamColor(team.teamIdx) : 'var(--text)',
                                            borderRadius: 4
                                          }}>{v}</div>
                                        ) : (
                                          <span style={{ color: 'var(--text3)', fontSize: 13 }}>—</span>
                                        )}
                                      </td>
                                    )
                                  })}
                                  <td style={{ padding: '6px 8px', border: '1px solid var(--border)', background: 'var(--surface)', textAlign: 'center', fontWeight: 700, fontSize: 14, color: teamColor(team.teamIdx) }}>
                                    {setRes.ok ? setRes.sum : '—'}
                                  </td>
                                  {isBack && (
                                    <td style={{ padding: '6px 8px', border: '1px solid var(--border)', background: 'var(--surface)', textAlign: 'center', fontWeight: 700, fontSize: 14, color: '#fbbf24' }}>
                                      {totalRes.ok ? totalRes.sum : '—'}
                                    </td>
                                  )}
                                </tr>
                              )
                            })}
                            {renderStatusRow(holeSet, statuses, `ESTADO (T1)`, teamColor(1), isBack)}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          }

          // Ryder: dobles + 4 individuales
          if (isRyder) {
            const dPct = (r as any).dobles_hcp_pct ?? 100
            const dMode = (r as any).dobles_mode || 'matchplay'
            const iPct = (r as any).individual_hcp_pct ?? 80
            const iMode = (r as any).individual_mode || 'matchplay'
            const team1 = players.filter(p => p.team === 1)
            const team2 = players.filter(p => p.team === 2)
            const pairs = [
              [team1[0], team2[0]], [team1[0], team2[1]],
              [team1[1], team2[0]], [team1[1], team2[1]],
            ].filter(pair => pair[0] && pair[1])
            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ background: 'var(--surface)', border: '1px solid #34d39920', borderRadius: 12, padding: '14px 14px 4px' }}>
                  {dMode === 'matchplay' ? (
                    <DoublesNetTable title="DOBLES — MATCH PLAY" titleColor="#34d399"
                      team1Players={team1} team2Players={team2} pct={dPct} />
                  ) : (
                    <NetTable title="DOBLES — STROKE" titleColor="#34d399"
                      groupPlayers={players} pct={dPct} strategy="individual" />
                  )}
                </div>
                {pairs.map(([p1, p2], idx) => {
                  const pi1 = players.findIndex(p => p.id === p1.id)
                  return (
                    <div key={idx} style={{ background: 'var(--surface)', border: '1px solid #f59e0b20', borderRadius: 12, padding: '14px 14px 4px' }}>
                      <NetTable title={`${p1.name} vs ${p2.name} — ${iMode === 'stroke' ? 'STROKE' : 'MATCH PLAY'}`}
                        titleColor={PLAYER_COLORS[pi1]} groupPlayers={[p1, p2]} pct={iPct}
                        strategy={iMode === 'stroke' ? 'individual' : 'relative'}
                        matchPlay={iMode === 'matchplay'} />
                    </div>
                  )
                })}
                <div style={{ fontSize: 11, color: 'var(--text3)', paddingTop: 4 }}>
                  El punto verde indica ventaja en ese hoyo. Fila <strong style={{ color: 'var(--text2)' }}>ESTADO</strong>: positivo = primer equipo/jugador arriba, negativo = abajo.
                </div>
              </div>
            )
          }

          // Bismarck + Individuales
          if (isCombBismarck) {
            const bPct = (r as any).bismarck_hcp_pct ?? 100
            const iPct = (r as any).individual_hcp_pct ?? 80
            const iMode = (r as any).individual_mode || 'matchplay'
            const pairs = [[players[0], players[1]], [players[0], players[2]], [players[1], players[2]]]
            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ background: 'var(--surface)', border: '1px solid #f8717120', borderRadius: 12, padding: '14px 14px 4px' }}>
                  <NetTable title="BISMARCK" titleColor="#f87171" groupPlayers={players} pct={bPct} strategy="relative" />
                </div>
                {pairs.map(([p1, p2], idx) => {
                  const pi1 = players.findIndex(p => p.id === p1.id)
                  return (
                    <div key={idx} style={{ background: 'var(--surface)', border: '1px solid #f59e0b20', borderRadius: 12, padding: '14px 14px 4px' }}>
                      <NetTable title={`${p1.name} vs ${p2.name} — ${iMode === 'stroke' ? 'STROKE' : 'MATCH PLAY'}`}
                        titleColor={PLAYER_COLORS[pi1]} groupPlayers={[p1, p2]} pct={iPct}
                        strategy={iMode === 'stroke' ? 'individual' : 'relative'}
                        matchPlay={iMode === 'matchplay'} />
                    </div>
                  )
                })}
                <div style={{ fontSize: 11, color: 'var(--text3)', paddingTop: 4 }}>
                  El punto verde indica ventaja en ese hoyo. Fila <strong style={{ color: 'var(--text2)' }}>ESTADO</strong>: positivo = primer jugador arriba.
                </div>
              </div>
            )
          }

          // Match Play Dobles standalone
          if (r.mode === 'matchplay_dobles') {
            const team1 = players.filter(p => p.team === 1)
            const team2 = players.filter(p => p.team === 2)
            return (
              <>
                <DoublesNetTable title="MATCH PLAY DOBLES" titleColor="#a78bfa"
                  team1Players={team1} team2Players={team2} pct={hcpPct} />
                <div style={{ fontSize: 11, color: 'var(--text3)', paddingTop: 4 }}>
                  Fila <strong style={{ color: 'var(--text2)' }}>ESTADO</strong>: positivo = Team 1 arriba, negativo = abajo.
                </div>
              </>
            )
          }

          // Modos simples
          const simpleStrategy = isStroke ? 'individual' : 'relative'
          const isMatchplayIndiv = r.mode === 'matchplay_individual'
          return (
            <>
              <NetTable groupPlayers={players} pct={hcpPct} strategy={simpleStrategy}
                matchPlay={isMatchplayIndiv} />
              <div style={{ fontSize: 11, color: 'var(--text3)', paddingTop: 4 }}>
                El punto verde indica ventaja en ese hoyo.{isMatchplayIndiv && ' Fila ESTADO: positivo = primer jugador arriba.'}
              </div>
            </>
          )
        })()}

        {/* ── RESULTADOS ── */}
        {activeTab === 'results' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* STROKE */}
            {r.mode === 'stroke' && (
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', fontFamily: 'var(--display)', fontSize: 14, letterSpacing: 2, color: 'var(--text3)' }}>STROKE PLAY — STABLEFORD</div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: 'var(--surface2)' }}>
                      {['Pos', 'Jugador', 'HCP', 'Gross', 'Neto', '+/-', 'Stableford'].map(h => (
                        <th key={h} style={{ padding: '8px 12px', fontSize: 11, color: 'var(--text3)', textAlign: h === 'Jugador' ? 'left' : 'center', border: '1px solid var(--border)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[...strokeResults].sort((a, b) => b.stableford - a.stableford).map((res, rank) => {
                      const pi = players.findIndex(p => p.id === res.playerId)
                      return (
                        <tr key={res.playerId}>
                          <td style={{ padding: '10px 12px', border: '1px solid var(--border)', textAlign: 'center', fontFamily: 'var(--display)', fontSize: 18, color: rank === 0 ? '#f59e0b' : 'var(--text3)' }}>{rank + 1}</td>
                          <td style={{ padding: '10px 12px', border: '1px solid var(--border)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div style={{ width: 24, height: 24, borderRadius: '50%', background: PLAYER_BG[pi], display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: 'white' }}>{res.name[0]?.toUpperCase()}</div>
                              <span style={{ fontWeight: 500, color: PLAYER_COLORS[pi] }}>{res.name}</span>
                            </div>
                          </td>
                          <td style={{ padding: '10px 12px', border: '1px solid var(--border)', textAlign: 'center', color: 'var(--text3)' }}>{players[pi]?.handicap}</td>
                          <td style={{ padding: '10px 12px', border: '1px solid var(--border)', textAlign: 'center', fontWeight: 600 }}>{res.gross || '—'}</td>
                          <td style={{ padding: '10px 12px', border: '1px solid var(--border)', textAlign: 'center', fontWeight: 600, color: '#2dd4bf' }}>{res.gross ? res.net : '—'}</td>
                          <td style={{ padding: '10px 12px', border: '1px solid var(--border)', textAlign: 'center', fontWeight: 600, color: res.overUnder < 0 ? '#2dd4bf' : res.overUnder > 0 ? '#f87171' : 'var(--text)' }}>
                            {res.gross ? (res.overUnder > 0 ? `+${res.overUnder}` : res.overUnder) : '—'}
                          </td>
                          <td style={{ padding: '10px 12px', border: '1px solid var(--border)', textAlign: 'center', fontFamily: 'var(--display)', fontSize: 20, color: '#f59e0b' }}>{res.stableford || '—'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* MATCH PLAY INDIVIDUAL */}
            {r.mode === 'matchplay_individual' && matchResult && (() => {
              const winner = matchResult.concluded && matchResult.leaderId
                ? players.find(p => p.id === matchResult.leaderId) : null
              const loser = winner ? players.find(p => p.id !== winner.id) : null
              const leftP = winner || players[0]
              const rightP = loser || players[1]
              const leftPi = players.findIndex(p => p.id === leftP?.id)
              const rightPi = players.findIndex(p => p.id === rightP?.id)
              return (
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', fontFamily: 'var(--display)', fontSize: 14, letterSpacing: 2, color: 'var(--text3)' }}>MATCH PLAY INDIVIDUAL</div>
                <div style={{ padding: '16px 16px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                  {[leftP, rightP].map((p, i) => {
                    const pi = i === 0 ? leftPi : rightPi
                    return p ? (
                      <div key={p.id} style={{ textAlign: 'center', flex: 1 }}>
                        <div style={{ width: 44, height: 44, borderRadius: '50%', background: PLAYER_BG[pi], display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700, color: 'white', margin: '0 auto 8px' }}>{p.name[0]?.toUpperCase()}</div>
                        <div style={{ fontWeight: 600, color: p.id === matchResult.leaderId ? PLAYER_COLORS[pi] : 'var(--text2)', fontSize: 14 }}>{p.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text3)' }}>HCP {p.handicap}</div>
                      </div>
                    ) : null
                  })}
                  <MatchStatusBadge status={matchResult.status} concluded={matchResult.concluded} label={matchResult.concluded ? '🏆 Terminado' : `${matchResult.holeResults.length} hoyos`} />
                </div>
                <div style={{ borderTop: '1px solid var(--border)', padding: '10px 16px', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {matchResult.holeResults.map((h, idx) => {
                    const prevStatus = idx === 0 ? 0 : matchResult.holeResults[idx - 1].runningStatus
                    const prevAbs = Math.abs(prevStatus)
                    const prevLeader = prevStatus > 0 ? players[0]?.id : prevStatus < 0 ? players[1]?.id : null
                    return (
                      <div key={h.hole} style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 8, color: prevAbs > 0 ? (prevLeader === players[0]?.id ? PLAYER_COLORS[0] : PLAYER_COLORS[1]) : 'var(--text3)', marginBottom: 1, fontWeight: 600, minHeight: 10 }}>
                          {prevAbs > 0 ? `${prevAbs}↑` : '='}
                        </div>
                        <div style={{ fontSize: 9, color: 'var(--text3)', marginBottom: 2 }}>{h.hole}</div>
                        <div style={{ width: 22, height: 22, borderRadius: 3, background: h.winner === players[0]?.id ? PLAYER_BG[0] : h.winner === players[1]?.id ? PLAYER_BG[1] : 'var(--border2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: 'white', fontWeight: 700 }}>
                          {h.winner === 'halved' ? '=' : h.winner === players[0]?.id ? '1' : '2'}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
              )
            })()}

            {/* MATCH PLAY DOBLES */}
            {r.mode === 'matchplay_dobles' && doublesResult && (() => {
              const winnerTeam = doublesResult.concluded ? doublesResult.leadingTeam : null
              const leftTeam = winnerTeam || 1
              const rightTeam = leftTeam === 1 ? 2 : 1
              return (
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', fontFamily: 'var(--display)', fontSize: 14, letterSpacing: 2, color: 'var(--text3)' }}>MATCH PLAY DOBLES</div>
                <div style={{ padding: '16px 16px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                  {[leftTeam, rightTeam].map(t => (
                    <div key={t} style={{ textAlign: 'center', flex: 1 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: doublesResult.leadingTeam === t ? PLAYER_COLORS[t === 1 ? 0 : 2] : 'var(--text2)', marginBottom: 4 }}>TEAM {t}</div>
                      {players.filter(p => p.team === t).map(p => <div key={p.id} style={{ fontSize: 13, color: 'var(--text3)' }}>{p.name}</div>)}
                    </div>
                  ))}
                  <MatchStatusBadge status={doublesResult.status} concluded={doublesResult.concluded} label={doublesResult.concluded ? '🏆 Terminado' : `${doublesResult.holeResults.length} hoyos`} />
                </div>
                <div style={{ borderTop: '1px solid var(--border)', padding: '10px 16px', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {doublesResult.holeResults.map((h, idx) => {
                    const prevStatus = idx === 0 ? 0 : doublesResult.holeResults[idx - 1].runningStatus
                    const prevAbs = Math.abs(prevStatus)
                    const prevLeaderTeam = prevStatus > 0 ? 1 : prevStatus < 0 ? 2 : null
                    return (
                      <div key={h.hole} style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 8, color: prevAbs > 0 ? PLAYER_COLORS[prevLeaderTeam === 1 ? 0 : 2] : 'var(--text3)', marginBottom: 1, fontWeight: 600, minHeight: 10 }}>
                          {prevAbs > 0 ? `${prevAbs}↑` : '='}
                        </div>
                        <div style={{ fontSize: 9, color: 'var(--text3)', marginBottom: 2 }}>{h.hole}</div>
                        <div style={{ width: 22, height: 22, borderRadius: 3, background: h.winner === 'team1' ? PLAYER_BG[0] : h.winner === 'team2' ? PLAYER_BG[2] : 'var(--border2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: 'white', fontWeight: 700 }}>
                          {h.winner === 'halved' ? '=' : h.winner === 'team1' ? 'T1' : 'T2'}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
              )
            })()}

            {/* BISMARCK */}
            {r.mode === 'bismarck' && bismarckResult && (
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', fontFamily: 'var(--display)', fontSize: 14, letterSpacing: 2, color: 'var(--text3)' }}>BISMARCK</div>
                <div style={{ display: 'flex', padding: 16, gap: 12 }}>
                  {bismarckResult.totals.map((t, rank) => {
                    const pi = players.findIndex(p => p.id === t.playerId)
                    return (
                      <div key={t.playerId} style={{ flex: 1, textAlign: 'center', padding: '14px 10px', borderRadius: 10, background: rank === 0 ? `${PLAYER_BG[pi]}20` : 'var(--surface2)', border: `1px solid ${rank === 0 ? PLAYER_BG[pi] + '40' : 'var(--border)'}` }}>
                        <div style={{ width: 32, height: 32, borderRadius: '50%', background: PLAYER_BG[pi], display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: 'white', margin: '0 auto 8px', fontSize: 13 }}>{t.name[0]?.toUpperCase()}</div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: PLAYER_COLORS[pi], marginBottom: 4 }}>{t.name}</div>
                        <div style={{ fontFamily: 'var(--display)', fontSize: 32, color: rank === 0 ? '#f59e0b' : 'var(--text)' }}>{t.total}</div>
                        <div style={{ fontSize: 10, color: 'var(--text3)' }}>puntos</div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* RYDER (combinado 4) */}
            {r.mode === 'combinado_4' && combinado4Result && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ background: 'var(--surface)', border: '1px solid #34d39930', borderRadius: 12, overflow: 'hidden' }}>
                  <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', fontFamily: 'var(--display)', fontSize: 14, letterSpacing: 2, color: '#34d399' }}>
                    DOBLES — {((r as any).dobles_mode === 'stroke' ? 'STROKE' : 'MATCH PLAY')} · HCP {(r as any).dobles_hcp_pct}%
                  </div>
                  <div style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    {(() => {
                      const winnerTeam = combinado4Result.dobles?.concluded ? combinado4Result.dobles.leadingTeam : null
                      const leftTeam = winnerTeam || 1
                      const rightTeam = leftTeam === 1 ? 2 : 1
                      return [leftTeam, rightTeam].map(t => (
                        <div key={t} style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: PLAYER_COLORS[t === 1 ? 0 : 2], marginBottom: 4 }}>TEAM {t}</div>
                          {players.filter(p => p.team === t).map(p => <div key={p.id} style={{ fontSize: 13, color: 'var(--text3)' }}>{p.name}</div>)}
                        </div>
                      ))
                    })()}
                    {combinado4Result.dobles && (
                      <MatchStatusBadge status={combinado4Result.dobles.status} concluded={combinado4Result.dobles.concluded} label={combinado4Result.dobles.concluded ? '🏆 Terminado' : 'En juego'} />
                    )}
                    {combinado4Result.doblesStroke && (
                      <div style={{ display: 'flex', gap: 16 }}>
                        {[1, 2].map(t => {
                          const teamPlayers = players.filter(p => p.team === t)
                          const best = teamPlayers.reduce((max, p) => {
                            const res = combinado4Result.doblesStroke!.find(r => r.playerId === p.id)
                            return (res?.stableford || 0) > max ? (res?.stableford || 0) : max
                          }, 0)
                          return (
                            <div key={t} style={{ textAlign: 'center' }}>
                              <div style={{ fontSize: 10, color: 'var(--text3)' }}>T{t} Stableford</div>
                              <div style={{ fontFamily: 'var(--display)', fontSize: 24, color: PLAYER_COLORS[t === 1 ? 0 : 2] }}>{best}</div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ background: 'var(--surface)', border: '1px solid #f59e0b30', borderRadius: 12, overflow: 'hidden' }}>
                  <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', fontFamily: 'var(--display)', fontSize: 14, letterSpacing: 2, color: '#f59e0b' }}>
                    INDIVIDUALES — {((r as any).individual_mode === 'stroke' ? 'STROKE' : 'MATCH PLAY')} · HCP {(r as any).individual_hcp_pct}%
                  </div>
                  <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {combinado4Result.individuales.map(({ p1, p2, match, stroke }, idx) => {
                      const pi1 = players.findIndex(p => p.id === p1?.id)
                      const pi2 = players.findIndex(p => p.id === p2?.id)
                      if (!p1 || !p2) return null
                      return <IndividualResultCard key={idx} p1={p1} p2={p2} match={match} stroke={stroke} pi1={pi1} pi2={pi2} />
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* COMBINADO BISMARCK */}
            {r.mode === 'combinado_bismarck' && combinadoBismarckResult && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ background: 'var(--surface)', border: '1px solid #f8717130', borderRadius: 12, overflow: 'hidden' }}>
                  <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', fontFamily: 'var(--display)', fontSize: 14, letterSpacing: 2, color: '#f87171' }}>
                    BISMARCK · HCP {(r as any).bismarck_hcp_pct}%
                  </div>
                  <div style={{ display: 'flex', padding: 16, gap: 12 }}>
                    {combinadoBismarckResult.bismarck.totals.map((t, rank) => {
                      const pi = players.findIndex(p => p.id === t.playerId)
                      return (
                        <div key={t.playerId} style={{ flex: 1, textAlign: 'center', padding: '12px 8px', borderRadius: 10, background: rank === 0 ? `${PLAYER_BG[pi]}20` : 'var(--surface2)', border: `1px solid ${rank === 0 ? PLAYER_BG[pi] + '40' : 'var(--border)'}` }}>
                          <div style={{ width: 28, height: 28, borderRadius: '50%', background: PLAYER_BG[pi], display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: 'white', margin: '0 auto 6px', fontSize: 11 }}>{t.name[0]?.toUpperCase()}</div>
                          <div style={{ fontSize: 12, fontWeight: 600, color: PLAYER_COLORS[pi] }}>{t.name}</div>
                          <div style={{ fontFamily: 'var(--display)', fontSize: 28, color: rank === 0 ? '#f59e0b' : 'var(--text)' }}>{t.total}</div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                <div style={{ background: 'var(--surface)', border: '1px solid #f59e0b30', borderRadius: 12, overflow: 'hidden' }}>
                  <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', fontFamily: 'var(--display)', fontSize: 14, letterSpacing: 2, color: '#f59e0b' }}>
                    INDIVIDUALES — {((r as any).individual_mode === 'stroke' ? 'STROKE' : 'MATCH PLAY')} · HCP {(r as any).individual_hcp_pct}%
                  </div>
                  <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {combinadoBismarckResult.individuales.map(({ p1, p2, match, stroke }, idx) => {
                      const pi1 = players.findIndex(p => p.id === p1?.id)
                      const pi2 = players.findIndex(p => p.id === p2?.id)
                      return <IndividualResultCard key={idx} p1={p1} p2={p2} match={match} stroke={stroke} pi1={pi1} pi2={pi2} />
                    })}
                  </div>
                </div>
              </div>
            )}

          </div>
        )}
      </main>

      {/* DELETE CONFIRMATION MODAL */}
      {deleteCode !== null && (
        <div onClick={cancelDelete} style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 100, padding: 20
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: 'var(--surface)', border: '1px solid rgba(248,113,113,0.3)',
            borderRadius: 14, padding: 24, maxWidth: 380, width: '100%'
          }}>
            <div style={{ fontFamily: 'var(--display)', fontSize: 18, letterSpacing: 2, color: '#f87171', marginBottom: 8 }}>
              🗑 BORRAR PARTIDA
            </div>
            <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 16, lineHeight: 1.5 }}>
              Esta acción no se puede deshacer. Para confirmar, escribe el código:
            </div>
            <div style={{
              background: 'rgba(248,113,113,0.08)',
              border: '1px solid rgba(248,113,113,0.25)',
              borderRadius: 10, padding: '14px 16px', textAlign: 'center',
              marginBottom: 14
            }}>
              <div style={{ fontSize: 10, color: 'var(--text3)', letterSpacing: 2, marginBottom: 4 }}>CÓDIGO</div>
              <div style={{ fontFamily: 'var(--display)', fontSize: 36, letterSpacing: 8, color: '#f87171', fontWeight: 700 }}>
                {deleteCode}
              </div>
            </div>
            <input
              type="text" inputMode="numeric" pattern="[0-9]*" maxLength={4}
              autoFocus
              value={deleteInput}
              onChange={e => { setDeleteInput(e.target.value.replace(/\D/g, '')); setDeleteError(false) }}
              placeholder="Escribe los 4 dígitos"
              style={{
                width: '100%', boxSizing: 'border-box',
                background: 'rgba(255,255,255,0.04)',
                border: `1px solid ${deleteError ? '#f87171' : 'var(--border2)'}`,
                borderRadius: 8, color: 'var(--text)',
                padding: '12px 14px', fontSize: 18, letterSpacing: 6,
                textAlign: 'center', outline: 'none', marginBottom: 4,
                fontFamily: 'var(--display)'
              }}
            />
            {deleteError && (
              <div style={{ fontSize: 12, color: '#f87171', marginBottom: 8 }}>Código incorrecto.</div>
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <button onClick={cancelDelete} disabled={deleting} style={{
                flex: 1, padding: '10px 14px',
                background: 'transparent', border: '1px solid var(--border2)',
                borderRadius: 8, color: 'var(--text2)', fontSize: 13, cursor: 'pointer'
              }}>Cancelar</button>
              <button onClick={confirmDelete} disabled={deleting || deleteInput.length !== 4} style={{
                flex: 1, padding: '10px 14px',
                background: deleteInput.length === 4 ? '#f87171' : 'rgba(248,113,113,0.3)',
                border: 'none', borderRadius: 8,
                color: deleteInput.length === 4 ? '#1a0606' : 'rgba(255,255,255,0.4)',
                fontSize: 13, fontWeight: 700, cursor: deleteInput.length === 4 ? 'pointer' : 'not-allowed'
              }}>
                {deleting ? 'Borrando…' : 'Borrar definitivamente'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
