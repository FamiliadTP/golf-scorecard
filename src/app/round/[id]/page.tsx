'use client'
import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase, Round, RoundPlayer, Score, Hole, Course } from '@/lib/supabase'
import {
  calcStroke, calcMatchPlay, calcMatchPlayDobles, calcBismarck,
  calcCombinado4, calcCombinadoBismarck
} from '@/lib/golf'

const PLAYER_COLORS = ['#2dd4bf', '#f59e0b', '#a78bfa', '#f87171']
const PLAYER_BG = ['#0d9488', '#d97706', '#7c3aed', '#dc2626']

const MODE_LABELS: Record<string, string> = {
  stroke: 'Stroke Play', matchplay_individual: 'Match Play',
  matchplay_dobles: 'Dobles', bismarck: 'Bismarck',
  combinado_4: 'Cuatro Completo', combinado_bismarck: 'Bismarck + Individuales'
}

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

function IndividualResultCard({ p1, p2, match, stroke, pi1, pi2 }: any) {
  return (
    <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 22, height: 22, borderRadius: '50%', background: PLAYER_BG[pi1], display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: 'white' }}>{p1.name[0]?.toUpperCase()}</div>
          <span style={{ fontSize: 13, fontWeight: 600, color: PLAYER_COLORS[pi1] }}>{p1.name}</span>
        </div>
        <span style={{ fontSize: 11, color: 'var(--text3)' }}>vs</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: PLAYER_COLORS[pi2] }}>{p2.name}</span>
          <div style={{ width: 22, height: 22, borderRadius: '50%', background: PLAYER_BG[pi2], display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: 'white' }}>{p2.name[0]?.toUpperCase()}</div>
        </div>
        {match && <div style={{ fontFamily: 'var(--display)', fontSize: 20, color: match.concluded ? '#f59e0b' : '#2dd4bf', minWidth: 60, textAlign: 'center' }}>{match.status}</div>}
        {stroke && (
          <div style={{ display: 'flex', gap: 12, fontSize: 12 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ color: 'var(--text3)', fontSize: 10 }}>Stableford</div>
              <div style={{ color: PLAYER_COLORS[pi1], fontFamily: 'var(--display)', fontSize: 18 }}>{stroke.p1.stableford}</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ color: 'var(--text3)', fontSize: 10 }}>Stableford</div>
              <div style={{ color: PLAYER_COLORS[pi2], fontFamily: 'var(--display)', fontSize: 18 }}>{stroke.p2.stableford}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function RoundPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [round, setRound] = useState<Round | null>(null)
  const [players, setPlayers] = useState<RoundPlayer[]>([])
  const [scores, setScores] = useState<Score[]>([])
  const [holes, setHoles] = useState<Hole[]>([])
  const [course, setCourse] = useState<Course | null>(null)
  const [activeTab, setActiveTab] = useState<'card' | 'results'>('card')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: r } = await supabase.from('rounds').select('*, course:courses(*, holes(*))').eq('id', id).single()
      if (!r) return
      const { data: p } = await supabase.from('round_players').select('*').eq('round_id', id).order('position')
      const { data: s } = await supabase.from('scores').select('*').eq('round_id', id)
      setRound(r as any)
      setCourse((r as any).course)
      const sortedHoles = [...((r as any).course?.holes || [])].sort((a: any, b: any) => a.hole_number - b.hole_number).slice(0, r.holes_played)
      setHoles(sortedHoles as any)
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

  const handleDelete = async () => {
    if (!confirm('¿Eliminar esta partida? Esta acción no se puede deshacer.')) return
    setDeleting(true)
    await supabase.from('rounds').delete().eq('id', id)
    router.push('/')
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)' }}>Cargando…</div>
  )

  // Calculate results
  const r = round!
  const strokeResults = calcStroke(players, scores, holes, holes.length)
  const matchResult = r.mode === 'matchplay_individual' && players.length >= 2
    ? calcMatchPlay(players[0], players[1], scores, holes, holes.length) : null
  const doublesResult = r.mode === 'matchplay_dobles' && players.length === 4
    ? calcMatchPlayDobles(players, scores, holes, holes.length) : null
  const bismarckResult = r.mode === 'bismarck' && players.length === 3
    ? calcBismarck(players, scores, holes, holes.length) : null
  const combinado4Result = r.mode === 'combinado_4' && players.length === 4
    ? calcCombinado4(players, scores, holes, holes.length, (r as any).dobles_mode || 'matchplay', (r as any).dobles_hcp_pct ?? 100, (r as any).individual_mode || 'matchplay', (r as any).individual_hcp_pct ?? 80) : null
  const combinadoBismarckResult = r.mode === 'combinado_bismarck' && players.length === 3
    ? calcCombinadoBismarck(players, scores, holes, holes.length, (r as any).bismarck_hcp_pct ?? 100, (r as any).individual_mode || 'matchplay', (r as any).individual_hcp_pct ?? 80) : null

  const front9 = holes.slice(0, 9)
  const back9 = holes.length > 9 ? holes.slice(9) : []

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <header style={{ background: 'linear-gradient(135deg, #0a1f0f 0%, #071409 100%)', borderBottom: '1px solid var(--border)', padding: '18px 16px 14px' }}>
        <div style={{ maxWidth: 800, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <Link href="/" style={{ color: 'var(--text3)', fontSize: 18 }}>←</Link>
            <div>
              <h1 style={{ fontFamily: 'var(--display)', fontSize: 22, letterSpacing: 1, lineHeight: 1 }}>{course?.name}</h1>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
                {new Date(r.date).toLocaleDateString('es-CL', { day: 'numeric', month: 'long' })} · {holes.length} hoyos · {MODE_LABELS[r.mode]}
              </div>
            </div>
            {saving && <div style={{ marginLeft: 'auto', fontSize: 11, color: '#2dd4bf' }}>💾</div>}
            <button onClick={handleDelete} disabled={deleting} style={{
              marginLeft: 'auto', background: 'rgba(248,113,113,0.1)',
              border: '1px solid rgba(248,113,113,0.2)', color: '#f87171',
              borderRadius: 8, padding: '6px 12px', fontSize: 12,
              cursor: 'pointer', flexShrink: 0
            }}>🗑 Borrar</button>
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

      <div style={{ borderBottom: '1px solid var(--border)', padding: '0 16px', display: 'flex', gap: 2 }}>
        {(['card', 'results'] as const).map(t => (
          <button key={t} onClick={() => setActiveTab(t)} style={{
            padding: '10px 16px', background: 'transparent', border: 'none',
            borderBottom: `2px solid ${activeTab === t ? '#2dd4bf' : 'transparent'}`,
            color: activeTab === t ? '#2dd4bf' : 'var(--text3)',
            fontFamily: 'var(--body)', fontSize: 13, fontWeight: 500, cursor: 'pointer'
          }}>{t === 'card' ? 'Tarjeta' : 'Resultados'}</button>
        ))}
      </div>

      <main style={{ maxWidth: 800, margin: '0 auto', padding: '16px 12px' }}>
        {activeTab === 'card' && (
          <>
            {[front9, ...(back9.length > 0 ? [back9] : [])].map((holeSet, si) => (
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
                            <div>{h.hole_number}</div>
                            <div style={{ fontSize: 9, color: 'var(--text3)', fontWeight: 400 }}>P{h.par}</div>
                          </th>
                        ))}
                        <th style={{ width: 52, padding: '6px 8px', fontSize: 11, color: '#2dd4bf', background: 'var(--surface2)', border: '1px solid var(--border)' }}>TOT</th>
                      </tr>
                    </thead>
                    <tbody>
                      {players.map((p, pi) => {
                        const rowTotal = holeSet.reduce((s, h) => s + (getScore(p.id, h.hole_number) || 0), 0)
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
                              {rowTotal > 0 ? rowTotal : '—'}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
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

        {activeTab === 'results' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* STROKE */}
            {r.mode === 'stroke' && (
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', fontFamily: 'var(--display)', fontSize: 14, letterSpacing: 2, color: 'var(--text3)' }}>STROKE PLAY — STABLEFORD</div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: 'var(--surface2)' }}>
                      {['Pos', 'Jugador', 'HCP', 'Gross', '+/-', 'Stableford'].map(h => (
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
            {r.mode === 'matchplay_individual' && matchResult && (
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', fontFamily: 'var(--display)', fontSize: 14, letterSpacing: 2, color: 'var(--text3)' }}>MATCH PLAY INDIVIDUAL</div>
                <div style={{ padding: '20px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
                  {players.slice(0, 2).map((p, i) => (
                    <div key={p.id} style={{ textAlign: 'center' }}>
                      <div style={{ width: 44, height: 44, borderRadius: '50%', background: PLAYER_BG[i], display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700, color: 'white', margin: '0 auto 8px' }}>{p.name[0]?.toUpperCase()}</div>
                      <div style={{ fontWeight: 600, color: matchResult.leaderId === p.id ? PLAYER_COLORS[i] : 'var(--text2)', fontSize: 14 }}>{p.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text3)' }}>HCP {p.handicap}</div>
                    </div>
                  ))}
                  <MatchStatusBadge status={matchResult.status} concluded={matchResult.concluded} label={matchResult.concluded ? '🏆 Terminado' : `${matchResult.holeResults.length} hoyos`} />
                </div>
                <div style={{ borderTop: '1px solid var(--border)', padding: '10px 16px', display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {matchResult.holeResults.map(h => (
                    <div key={h.hole} style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 9, color: 'var(--text3)', marginBottom: 2 }}>{h.hole}</div>
                      <div style={{ width: 20, height: 20, borderRadius: 3, background: h.winner === players[0]?.id ? PLAYER_BG[0] : h.winner === players[1]?.id ? PLAYER_BG[1] : 'var(--border2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: 'white', fontWeight: 700 }}>
                        {h.winner === 'halved' ? '=' : h.winner === players[0]?.id ? '1' : '2'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* MATCH PLAY DOBLES */}
            {r.mode === 'matchplay_dobles' && doublesResult && (
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', fontFamily: 'var(--display)', fontSize: 14, letterSpacing: 2, color: 'var(--text3)' }}>MATCH PLAY DOBLES</div>
                <div style={{ padding: '20px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
                  {[1, 2].map(t => (
                    <div key={t} style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: doublesResult.leadingTeam === t ? PLAYER_COLORS[t === 1 ? 0 : 2] : 'var(--text2)', marginBottom: 4 }}>TEAM {t}</div>
                      {players.filter(p => p.team === t).map(p => <div key={p.id} style={{ fontSize: 13, color: 'var(--text3)' }}>{p.name}</div>)}
                    </div>
                  ))}
                  <MatchStatusBadge status={doublesResult.status} concluded={doublesResult.concluded} label={doublesResult.concluded ? '🏆 Terminado' : `${doublesResult.holeResults.length} hoyos`} />
                </div>
              </div>
            )}

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

            {/* COMBINADO 4 */}
            {r.mode === 'combinado_4' && combinado4Result && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {/* Dobles */}
                <div style={{ background: 'var(--surface)', border: '1px solid #34d39930', borderRadius: 12, overflow: 'hidden' }}>
                  <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', fontFamily: 'var(--display)', fontSize: 14, letterSpacing: 2, color: '#34d399' }}>
                    DOBLES — {((r as any).dobles_mode === 'stroke' ? 'STROKE' : 'MATCH PLAY')} · HCP {(r as any).dobles_hcp_pct}%
                  </div>
                  <div style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    {[1, 2].map(t => (
                      <div key={t} style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: PLAYER_COLORS[t === 1 ? 0 : 2], marginBottom: 4 }}>TEAM {t}</div>
                        {players.filter(p => p.team === t).map(p => <div key={p.id} style={{ fontSize: 13, color: 'var(--text3)' }}>{p.name}</div>)}
                      </div>
                    ))}
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

                {/* Individuales */}
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
    </div>
  )
}
