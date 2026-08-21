'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import TopBar from '@/components/TopBar'
import { supabase, Round, RoundPlayer, Score, Hole, Course } from '@/lib/supabase'
import {
  buildLeaderboardEntries, compareCountback, LeaderboardEntry,
  correctCombinedHandicaps, buildLoopRoundHoles
} from '@/lib/golf'

const GROUP_COLORS = ['#2B5F7A', '#2F6B4F', '#B8935A', '#6B5B95', '#7A2E2E', '#2B5F7A', '#B8703C', '#A65B7A']

interface Row extends LeaderboardEntry { groupIdx: number }

// Reconstruye los 18 (o 9) hoyos de una vuelta aplicando la corrección de loops,
// igual que la página de la partida.
function buildHoles(round: any, courseById: Record<string, Course>): Hole[] {
  const course = courseById[round.course_id]
  const courseHoles = (course?.holes || []) as Hole[]
  if (round.second_course_id) {
    const second = courseById[round.second_course_id]
    return buildLoopRoundHoles([...courseHoles], [...((second?.holes || []) as Hole[])])
  }
  const sorted = [...courseHoles].sort((a, b) => a.hole_number - b.hole_number).slice(0, round.holes_played)
  return correctCombinedHandicaps(sorted)
}

export default function LeaderboardPage() {
  const { id } = useParams<{ id: string }>()
  const [refRound, setRefRound] = useState<Round | null>(null)
  const [rows, setRows] = useState<Row[]>([])
  const [groups, setGroups] = useState<{ idx: number; roundId: string; names: string }[]>([])
  const [tab, setTab] = useState<'gross' | 'neto'>('neto')
  const [loading, setLoading] = useState(true)
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null)

  const load = useCallback(async () => {
    if (!id) return
    const { data: ref } = await supabase.from('rounds').select('*').eq('id', id).single()
    if (!ref) { setLoading(false); return }
    setRefRound(ref as any)

    // Cuartos/tríos que comparten la competencia: misma cancha + fecha + modalidad.
    let rounds: any[] = [ref]
    if ((ref as any).grupal) {
      const { data: rs } = await supabase.from('rounds').select('*')
        .eq('mode', 'stroke_grupal').eq('grupal', true)
        .eq('course_id', (ref as any).course_id).eq('date', (ref as any).date)
        .order('created_at', { ascending: true })
      if (rs && rs.length) rounds = rs as any[]
    }

    // Cargar cursos (con hoyos) referenciados por todas las vueltas.
    const courseIds = Array.from(new Set(rounds.flatMap(r => [r.course_id, r.second_course_id].filter(Boolean))))
    const { data: courses } = await supabase.from('courses').select('*, holes(*)').in('id', courseIds as string[])
    const courseById: Record<string, Course> = {}
    ;(courses || []).forEach((c: any) => { courseById[c.id] = c })

    const allRows: Row[] = []
    const groupList: { idx: number; roundId: string; names: string }[] = []
    for (let gi = 0; gi < rounds.length; gi++) {
      const rd = rounds[gi]
      const [{ data: ps }, { data: sc }] = await Promise.all([
        supabase.from('round_players').select('*').eq('round_id', rd.id).order('position'),
        supabase.from('scores').select('*').eq('round_id', rd.id),
      ])
      const holes = buildHoles(rd, courseById)
      const entries = buildLeaderboardEntries(rd.id, (ps || []) as RoundPlayer[], (sc || []) as Score[], holes, rd.hcp_pct ?? 100)
      entries.forEach(e => allRows.push({ ...e, groupIdx: gi }))
      groupList.push({ idx: gi, roundId: rd.id, names: ((ps || []) as RoundPlayer[]).map(p => p.name).join(', ') })
    }

    setRows(allRows)
    setGroups(groupList)
    setUpdatedAt(new Date())
    setLoading(false)
  }, [id])

  useEffect(() => { load() }, [load])
  // Refresco en línea cada 20s.
  useEffect(() => {
    const t = setInterval(() => { load() }, 20000)
    return () => clearInterval(t)
  }, [load])

  const sorted = (() => {
    const played = rows.filter(r => r.thru > 0)
    const empty = rows.filter(r => r.thru === 0)
    played.sort((a, b) => {
      if (tab === 'gross') {
        if (a.gross !== b.gross) return a.gross - b.gross
        return compareCountback(a.cbGross, b.cbGross)
      } else {
        if (a.net !== b.net) return a.net - b.net
        return compareCountback(a.cbNet, b.cbNet)
      }
    })
    empty.sort((a, b) => a.name.localeCompare(b.name))
    return [...played, ...empty]
  })()

  const fmtToPar = (n: number) => n === 0 ? 'E' : n > 0 ? `+${n}` : `${n}`
  const parColor = (n: number) => n < 0 ? '#1B4332' : n > 0 ? '#7A2E2E' : 'var(--text2)'

  if (loading) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)' }}>Cargando leaderboard…</div>
  )

  const r = refRound as any
  const title = (r?.grupal && r?.competition_name) ? r.competition_name : 'Leaderboard'

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <TopBar />
      <header style={{ background: 'linear-gradient(135deg, #E7EEF2 0%, #E9EFEA 100%)', borderBottom: '1px solid var(--border)', padding: '18px 16px 14px' }}>
        <div style={{ maxWidth: 800, margin: '0 auto' }}>
          <div style={{ fontSize: 10, color: 'var(--text3)', letterSpacing: 2 }}>COMPETENCIA</div>
          <h1 style={{ fontFamily: 'var(--display)', fontSize: 24, letterSpacing: 1, color: '#2B5F7A' }}>{title}</h1>
          <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>
            {r?.date ? new Date(r.date + 'T00:00:00').toLocaleDateString('es-CL', { day: 'numeric', month: 'long' }) : ''}
            {' · '}{groups.length} {groups.length === 1 ? 'grupo' : 'grupos'} · {rows.length} jugadores
            {updatedAt && <span style={{ marginLeft: 8, color: '#2F6B4F' }}>● en línea</span>}
          </div>
        </div>
      </header>

      {/* Tabs Gross / Neto */}
      <div style={{ borderBottom: '1px solid var(--border)', padding: '0 16px', display: 'flex', gap: 2 }}>
        {([['neto', 'Neto'], ['gross', 'Gross']] as const).map(([k, lbl]) => (
          <button key={k} onClick={() => setTab(k)} style={{
            padding: '10px 16px', background: 'transparent', border: 'none',
            borderBottom: `2px solid ${tab === k ? '#2B5F7A' : 'transparent'}`,
            color: tab === k ? '#2B5F7A' : 'var(--text3)',
            fontFamily: 'var(--body)', fontSize: 13, fontWeight: 500, cursor: 'pointer'
          }}>{lbl}</button>
        ))}
      </div>

      <main style={{ maxWidth: 800, margin: '0 auto', padding: '16px 12px' }}>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 460 }}>
              <thead>
                <tr style={{ background: 'var(--surface2)' }}>
                  {['Pos', 'Jugador', 'Grupo', 'Thru', tab === 'gross' ? 'Gross' : 'Neto', '+/-'].map(h => (
                    <th key={h} style={{ padding: '8px 10px', fontSize: 11, color: 'var(--text3)', textAlign: h === 'Jugador' ? 'left' : 'center', border: '1px solid var(--border)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorted.map((row, i) => {
                  const total = tab === 'gross' ? row.gross : row.net
                  const toPar = total - row.parPlayed
                  const gc = GROUP_COLORS[row.groupIdx % GROUP_COLORS.length]
                  const pos = row.thru === 0 ? '–' : (i + 1).toString()
                  return (
                    <tr key={row.playerId}>
                      <td style={{ padding: '10px 10px', border: '1px solid var(--border)', textAlign: 'center', fontFamily: 'var(--display)', fontSize: 17, color: i === 0 && row.thru > 0 ? '#B8935A' : 'var(--text3)' }}>{pos}</td>
                      <td style={{ padding: '10px 12px', border: '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 24, height: 24, borderRadius: '50%', background: gc, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#E9EFEA' }}>{row.name[0]?.toUpperCase()}</div>
                          <div>
                            <div style={{ fontWeight: 500 }}>{row.name}</div>
                            <div style={{ fontSize: 10, color: 'var(--text3)' }}>HCP {row.handicap}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '10px 10px', border: '1px solid var(--border)', textAlign: 'center' }}>
                        <Link href={`/round/${row.roundId}`} style={{ fontSize: 11, fontWeight: 700, color: gc, textDecoration: 'none' }}>G{row.groupIdx + 1}</Link>
                      </td>
                      <td style={{ padding: '10px 10px', border: '1px solid var(--border)', textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>{row.thru || '—'}</td>
                      <td style={{ padding: '10px 10px', border: '1px solid var(--border)', textAlign: 'center', fontWeight: 700, fontSize: 16, color: tab === 'neto' ? '#1B4332' : 'var(--text)' }}>{row.thru ? total : '—'}</td>
                      <td style={{ padding: '10px 10px', border: '1px solid var(--border)', textAlign: 'center', fontFamily: 'var(--display)', fontSize: 15, color: row.thru ? parColor(toPar) : 'var(--text3)' }}>{row.thru ? fmtToPar(toPar) : '—'}</td>
                    </tr>
                  )
                })}
                {sorted.length === 0 && (
                  <tr><td colSpan={6} style={{ padding: 20, textAlign: 'center', color: 'var(--text3)' }}>Sin jugadores aún.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Leyenda de grupos */}
        {groups.length > 1 && (
          <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {groups.map(g => (
              <div key={g.idx} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text3)' }}>
                <span style={{ fontWeight: 700, color: GROUP_COLORS[g.idx % GROUP_COLORS.length] }}>G{g.idx + 1}</span>
                <Link href={`/round/${g.roundId}`} style={{ color: 'var(--text2)', textDecoration: 'none' }}>{g.names}</Link>
              </div>
            ))}
          </div>
        )}

        <div style={{ marginTop: 12, fontSize: 11, color: 'var(--text3)', textAlign: 'center' }}>
          Desempates por count-back (últimos 9 / 6 / 3 / 1 hoyos). Se actualiza solo cada 20s.
        </div>
      </main>
    </div>
  )
}
