'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { getExtraStrokes } from '@/lib/golf'

type Acc = { sum: number; n: number }
const add = (a: Acc, v: number) => { a.sum += v; a.n++ }
const mean = (a: Acc) => a.n > 0 ? a.sum / a.n : null
const dec = (v: number | null) => v === null ? '—' : (Math.round(v * 10) / 10).toLocaleString('es-CL', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
const fmtDev = (v: number | null) => {
  if (v === null) return '—'
  const r = Math.round(v * 10) / 10
  return (r > 0 ? '+' : r < 0 ? '−' : '') + Math.abs(r).toLocaleString('es-CL', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
}
const devColor = (v: number | null) => v === null ? 'var(--text3)' : v > 0.05 ? '#f87171' : v < -0.05 ? '#34d399' : 'var(--text2)'
// Veredicto por desajuste |Δ| entre ventaja y dificultad real
const deltaColor = (d: number) => Math.abs(d) <= 2 ? '#34d399' : Math.abs(d) <= 5 ? '#fbbf24' : '#f87171'

type Row = {
  hole: number; par: number; ventaja: number;
  dayGross: Acc; dayNet: Acc; histGross: Acc; histNet: Acc;
}

export default function CourseStats({ courseId, currentRoundId }: { courseId: string; currentRoundId?: string }) {
  const [loading, setLoading] = useState(true)
  const [roundsCount, setRoundsCount] = useState(0)
  const [rows, setRows] = useState<Row[]>([])
  const hasDay = !!currentRoundId

  useEffect(() => {
    async function load() {
      const { data: courseData } = await supabase.from('courses').select('holes_count, holes(*)').eq('id', courseId).single()
      const cHoles = [...(((courseData as any)?.holes) || [])].sort((a: any, b: any) => a.hole_number - b.hole_number)
      const holesCount = (courseData as any)?.holes_count || cHoles.length || 18
      const map: Record<number, Row> = {}
      cHoles.forEach((h: any) => {
        map[h.hole_number] = { hole: h.hole_number, par: h.par, ventaja: h.handicap, dayGross: { sum: 0, n: 0 }, dayNet: { sum: 0, n: 0 }, histGross: { sum: 0, n: 0 }, histNet: { sum: 0, n: 0 } }
      })

      const { data: rounds } = await supabase.from('rounds')
        .select('id, round_players(id, name, handicap), scores(player_id, hole_number, strokes)')
        .eq('course_id', courseId)

      let nRounds = 0
      ;(rounds || []).forEach((rd: any) => {
        nRounds++
        const isDay = rd.id === currentRoundId
        const pmap: Record<string, number> = {}
        ;(rd.round_players || []).forEach((p: any) => { pmap[p.id] = p.handicap })
        ;(rd.scores || []).forEach((s: any) => {
          if (s.strokes == null) return
          const row = map[s.hole_number]
          if (!row) return
          const hcp = pmap[s.player_id]
          if (hcp == null) return
          const gross = s.strokes
          const net = gross - getExtraStrokes(row.ventaja, hcp, holesCount, 100) // siempre 100% HDCP
          add(row.histGross, gross); add(row.histNet, net)
          if (isDay) { add(row.dayGross, gross); add(row.dayNet, net) }
        })
      })
      setRoundsCount(nRounds)
      setRows(cHoles.map((h: any) => map[h.hole_number]))
      setLoading(false)
    }
    load()
  }, [courseId, currentRoundId])

  if (loading) return <div style={{ padding: 20, color: 'var(--text3)', fontSize: 13 }}>Cargando…</div>
  if (roundsCount === 0) return (
    <div style={{ textAlign: 'center', padding: '32px 20px', background: 'var(--surface)', border: '1px dashed var(--border)', borderRadius: 12, color: 'var(--text3)' }}>
      <div style={{ fontSize: 34, marginBottom: 10 }}>📊</div>
      <p style={{ fontSize: 14 }}>Aún no hay vueltas registradas en este campo.</p>
    </div>
  )

  // Ranking de dificultad real (1 = más difícil) por desviación histórica vs par
  const rankBy = (get: (r: Row) => Acc) => {
    const arr = rows.map(r => ({ hole: r.hole, dev: mean(get(r)) !== null ? mean(get(r))! - r.par : null })).filter(x => x.dev !== null)
    arr.sort((a, b) => b.dev! - a.dev!)
    const rk: Record<number, number> = {}
    arr.forEach((x, i) => { rk[x.hole] = i + 1 })
    return rk
  }
  const grossRank = rankBy(r => r.histGross)
  const netRank = rankBy(r => r.histNet)

  // Resumen de ajuste de la ventaja (gross)
  const deltas = rows.filter(r => grossRank[r.hole]).map(r => r.ventaja - grossRank[r.hole])
  const bien = deltas.filter(d => Math.abs(d) <= 2).length
  const revisar = deltas.filter(d => Math.abs(d) > 2 && Math.abs(d) <= 5).length
  const mal = deltas.filter(d => Math.abs(d) > 5).length
  const meanAbs = deltas.length ? deltas.reduce((s, d) => s + Math.abs(d), 0) / deltas.length : null

  const th: React.CSSProperties = { padding: '6px 6px', border: '1px solid var(--border)', textAlign: 'center', fontSize: 10, color: 'var(--text3)', letterSpacing: 0.5, background: 'var(--surface2)', lineHeight: 1.3 }
  const td: React.CSSProperties = { padding: '5px 6px', border: '1px solid var(--border)', textAlign: 'center', whiteSpace: 'nowrap' }
  const devCell = (day: Acc, hist: Acc, par: number) => {
    const d = mean(day), h = mean(hist)
    return (
      <td style={td}>
        {hasDay && <div style={{ fontSize: 12, fontWeight: 700, color: devColor(d !== null ? d - par : null) }}>{fmtDev(d !== null ? d - par : null)}</div>}
        <div style={{ fontSize: hasDay ? 11 : 13, fontWeight: 700, color: devColor(h !== null ? h - par : null), opacity: hasDay ? 0.85 : 1 }}>{fmtDev(h !== null ? h - par : null)}</div>
      </td>
    )
  }
  const rankCell = (hole: number, ventaja: number, rk: Record<number, number>) => {
    const rr = rk[hole]
    const delta = rr ? ventaja - rr : null
    return (
      <td style={td}>
        <div style={{ fontFamily: 'var(--display)', fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{rr || '—'}</div>
        {delta !== null && <div style={{ fontSize: 10, fontWeight: 700, color: deltaColor(delta) }}>Δ{delta > 0 ? '+' : delta < 0 ? '−' : ''}{Math.abs(delta)}</div>}
      </td>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10, gap: 8, flexWrap: 'wrap' }}>
        <h3 style={{ fontFamily: 'var(--display)', fontSize: 14, letterSpacing: 2, color: 'var(--text2)' }}>VENTAJA vs DIFICULTAD REAL</h3>
        <span style={{ fontSize: 12, color: 'var(--text3)' }}>{roundsCount} {roundsCount === 1 ? 'vuelta' : 'vueltas'} · 100% HDCP</span>
      </div>

      {/* Resumen del ajuste de ventajas (gross) */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 80, textAlign: 'center', background: 'rgba(52,211,153,0.08)', border: '1px solid #34d39933', borderRadius: 10, padding: '8px 6px' }}>
          <div style={{ fontFamily: 'var(--display)', fontSize: 22, fontWeight: 700, color: '#34d399' }}>{bien}</div>
          <div style={{ fontSize: 10, color: 'var(--text3)' }}>bien (Δ≤2)</div>
        </div>
        <div style={{ flex: 1, minWidth: 80, textAlign: 'center', background: 'rgba(251,191,36,0.08)', border: '1px solid #fbbf2433', borderRadius: 10, padding: '8px 6px' }}>
          <div style={{ fontFamily: 'var(--display)', fontSize: 22, fontWeight: 700, color: '#fbbf24' }}>{revisar}</div>
          <div style={{ fontSize: 10, color: 'var(--text3)' }}>revisar (3‑5)</div>
        </div>
        <div style={{ flex: 1, minWidth: 80, textAlign: 'center', background: 'rgba(248,113,113,0.08)', border: '1px solid #f8717133', borderRadius: 10, padding: '8px 6px' }}>
          <div style={{ fontFamily: 'var(--display)', fontSize: 22, fontWeight: 700, color: '#f87171' }}>{mal}</div>
          <div style={{ fontSize: 10, color: 'var(--text3)' }}>mal (Δ&gt;5)</div>
        </div>
        <div style={{ flex: 1, minWidth: 80, textAlign: 'center', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '8px 6px' }}>
          <div style={{ fontFamily: 'var(--display)', fontSize: 22, fontWeight: 700, color: 'var(--text2)' }}>{dec(meanAbs)}</div>
          <div style={{ fontSize: 10, color: 'var(--text3)' }}>desajuste prom.</div>
        </div>
      </div>

      <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 10 }}>
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead>
            <tr>
              <th style={{ ...th, position: 'sticky', left: 0, zIndex: 1 }}>HOYO<br /><span style={{ fontSize: 9 }}>par</span></th>
              <th style={{ ...th, color: '#fbbf24' }}>VENT.<br /><span style={{ fontSize: 9 }}>teórica</span></th>
              <th style={th}>GROSS<br /><span style={{ fontSize: 9 }}>vs par</span></th>
              <th style={th}>DIF.GROSS<br /><span style={{ fontSize: 9 }}>rank·Δ</span></th>
              <th style={th}>NETO<br /><span style={{ fontSize: 9 }}>vs par</span></th>
              <th style={th}>DIF.NETO<br /><span style={{ fontSize: 9 }}>rank·Δ</span></th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.hole}>
                <td style={{ ...td, position: 'sticky', left: 0, background: 'var(--surface)', zIndex: 1 }}>
                  <div style={{ fontFamily: 'var(--display)', fontSize: 14, fontWeight: 700, color: 'var(--text2)' }}>{r.hole}</div>
                  <div style={{ fontSize: 10, color: 'var(--text3)' }}>P{r.par}</div>
                </td>
                <td style={{ ...td, background: 'rgba(251,191,36,0.05)' }}>
                  <div style={{ fontFamily: 'var(--display)', fontSize: 16, fontWeight: 700, color: '#fbbf24' }}>{r.ventaja}</div>
                </td>
                {devCell(r.dayGross, r.histGross, r.par)}
                {rankCell(r.hole, r.ventaja, grossRank)}
                {devCell(r.dayNet, r.histNet, r.par)}
                {rankCell(r.hole, r.ventaja, netRank)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p style={{ fontSize: 11, color: 'var(--text3)', marginTop: 8, lineHeight: 1.6 }}>
        <strong style={{ color: '#fbbf24' }}>VENT.</strong> = stroke index actual (1 = más difícil). <strong style={{ color: 'var(--text2)' }}>vs par</strong>: desviación promedio del score{hasDay ? ' (arriba hoy, abajo histórico)' : ' histórico'} — rojo sobre par, verde bajo par. <strong>DIF.</strong> = ranking de dificultad real (gross/neto) y <strong>Δ</strong> su diferencia con la ventaja: <span style={{ color: '#34d399' }}>verde</span> bien asignada, <span style={{ color: '#fbbf24' }}>amarillo</span> a revisar, <span style={{ color: '#f87171' }}>rojo</span> mal asignada. El neto se calcula a 100% de HDCP. El ranking «DIF.GROSS» equivale al stroke index que tendría el hoyo si se asignara por dificultad real.
      </p>
    </div>
  )
}
