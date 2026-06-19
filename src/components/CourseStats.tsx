'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { getExtraStrokes } from '@/lib/golf'

type HoleAgg = { grossSum: number; grossN: number; netSum: number; netN: number }
const emptyAgg = (): HoleAgg => ({ grossSum: 0, grossN: 0, netSum: 0, netN: 0 })
const avg = (sum: number, n: number) => n > 0 ? sum / n : null
const fmt = (v: number | null) => v === null ? '—' : v.toLocaleString('es-CL', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

export default function CourseStats({ courseId }: { courseId: string }) {
  const [loading, setLoading] = useState(true)
  const [roundsCount, setRoundsCount] = useState(0)
  const [holesList, setHolesList] = useState<{ hole_number: number; par: number; handicap: number }[]>([])
  const [players, setPlayers] = useState<string[]>([])
  // perPlayer[name][holeNumber] y consolidated[holeNumber]
  const [perPlayer, setPerPlayer] = useState<Record<string, Record<number, HoleAgg>>>({})
  const [consolidated, setConsolidated] = useState<Record<number, HoleAgg>>({})

  useEffect(() => {
    async function load() {
      const { data: courseData } = await supabase.from('courses').select('holes_count, holes(*)').eq('id', courseId).single()
      const cHoles = [...(((courseData as any)?.holes) || [])].sort((a: any, b: any) => a.hole_number - b.hole_number)
      const holesCount = (courseData as any)?.holes_count || cHoles.length || 18
      const ventajaOf: Record<number, number> = {}
      const parOf: Record<number, number> = {}
      cHoles.forEach((h: any) => { ventajaOf[h.hole_number] = h.handicap; parOf[h.hole_number] = h.par })
      setHolesList(cHoles.map((h: any) => ({ hole_number: h.hole_number, par: h.par, handicap: h.handicap })))

      const { data: rounds } = await supabase
        .from('rounds')
        .select('id, round_players(id, name, handicap), scores(player_id, hole_number, strokes)')
        .eq('course_id', courseId)

      const pp: Record<string, Record<number, HoleAgg>> = {}
      const cons: Record<number, HoleAgg> = {}
      const names = new Set<string>()
      let nRounds = 0

      ;(rounds || []).forEach((rd: any) => {
        nRounds++
        const pmap: Record<string, { name: string; handicap: number }> = {}
        ;(rd.round_players || []).forEach((p: any) => { pmap[p.id] = { name: p.name, handicap: p.handicap } })
        ;(rd.scores || []).forEach((s: any) => {
          if (s.strokes == null) return
          if (!(s.hole_number in ventajaOf)) return // solo hoyos del propio campo
          const pl = pmap[s.player_id]
          if (!pl) return
          const gross = s.strokes
          const net = gross - getExtraStrokes(ventajaOf[s.hole_number], pl.handicap, holesCount, 100)
          names.add(pl.name)
          if (!pp[pl.name]) pp[pl.name] = {}
          if (!pp[pl.name][s.hole_number]) pp[pl.name][s.hole_number] = emptyAgg()
          if (!cons[s.hole_number]) cons[s.hole_number] = emptyAgg()
          const a = pp[pl.name][s.hole_number]
          a.grossSum += gross; a.grossN++; a.netSum += net; a.netN++
          const c = cons[s.hole_number]
          c.grossSum += gross; c.grossN++; c.netSum += net; c.netN++
        })
      })

      setRoundsCount(nRounds)
      setPerPlayer(pp)
      setConsolidated(cons)
      setPlayers(Array.from(names).sort((a, b) => a.localeCompare(b)))
      setLoading(false)
    }
    load()
  }, [courseId])

  if (loading) return <div style={{ padding: 20, color: 'var(--text3)', fontSize: 13 }}>Cargando histórico…</div>
  if (roundsCount === 0) return (
    <div style={{ textAlign: 'center', padding: '32px 20px', background: 'var(--surface)', border: '1px dashed var(--border)', borderRadius: 12, color: 'var(--text3)' }}>
      <div style={{ fontSize: 34, marginBottom: 10 }}>📊</div>
      <p style={{ fontSize: 14 }}>Aún no hay vueltas registradas en este campo.</p>
    </div>
  )

  const totalAgg = (m: Record<number, HoleAgg>) => {
    // promedio total ≈ suma de promedios por hoyo
    let g = 0, gOk = false, n = 0, nOk = false
    holesList.forEach(h => {
      const a = m[h.hole_number]
      if (a && a.grossN > 0) { g += a.grossSum / a.grossN; gOk = true }
      if (a && a.netN > 0) { n += a.netSum / a.netN; nOk = true }
    })
    return { gross: gOk ? g : null, net: nOk ? n : null }
  }

  const cellStyle: React.CSSProperties = { padding: '5px 6px', border: '1px solid var(--border)', textAlign: 'center', whiteSpace: 'nowrap' }
  const Cell = ({ a }: { a?: HoleAgg }) => (
    <td style={cellStyle}>
      <div style={{ fontFamily: 'var(--display)', fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{fmt(a ? avg(a.grossSum, a.grossN) : null)}</div>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#2dd4bf' }}>{fmt(a ? avg(a.netSum, a.netN) : null)}</div>
    </td>
  )

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10, gap: 8, flexWrap: 'wrap' }}>
        <h3 style={{ fontFamily: 'var(--display)', fontSize: 14, letterSpacing: 2, color: 'var(--text2)' }}>HISTÓRICO POR HOYO</h3>
        <span style={{ fontSize: 12, color: 'var(--text3)' }}>{roundsCount} {roundsCount === 1 ? 'vuelta' : 'vueltas'} · promedio gross / <span style={{ color: '#2dd4bf' }}>neto</span></span>
      </div>
      <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 10 }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 'max-content' }}>
          <thead>
            <tr style={{ background: 'var(--surface2)' }}>
              <th style={{ ...cellStyle, position: 'sticky', left: 0, background: 'var(--surface2)', zIndex: 1 }}>
                <div style={{ fontSize: 10, color: 'var(--text3)', letterSpacing: 1 }}>HOYO</div>
                <div style={{ fontSize: 9, color: 'var(--text3)' }}>par·v</div>
              </th>
              <th style={{ ...cellStyle, color: '#fbbf24' }}><div style={{ fontSize: 10, letterSpacing: 1 }}>TODOS</div><div style={{ fontSize: 9, color: 'var(--text3)' }}>g/n</div></th>
              {players.map(name => (
                <th key={name} style={{ ...cellStyle, maxWidth: 90 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text2)', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 80 }}>{name}</div>
                  <div style={{ fontSize: 9, color: 'var(--text3)' }}>g/n</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {holesList.map(h => (
              <tr key={h.hole_number}>
                <td style={{ ...cellStyle, position: 'sticky', left: 0, background: 'var(--surface)', zIndex: 1 }}>
                  <div style={{ fontFamily: 'var(--display)', fontSize: 14, fontWeight: 700, color: 'var(--text2)' }}>{h.hole_number}</div>
                  <div style={{ fontSize: 10, color: 'var(--text3)' }}>P{h.par}·V{h.handicap}</div>
                </td>
                <td style={{ ...cellStyle, background: 'rgba(251,191,36,0.05)' }}>
                  <div style={{ fontFamily: 'var(--display)', fontSize: 13, fontWeight: 700, color: '#fbbf24' }}>{fmt(consolidated[h.hole_number] ? avg(consolidated[h.hole_number].grossSum, consolidated[h.hole_number].grossN) : null)}</div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#2dd4bf' }}>{fmt(consolidated[h.hole_number] ? avg(consolidated[h.hole_number].netSum, consolidated[h.hole_number].netN) : null)}</div>
                </td>
                {players.map(name => <Cell key={name} a={perPlayer[name]?.[h.hole_number]} />)}
              </tr>
            ))}
            <tr style={{ background: 'var(--surface2)' }}>
              <td style={{ ...cellStyle, position: 'sticky', left: 0, background: 'var(--surface2)', zIndex: 1, fontSize: 11, fontWeight: 700, color: 'var(--text3)', letterSpacing: 1 }}>TOTAL</td>
              {(() => { const t = totalAgg(consolidated); return (
                <td style={{ ...cellStyle, background: 'rgba(251,191,36,0.08)' }}>
                  <div style={{ fontFamily: 'var(--display)', fontSize: 13, fontWeight: 700, color: '#fbbf24' }}>{fmt(t.gross)}</div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#2dd4bf' }}>{fmt(t.net)}</div>
                </td>
              ) })()}
              {players.map(name => { const t = totalAgg(perPlayer[name] || {}); return (
                <td key={name} style={cellStyle}>
                  <div style={{ fontFamily: 'var(--display)', fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{fmt(t.gross)}</div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#2dd4bf' }}>{fmt(t.net)}</div>
                </td>
              ) })}
            </tr>
          </tbody>
        </table>
      </div>
      <p style={{ fontSize: 11, color: 'var(--text3)', marginTop: 8, lineHeight: 1.5 }}>
        Promedio del score en cada hoyo entre todas las vueltas jugadas en este campo. Arriba el <strong style={{ color: 'var(--text2)' }}>gross</strong>, abajo el <strong style={{ color: '#2dd4bf' }}>neto</strong> (gross menos los palos por ventaja, al 100%). «TODOS» es el consolidado de todos los jugadores; «TOTAL» suma los promedios de los 18 hoyos.
      </p>
    </div>
  )
}
