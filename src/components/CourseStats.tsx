'use client'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { getExtraStrokes } from '@/lib/golf'

type Rec = { hole: number; par: number; ventaja: number; hcp: number; gross: number; net: number; isDay: boolean }
type Range = 'all' | 'A' | 'B' | 'C' | 'D'
const RANGES: { key: Range; label: string; test: (h: number) => boolean }[] = [
  { key: 'all', label: 'Todos', test: () => true },
  { key: 'A', label: 'A 0‑9', test: h => h <= 9 },
  { key: 'B', label: 'B 10‑18', test: h => h >= 10 && h <= 18 },
  { key: 'C', label: 'C 19‑27', test: h => h >= 19 && h <= 27 },
  { key: 'D', label: 'D 28+', test: h => h >= 28 },
]
const dec = (v: number | null, d = 1) => v === null || Number.isNaN(v) ? '—' : (Math.round(v * 10 ** d) / 10 ** d).toLocaleString('es-CL', { minimumFractionDigits: d, maximumFractionDigits: d })
const fmtDev = (v: number | null) => v === null ? '—' : ((v > 0 ? '+' : v < 0 ? '−' : '') + dec(Math.abs(v)))
const devColor = (v: number | null) => v === null ? 'var(--text3)' : v > 0.05 ? '#f87171' : v < -0.05 ? '#34d399' : 'var(--text2)'
const deltaColor = (d: number) => Math.abs(d) <= 2 ? '#34d399' : Math.abs(d) <= 5 ? '#fbbf24' : '#f87171'

export default function CourseStats({ courseId, currentRoundId }: { courseId: string; currentRoundId?: string }) {
  const [loading, setLoading] = useState(true)
  const [roundsCount, setRoundsCount] = useState(0)
  const [recs, setRecs] = useState<Rec[]>([])
  const [holesMeta, setHolesMeta] = useState<{ hole: number; par: number; ventaja: number }[]>([])
  const [holesCount, setHolesCount] = useState(18)
  const [range, setRange] = useState<Range>('all')
  const hasDay = !!currentRoundId

  useEffect(() => {
    async function load() {
      const { data: cd } = await supabase.from('courses').select('holes_count, holes(*)').eq('id', courseId).single()
      const cHoles = [...(((cd as any)?.holes) || [])].sort((a: any, b: any) => a.hole_number - b.hole_number)
      const hc = (cd as any)?.holes_count || cHoles.length || 18
      const vent: Record<number, number> = {}, par: Record<number, number> = {}
      cHoles.forEach((h: any) => { vent[h.hole_number] = h.handicap; par[h.hole_number] = h.par })
      const { data: rounds } = await supabase.from('rounds')
        .select('id, round_players(id, handicap), scores(player_id, hole_number, strokes)').eq('course_id', courseId)
      const out: Rec[] = []; let n = 0
      ;(rounds || []).forEach((rd: any) => {
        n++; const isDay = rd.id === currentRoundId
        const pm: Record<string, number> = {}
        ;(rd.round_players || []).forEach((p: any) => { pm[p.id] = p.handicap })
        ;(rd.scores || []).forEach((s: any) => {
          if (s.strokes == null || !(s.hole_number in vent)) return
          const hcp = pm[s.player_id]; if (hcp == null) return
          out.push({ hole: s.hole_number, par: par[s.hole_number], ventaja: vent[s.hole_number], hcp, gross: s.strokes, net: s.strokes - getExtraStrokes(vent[s.hole_number], hcp, hc, 100), isDay })
        })
      })
      setRoundsCount(n); setRecs(out); setHolesCount(hc)
      setHolesMeta(cHoles.map((h: any) => ({ hole: h.hole_number, par: h.par, ventaja: h.handicap })))
      setLoading(false)
    }
    load()
  }, [courseId, currentRoundId])

  const stats = useMemo(() => {
    const inRange = RANGES.find(r => r.key === range)!.test
    const agg = (pred: (r: Rec) => boolean, key: 'gross' | 'net') => {
      const m: Record<number, { s: number; n: number }> = {}
      recs.forEach(r => { if (!pred(r)) return; (m[r.hole] ||= { s: 0, n: 0 }); m[r.hole].s += r[key]; m[r.hole].n++ })
      const avg: Record<number, number> = {}
      Object.entries(m).forEach(([h, v]) => { avg[+h] = v.s / v.n })
      return avg
    }
    const histG = agg(r => inRange(r.hcp), 'gross')
    const histN = agg(r => inRange(r.hcp), 'net')
    const dayG = agg(r => inRange(r.hcp) && r.isDay, 'gross')
    const dayN = agg(r => inRange(r.hcp) && r.isDay, 'net')

    // dificultad real (gross sobre par), ranking global 1..N (1 = más difícil)
    const devG: Record<number, number> = {}
    holesMeta.forEach(h => { if (histG[h.hole] != null) devG[h.hole] = histG[h.hole] - h.par })
    const realRank: Record<number, number> = {}
    Object.keys(devG).map(Number).sort((a, b) => devG[b] - devG[a]).forEach((h, i) => { realRank[h] = i + 1 })

    // ventaja sugerida
    const sug: Record<number, number> = {}
    const withData = (hs: number[]) => hs.filter(h => devG[h] != null).sort((a, b) => devG[b] - devG[a])
    if (holesCount <= 9) {
      withData(holesMeta.map(h => h.hole)).forEach((h, i) => { sug[h] = i + 1 })
    } else {
      withData(holesMeta.filter(h => h.hole <= 9).map(h => h.hole)).forEach((h, i) => { sug[h] = 2 * i + 1 }) // impares 1ª vuelta
      withData(holesMeta.filter(h => h.hole >= 10).map(h => h.hole)).forEach((h, i) => { sug[h] = 2 * i + 2 }) // pares 2ª vuelta
    }

    // discriminación: gross alto(HCP>12) − bajo(HCP<=12), sobre TODOS los datos (independiente del selector)
    const disc: Record<number, number | null> = {}
    holesMeta.forEach(h => {
      const lo = recs.filter(r => r.hole === h.hole && r.hcp <= 12), hi = recs.filter(r => r.hole === h.hole && r.hcp > 12)
      disc[h.hole] = lo.length && hi.length ? (hi.reduce((s, r) => s + r.gross, 0) / hi.length) - (lo.reduce((s, r) => s + r.gross, 0) / lo.length) : null
    })

    const deltas = holesMeta.filter(h => sug[h.hole]).map(h => h.ventaja - sug[h.hole])
    const bien = deltas.filter(d => Math.abs(d) <= 2).length
    const revisar = deltas.filter(d => Math.abs(d) > 2 && Math.abs(d) <= 5).length
    const mal = deltas.filter(d => Math.abs(d) > 5).length
    return { histG, histN, dayG, dayN, devG, realRank, sug, disc, bien, revisar, mal }
  }, [recs, holesMeta, holesCount, range])

  if (loading) return <div style={{ padding: 20, color: 'var(--text3)', fontSize: 13 }}>Cargando…</div>
  if (roundsCount === 0) return (
    <div style={{ textAlign: 'center', padding: '32px 20px', background: 'var(--surface)', border: '1px dashed var(--border)', borderRadius: 12, color: 'var(--text3)' }}>
      <div style={{ fontSize: 34, marginBottom: 10 }}>📊</div><p style={{ fontSize: 14 }}>Aún no hay vueltas en este campo.</p>
    </div>
  )

  const th: React.CSSProperties = { padding: '6px 5px', border: '1px solid var(--border)', textAlign: 'center', fontSize: 10, color: 'var(--text3)', background: 'var(--surface2)', lineHeight: 1.25 }
  const td: React.CSSProperties = { padding: '5px 5px', border: '1px solid var(--border)', textAlign: 'center', whiteSpace: 'nowrap' }
  const devCellVal = (day: number | undefined, hist: number | undefined, par: number) => (
    <td style={td}>
      {hasDay && <div style={{ fontSize: 12, fontWeight: 700, color: devColor(day != null ? day - par : null) }}>{fmtDev(day != null ? day - par : null)}</div>}
      <div style={{ fontSize: hasDay ? 11 : 13, fontWeight: 700, color: devColor(hist != null ? hist - par : null), opacity: hasDay ? 0.85 : 1 }}>{fmtDev(hist != null ? hist - par : null)}</div>
    </td>
  )

  // Charts geometry
  const N = holesMeta.length
  const scW = 300, scH = 240, pad = 28
  const sx = (v: number) => pad + (v - 1) / (N - 1 || 1) * (scW - 2 * pad)
  const sy = (v: number) => scH - pad - (v - 1) / (N - 1 || 1) * (scH - 2 * pad)
  const discArr = holesMeta.map(h => ({ hole: h.hole, v: stats.disc[h.hole] })).filter(x => x.v != null).sort((a, b) => (b.v! - a.v!))
  const maxDisc = Math.max(0.1, ...discArr.map(x => Math.abs(x.v!)))

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8, gap: 8, flexWrap: 'wrap' }}>
        <h3 style={{ fontFamily: 'var(--display)', fontSize: 14, letterSpacing: 2, color: 'var(--text2)' }}>VENTAJA vs DIFICULTAD REAL</h3>
        <span style={{ fontSize: 12, color: 'var(--text3)' }}>{roundsCount} {roundsCount === 1 ? 'vuelta' : 'vueltas'} · 100% HDCP</span>
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
        {RANGES.map(r => (
          <button key={r.key} onClick={() => setRange(r.key)} style={{
            padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer',
            border: `1px solid ${range === r.key ? '#2dd4bf' : 'var(--border)'}`,
            background: range === r.key ? '#2dd4bf' : 'transparent', color: range === r.key ? '#071209' : 'var(--text3)'
          }}>{r.label}</button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        {[['bien', stats.bien, '#34d399', 'bien (Δ≤2)'], ['revisar', stats.revisar, '#fbbf24', 'revisar (3‑5)'], ['mal', stats.mal, '#f87171', 'mal (Δ>5)']].map(([k, val, col, lbl]) => (
          <div key={k as string} style={{ flex: 1, minWidth: 90, textAlign: 'center', background: `${col}14`, border: `1px solid ${col}33`, borderRadius: 10, padding: '8px 6px' }}>
            <div style={{ fontFamily: 'var(--display)', fontSize: 22, fontWeight: 700, color: col as string }}>{val as number}</div>
            <div style={{ fontSize: 10, color: 'var(--text3)' }}>{lbl as string}</div>
          </div>
        ))}
      </div>

      <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 10 }}>
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead><tr>
            <th style={{ ...th, position: 'sticky', left: 0, zIndex: 1 }}>HOYO<br /><span style={{ fontSize: 9 }}>par</span></th>
            <th style={{ ...th, color: '#fbbf24' }}>VENT.<br /><span style={{ fontSize: 9 }}>actual</span></th>
            <th style={{ ...th, color: '#2dd4bf' }}>SUG.<br /><span style={{ fontSize: 9 }}>impar/par</span></th>
            <th style={th}>DIF.REAL<br /><span style={{ fontSize: 9 }}>1‑{N}</span></th>
            <th style={th}>GROSS<br /><span style={{ fontSize: 9 }}>vs par</span></th>
            <th style={th}>NETO<br /><span style={{ fontSize: 9 }}>vs par</span></th>
          </tr></thead>
          <tbody>
            {holesMeta.map(h => {
              const sug = stats.sug[h.hole]; const delta = sug ? h.ventaja - sug : null
              return (
                <tr key={h.hole}>
                  <td style={{ ...td, position: 'sticky', left: 0, background: 'var(--surface)', zIndex: 1 }}>
                    <div style={{ fontFamily: 'var(--display)', fontSize: 14, fontWeight: 700, color: 'var(--text2)' }}>{h.hole}</div>
                    <div style={{ fontSize: 10, color: 'var(--text3)' }}>P{h.par}</div>
                  </td>
                  <td style={{ ...td, background: 'rgba(251,191,36,0.05)' }}><div style={{ fontFamily: 'var(--display)', fontSize: 16, fontWeight: 700, color: '#fbbf24' }}>{h.ventaja}</div></td>
                  <td style={td}>
                    <div style={{ fontFamily: 'var(--display)', fontSize: 16, fontWeight: 700, color: '#2dd4bf' }}>{sug || '—'}</div>
                    {delta !== null && <div style={{ fontSize: 10, fontWeight: 700, color: deltaColor(delta) }}>Δ{delta > 0 ? '+' : delta < 0 ? '−' : ''}{Math.abs(delta)}</div>}
                  </td>
                  <td style={td}><div style={{ fontFamily: 'var(--display)', fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{stats.realRank[h.hole] || '—'}</div></td>
                  {devCellVal(stats.dayG[h.hole], stats.histG[h.hole], h.par)}
                  {devCellVal(stats.dayN[h.hole], stats.histN[h.hole], h.par)}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p style={{ fontSize: 11, color: 'var(--text3)', marginTop: 8, lineHeight: 1.6 }}>
        <strong style={{ color: '#fbbf24' }}>VENT.</strong> actual de la cancha. <strong style={{ color: '#2dd4bf' }}>SUG.</strong> = ventaja sugerida por dificultad gross respetando la regla (impares 1ª vuelta, pares 2ª); <strong>Δ</strong> compara con la actual (<span style={{ color: '#34d399' }}>verde</span> ok, <span style={{ color: '#fbbf24' }}>amarillo</span> revisar, <span style={{ color: '#f87171' }}>rojo</span> mal). <strong>DIF.REAL</strong> = ranking de dificultad sobre los {N} hoyos (1 = más difícil, sin importar la vuelta). Todo recalcula según el rango de HDCP elegido; neto a 100%.
      </p>

      {/* Gráfico 1: dispersión SI actual vs dificultad real */}
      <h4 style={{ fontFamily: 'var(--display)', fontSize: 13, letterSpacing: 1, color: 'var(--text2)', marginTop: 22, marginBottom: 8 }}>STROKE INDEX vs DIFICULTAD REAL</h4>
      <div style={{ overflowX: 'auto' }}>
        <svg width={scW} height={scH} style={{ minWidth: scW, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10 }}>
          <line x1={pad} y1={scH - pad} x2={scW - pad} y2={pad} stroke="var(--border2)" strokeDasharray="4 4" />
          <line x1={pad} y1={pad} x2={pad} y2={scH - pad} stroke="var(--border)" />
          <line x1={pad} y1={scH - pad} x2={scW - pad} y2={scH - pad} stroke="var(--border)" />
          <text x={scW / 2} y={scH - 4} fill="var(--text3)" fontSize="9" textAnchor="middle">Stroke Index actual</text>
          <text x={8} y={pad - 8} fill="var(--text3)" fontSize="9">Dif. real</text>
          {holesMeta.map(h => {
            const rr = stats.realRank[h.hole]; if (!rr) return null
            const off = Math.abs(h.ventaja - (stats.sug[h.hole] || rr))
            return (
              <g key={h.hole}>
                <circle cx={sx(h.ventaja)} cy={sy(rr)} r={4} fill={off <= 2 ? '#34d399' : off <= 5 ? '#fbbf24' : '#f87171'} />
                <text x={sx(h.ventaja) + 6} y={sy(rr) + 3} fill="var(--text3)" fontSize="8">{h.hole}</text>
              </g>
            )
          })}
        </svg>
      </div>
      <p style={{ fontSize: 11, color: 'var(--text3)', marginTop: 6 }}>Cada punto es un hoyo. Sobre la diagonal = ventaja bien asignada; lejos = mal clasificado.</p>

      {/* Gráfico 2: discriminación por hoyo */}
      <h4 style={{ fontFamily: 'var(--display)', fontSize: 13, letterSpacing: 1, color: 'var(--text2)', marginTop: 22, marginBottom: 8 }}>DISCRIMINACIÓN POR HOYO</h4>
      {discArr.length === 0 ? (
        <p style={{ fontSize: 12, color: 'var(--text3)' }}>Faltan datos de jugadores de HCP bajo y alto para calcularla.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {discArr.map(x => (
            <div key={x.hole} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 34, fontSize: 11, color: 'var(--text3)', textAlign: 'right' }}>H{x.hole}</span>
              <div style={{ flex: 1, height: 14, background: 'var(--surface2)', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ width: `${Math.max(2, Math.abs(x.v!) / maxDisc * 100)}%`, height: '100%', background: x.v! >= 0 ? '#2dd4bf' : '#f87171', borderRadius: 4 }} />
              </div>
              <span style={{ width: 38, fontSize: 11, fontWeight: 700, color: 'var(--text2)' }}>{fmtDev(x.v!)}</span>
            </div>
          ))}
        </div>
      )}
      <p style={{ fontSize: 11, color: 'var(--text3)', marginTop: 8, lineHeight: 1.6 }}>
        Diferencia de gross promedio entre HCP altos (&gt;12) y bajos (≤12). Más alto = el hoyo separa más a buenos de menos buenos, lo que justifica una ventaja baja. Se calcula con todos los jugadores, sin importar el selector.
      </p>
    </div>
  )
}
