'use client'
import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase, Round, RoundPlayer, Score, Hole, Course } from '@/lib/supabase'
import {
  calcStroke, calcMatchPlay, calcMatchPlayDobles, calcBismarck,
  stablefordPoints, getExtraStrokes
} from '@/lib/golf'

const PLAYER_COLORS = ['#2dd4bf', '#f59e0b', '#a78bfa', '#f87171']
const PLAYER_BG = ['#0d9488', '#d97706', '#7c3aed', '#dc2626']

function ScoreBadge({ strokes, par }: { strokes: number | null; par: number }) {
  if (!strokes) return <span style={{ color: 'var(--text3)', fontSize: 13 }}>—</span>
  const d = strokes - par
  const styles: Record<string, React.CSSProperties> = {
    eagle: { background: '#fbbf24', color: '#1a0f00', borderRadius: '50%', width: 26, height: 26 },
    birdie: { background: '#2dd4bf', color: '#051209', borderRadius: 4 },
    par: { background: 'var(--surface2)', color: 'var(--text)', border: '1px solid var(--border2)' },
    bogey: { background: 'rgba(248,113,113,0.15)', color: '#f87171', border: '1px solid rgba(248,113,113,0.3)' },
    double: { background: 'rgba(248,113,113,0.3)', color: '#fca5a5', border: '2px solid #f87171' },
    triple: { background: '#7f1d1d', color: '#fca5a5' },
  }
  const k = d <= -2 ? 'eagle' : d === -1 ? 'birdie' : d === 0 ? 'par' : d === 1 ? 'bogey' : d === 2 ? 'double' : 'triple'
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: 26, height: 26, fontSize: 12, fontWeight: 700, borderRadius: 4,
      ...styles[k]
    }}>{strokes}</span>
  )
}

export default function RoundPage() {
  const { id } = useParams<{ id: string }>()
  const [round, setRound] = useState<Round | null>(null)
  const [players, setPlayers] = useState<RoundPlayer[]>([])
  const [scores, setScores] = useState<Score[]>([])
  const [holes, setHoles] = useState<Hole[]>([])
  const [course, setCourse] = useState<Course | null>(null)
  const [activeTab, setActiveTab] = useState<'card' | 'results'>('card')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const { data: r } = await supabase.from('rounds').select('*, course:courses(*, holes(*))').eq('id', id).single()
      if (!r) return
      const { data: p } = await supabase.from('round_players').select('*').eq('round_id', id).order('position')
      const { data: s } = await supabase.from('scores').select('*').eq('round_id', id)

      setRound(r as any)
      setCourse((r as any).course)
      const sortedHoles = [...((r as any).course?.holes || [])].sort((a: any, b: any) => a.hole_number - b.hole_number)
      const usedHoles = sortedHoles.slice(0, r.holes_played)
      setHoles(usedHoles as any)
      setPlayers((p || []) as any)
      setScores((s || []) as any)
      setLoading(false)
    }
    load()
  }, [id])

  const getScore = useCallback((playerId: string, hole: number) =>
    scores.find(s => s.player_id === playerId && s.hole_number === hole)?.strokes ?? null,
    [scores])

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
      await supabase.from('scores').delete()
        .eq('round_id', id).eq('player_id', playerId).eq('hole_number', holeNumber)
    } else {
      await supabase.from('scores').upsert({
        round_id: id, player_id: playerId, hole_number: holeNumber, strokes
      }, { onConflict: 'round_id,player_id,hole_number' })
    }
    setSaving(null)
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)' }}>
      Cargando partida…
    </div>
  )

  const strokeResults = calcStroke(players, scores, holes, holes.length)
  const matchResult = round?.mode === 'matchplay_individual' && players.length >= 2
    ? calcMatchPlay(players[0], players[1], scores, holes, holes.length) : null
  const doublesResult = round?.mode === 'matchplay_dobles' && players.length === 4
    ? calcMatchPlayDobles(players, scores, holes, holes.length) : null
  const bismarckResult = round?.mode === 'bismarck' && players.length === 3
    ? calcBismarck(players, scores, holes, holes.length) : null

  const MODE_LABELS: Record<string, string> = {
    stroke: 'Stroke Play', matchplay_individual: 'Match Play',
    matchplay_dobles: 'Dobles', bismarck: 'Bismarck'
  }

  const front9 = holes.slice(0, 9)
  const back9 = holes.length > 9 ? holes.slice(9) : []

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      {/* Header */}
      <header style={{
        background: 'linear-gradient(135deg, #0a1f0f 0%, #071409 100%)',
        borderBottom: '1px solid var(--border)', padding: '18px 16px 14px'
      }}>
        <div style={{ maxWidth: 800, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <Link href="/" style={{ color: 'var(--text3)', fontSize: 18 }}>←</Link>
            <div>
              <h1 style={{ fontFamily: 'var(--display)', fontSize: 22, letterSpacing: 1, lineHeight: 1 }}>
                {course?.name}
              </h1>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
                {new Date(round!.date).toLocaleDateString('es-CL', { day: 'numeric', month: 'long' })}
                {' · '}{holes.length} hoyos · {MODE_LABELS[round!.mode]}
              </div>
            </div>
            {saving && <div style={{ marginLeft: 'auto', fontSize: 11, color: '#2dd4bf' }}>💾</div>}
          </div>

          {/* Players row */}
          <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
            {players.map((p, i) => (
              <div key={p.id} style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '4px 10px', borderRadius: 20,
                background: `${PLAYER_BG[i]}20`, border: `1px solid ${PLAYER_BG[i]}40`
              }}>
                <div style={{
                  width: 18, height: 18, borderRadius: '50%',
                  background: PLAYER_BG[i],
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 9, fontWeight: 700, color: 'white'
                }}>{p.name[0]?.toUpperCase()}</div>
                <span style={{ fontSize: 12, color: PLAYER_COLORS[i], fontWeight: 500 }}>{p.name}</span>
                <span style={{ fontSize: 10, color: 'var(--text3)' }}>HCP {p.handicap}</span>
                {round?.mode === 'matchplay_dobles' && p.team && (
                  <span style={{ fontSize: 10, color: 'var(--text3)' }}>T{p.team}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div style={{ borderBottom: '1px solid var(--border)', padding: '0 16px', display: 'flex', gap: 2 }}>
        {(['card', 'results'] as const).map(t => (
          <button key={t} onClick={() => setActiveTab(t)} style={{
            padding: '10px 16px', background: 'transparent', border: 'none',
            borderBottom: `2px solid ${activeTab === t ? '#2dd4bf' : 'transparent'}`,
            color: activeTab === t ? '#2dd4bf' : 'var(--text3)',
            fontFamily: 'var(--body)', fontSize: 13, fontWeight: 500,
            cursor: 'pointer', textTransform: 'capitalize'
          }}>{t === 'card' ? 'Tarjeta' : 'Resultados'}</button>
        ))}
      </div>

      <main style={{ maxWidth: 800, margin: '0 auto', padding: '16px 12px', overflowX: 'auto' }}>
        {activeTab === 'card' && (
          <>
            {[front9, ...(back9.length > 0 ? [back9] : [])].map((holeSet, si) => (
              <div key={si} style={{ marginBottom: 24 }}>
                <div style={{
                  fontFamily: 'var(--display)', fontSize: 13, letterSpacing: 2,
                  color: 'var(--text3)', paddingBottom: 8
                }}>
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
                                <div style={{ width: 20, height: 20, borderRadius: '50%', background: PLAYER_BG[pi], display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: 'white', flexShrink: 0 }}>
                                  {p.name[0]?.toUpperCase()}
                                </div>
                                <span style={{ fontSize: 12, fontWeight: 500, whiteSpace: 'nowrap' }}>{p.name}</span>
                              </div>
                            </td>
                            {holeSet.map(h => {
                              const s = getScore(p.id, h.hole_number)
                              return (
                                <td key={h.hole_number} style={{ padding: 3, border: '1px solid var(--border)', background: 'var(--surface)', textAlign: 'center', position: 'relative' }}>
                                  <div style={{ position: 'relative', width: 34, margin: '0 auto' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 30 }}>
                                      <ScoreBadge strokes={s} par={h.par} />
                                    </div>
                                    <input
                                      type="number" min="1" max="15"
                                      value={s || ''}
                                      onChange={e => handleScoreChange(p.id, h.hole_number, e.target.value)}
                                      style={{
                                        position: 'absolute', top: 0, left: 0,
                                        width: '100%', height: '100%',
                                        background: 'transparent', border: 'none',
                                        color: 'transparent', textAlign: 'center',
                                        fontSize: 13, cursor: 'pointer', outline: 'none',
                                        zIndex: 2,
                                        MozAppearance: 'textfield' as any
                                      }}
                                    />
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

            {/* Legend */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, paddingTop: 8 }}>
              {[
                { label: 'Eagle', bg: '#fbbf24', color: '#1a0f00', r: '50%' },
                { label: 'Birdie', bg: '#2dd4bf', color: '#051209', r: 4 },
                { label: 'Par', bg: 'var(--surface2)', color: 'var(--text)', border: '1px solid var(--border2)' },
                { label: 'Bogey', bg: 'rgba(248,113,113,0.15)', color: '#f87171', border: '1px solid rgba(248,113,113,0.3)' },
              ].map(l => (
                <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--text3)' }}>
                  <div style={{ width: 14, height: 14, background: l.bg, borderRadius: (l as any).r || 3, border: (l as any).border }} />
                  {l.label}
                </div>
              ))}
            </div>
          </>
        )}

        {activeTab === 'results' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* STROKE PLAY results */}
            {round?.mode === 'stroke' && (
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', fontFamily: 'var(--display)', fontSize: 14, letterSpacing: 2, color: 'var(--text3)' }}>
                  STROKE PLAY — STABLEFORD
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: 'var(--surface2)' }}>
                      {['Pos', 'Jugador', 'HCP', 'Gross', '+/-', 'Net', 'Stableford'].map(h => (
                        <th key={h} style={{ padding: '8px 12px', fontSize: 11, color: 'var(--text3)', letterSpacing: 1, fontWeight: 500, textAlign: h === 'Jugador' ? 'left' : 'center', border: '1px solid var(--border)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[...strokeResults].sort((a, b) => b.stableford - a.stableford).map((r, rank) => {
                      const pi = players.findIndex(p => p.id === r.playerId)
                      return (
                        <tr key={r.playerId}>
                          <td style={{ padding: '10px 12px', border: '1px solid var(--border)', textAlign: 'center', fontFamily: 'var(--display)', fontSize: 18, color: rank === 0 ? '#f59e0b' : 'var(--text3)' }}>{rank + 1}</td>
                          <td style={{ padding: '10px 12px', border: '1px solid var(--border)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div style={{ width: 24, height: 24, borderRadius: '50%', background: PLAYER_BG[pi], display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: 'white' }}>
                                {r.name[0]?.toUpperCase()}
                              </div>
                              <span style={{ fontWeight: 500, color: PLAYER_COLORS[pi] }}>{r.name}</span>
                            </div>
                          </td>
                          <td style={{ padding: '10px 12px', border: '1px solid var(--border)', textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>{players[pi]?.handicap}</td>
                          <td style={{ padding: '10px 12px', border: '1px solid var(--border)', textAlign: 'center', fontWeight: 600 }}>{r.gross || '—'}</td>
                          <td style={{ padding: '10px 12px', border: '1px solid var(--border)', textAlign: 'center', fontWeight: 600, color: r.overUnder < 0 ? '#2dd4bf' : r.overUnder > 0 ? '#f87171' : 'var(--text)' }}>
                            {r.gross ? (r.overUnder > 0 ? `+${r.overUnder}` : r.overUnder) : '—'}
                          </td>
                          <td style={{ padding: '10px 12px', border: '1px solid var(--border)', textAlign: 'center', fontWeight: 600 }}>{r.net || '—'}</td>
                          <td style={{ padding: '10px 12px', border: '1px solid var(--border)', textAlign: 'center', fontFamily: 'var(--display)', fontSize: 20, color: '#f59e0b' }}>{r.stableford || '—'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* MATCH PLAY results */}
            {round?.mode === 'matchplay_individual' && matchResult && (
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', fontFamily: 'var(--display)', fontSize: 14, letterSpacing: 2, color: 'var(--text3)' }}>
                  MATCH PLAY INDIVIDUAL
                </div>
                <div style={{ padding: '20px 16px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 24 }}>
                  {players.slice(0, 2).map((p, i) => (
                    <div key={p.id} style={{ textAlign: 'center' }}>
                      <div style={{ width: 48, height: 48, borderRadius: '50%', background: PLAYER_BG[i], display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 700, color: 'white', margin: '0 auto 8px' }}>
                        {p.name[0]?.toUpperCase()}
                      </div>
                      <div style={{ fontWeight: 600, color: matchResult.leaderId === p.id ? PLAYER_COLORS[i] : 'var(--text2)', fontSize: 14 }}>{p.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text3)' }}>HCP {p.handicap}</div>
                    </div>
                  ))}
                  <div style={{ textAlign: 'center', flex: 1 }}>
                    <div style={{ fontFamily: 'var(--display)', fontSize: 36, letterSpacing: 2, color: matchResult.concluded ? '#f59e0b' : '#2dd4bf' }}>
                      {matchResult.status}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>
                      {matchResult.concluded ? '🏆 Partido terminado' : `${matchResult.holeResults.length} hoyos jugados`}
                    </div>
                  </div>
                </div>
                {/* Hole by hole */}
                <div style={{ borderTop: '1px solid var(--border)', padding: '12px 16px', display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {matchResult.holeResults.map(h => (
                    <div key={h.hole} style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 9, color: 'var(--text3)', marginBottom: 2 }}>{h.hole}</div>
                      <div style={{
                        width: 20, height: 20, borderRadius: 3,
                        background: h.winner === players[0]?.id ? PLAYER_BG[0] : h.winner === players[1]?.id ? PLAYER_BG[1] : 'var(--border2)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: 'white', fontWeight: 700
                      }}>
                        {h.winner === 'halved' ? '=' : h.winner === players[0]?.id ? '1' : '2'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* DOBLES results */}
            {round?.mode === 'matchplay_dobles' && doublesResult && (
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', fontFamily: 'var(--display)', fontSize: 14, letterSpacing: 2, color: 'var(--text3)' }}>
                  MATCH PLAY DOBLES
                </div>
                <div style={{ padding: '20px 16px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 24 }}>
                  {[1, 2].map(t => {
                    const teamPlayers = players.filter(p => p.team === t)
                    const pi0 = players.findIndex(p => p.id === teamPlayers[0]?.id)
                    return (
                      <div key={t} style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: doublesResult.leadingTeam === t ? PLAYER_COLORS[t === 1 ? 0 : 2] : 'var(--text2)', marginBottom: 4 }}>TEAM {t}</div>
                        {teamPlayers.map((p, i) => <div key={p.id} style={{ fontSize: 13, color: 'var(--text3)' }}>{p.name}</div>)}
                      </div>
                    )
                  })}
                  <div style={{ textAlign: 'center', flex: 1 }}>
                    <div style={{ fontFamily: 'var(--display)', fontSize: 36, letterSpacing: 2, color: doublesResult.concluded ? '#f59e0b' : '#2dd4bf' }}>
                      {doublesResult.status}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>
                      {doublesResult.concluded ? '🏆 Partido terminado' : `${doublesResult.holeResults.length} hoyos`}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* BISMARCK results */}
            {round?.mode === 'bismarck' && bismarckResult && (
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', fontFamily: 'var(--display)', fontSize: 14, letterSpacing: 2, color: 'var(--text3)' }}>
                  BISMARCK — PUNTOS POR HOYO
                </div>
                {/* Totals */}
                <div style={{ display: 'flex', padding: 16, gap: 12, borderBottom: '1px solid var(--border)' }}>
                  {bismarckResult.totals.map((t, rank) => {
                    const pi = players.findIndex(p => p.id === t.playerId)
                    return (
                      <div key={t.playerId} style={{
                        flex: 1, textAlign: 'center', padding: '14px 10px', borderRadius: 10,
                        background: rank === 0 ? `${PLAYER_BG[pi]}20` : 'var(--surface2)',
                        border: `1px solid ${rank === 0 ? PLAYER_BG[pi] + '40' : 'var(--border)'}`
                      }}>
                        <div style={{ width: 32, height: 32, borderRadius: '50%', background: PLAYER_BG[pi], display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: 'white', margin: '0 auto 8px', fontSize: 13 }}>
                          {t.name[0]?.toUpperCase()}
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: PLAYER_COLORS[pi], marginBottom: 4 }}>{t.name}</div>
                        <div style={{ fontFamily: 'var(--display)', fontSize: 32, color: rank === 0 ? '#f59e0b' : 'var(--text)', letterSpacing: 1 }}>{t.total}</div>
                        <div style={{ fontSize: 10, color: 'var(--text3)' }}>puntos</div>
                      </div>
                    )
                  })}
                </div>
                {/* Hole by hole */}
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 400 }}>
                    <thead>
                      <tr style={{ background: 'var(--surface2)' }}>
                        <th style={{ padding: '7px 12px', fontSize: 11, color: 'var(--text3)', textAlign: 'left', border: '1px solid var(--border)' }}>HOYO</th>
                        {players.map((p, i) => (
                          <th key={p.id} style={{ padding: '7px 12px', fontSize: 11, color: PLAYER_COLORS[i], border: '1px solid var(--border)', textAlign: 'center' }}>{p.name}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {bismarckResult.holeResults.map(hr => (
                        <tr key={hr.hole}>
                          <td style={{ padding: '8px 12px', border: '1px solid var(--border)', fontFamily: 'var(--display)', fontSize: 16, color: 'var(--text2)' }}>{hr.hole}</td>
                          {players.map((p, pi) => {
                            const pr = hr.points.find(x => x.playerId === p.id)
                            const ns = hr.netStrokes.find(x => x.playerId === p.id)
                            return (
                              <td key={p.id} style={{ padding: '8px 12px', border: '1px solid var(--border)', textAlign: 'center' }}>
                                {pr ? (
                                  <div>
                                    <div style={{
                                      fontFamily: 'var(--display)', fontSize: 20,
                                      color: pr.pts === 4 ? '#f59e0b' : pr.pts === 3 ? '#2dd4bf' : pr.pts === 2 ? 'var(--text)' : 'var(--text3)'
                                    }}>{pr.pts}</div>
                                    {ns && <div style={{ fontSize: 10, color: 'var(--text3)' }}>net {ns.strokes}</div>}
                                  </div>
                                ) : <span style={{ color: 'var(--text3)' }}>—</span>}
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
