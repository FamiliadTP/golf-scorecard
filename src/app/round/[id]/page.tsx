'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase, Round, RoundPlayer, Score, Hole, Course } from '@/lib/supabase'
import TopBar from '@/components/TopBar'
import CourseStats from '@/components/CourseStats'
import {
  calcStroke, calcMatchPlay, calcMatchPlayDobles, calcBismarck,
  calcCombinado4, calcCombinadoBismarck, calcMejorPeorSuma, calcGrupalSide, getExtraStrokes, getRelativeExtra,
  correctCombinedHandicaps, buildLoopRoundHoles
} from '@/lib/golf'

const PLAYER_COLORS = ['#1B4332', '#B8935A', '#6B5B95', '#7A2E2E']
const PLAYER_BG = ['#3D7A5C', '#B8703C', '#6B5B95', '#7A2E2E']

const MODE_LABELS: Record<string, string> = {
  stroke: 'Stroke Play', matchplay_individual: 'Match Play',
  matchplay_dobles: 'Dobles', bismarck: 'Bismarck',
  combinado_4: 'Ryder', combinado_bismarck: 'Bismarck + Individuales',
  mejor_peor_suma: 'Mejor, Peor y Suma', stroke_grupal: 'Stroke Play Grupal'
}

// Modes that use handicap (show Score Neto tab)
const MODES_WITH_HCP = ['stroke', 'matchplay_individual', 'matchplay_dobles', 'bismarck', 'combinado_4', 'combinado_bismarck', 'stroke_grupal']

// extra: palos de ventaja recibidos en ese hoyo (opcional). Cuando > 0 se muestra
// un círculo superpuesto con el número de palos, sin alterar el score mostrado
// (el ajuste real solo ocurre en la vista Neto).
function ScoreBadge({ strokes, par, extra }: { strokes: number | null; par: number; extra?: number }) {
  if (!strokes) {
    return (
      <span style={{ position: 'relative', display: 'inline-flex', width: 26, height: 26, alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: 'var(--text3)', fontSize: 13 }}>—</span>
        {!!extra && extra > 0 && (
          <span style={{ position: 'absolute', top: -5, right: -5, width: 10, height: 10, background: '#1B4332', borderRadius: '50%', fontSize: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#F1EEE4', fontWeight: 900, zIndex: 3 }}>{extra}</span>
        )}
      </span>
    )
  }
  const d = strokes - par
  const isAce = strokes === 1

  type K = 'ace' | 'eagle' | 'birdie' | 'par' | 'bogey' | 'doble' | 'peor'
  const styles: Record<K, React.CSSProperties> = {
    ace: { background: '#C9A227', color: '#F6ECDA', borderRadius: '50%', border: 'none' },
    eagle: { background: '#F5D54A', color: '#5C4300', borderRadius: '50%', border: 'none' },
    birdie: { background: '#1B4332', color: '#F1EEE4', borderRadius: 4, border: 'none' },
    par: { background: '#FFFFFF', color: 'var(--text)', border: '1px solid var(--border2)', borderRadius: 4 },
    bogey: { background: 'rgba(122,46,46,0.1)', color: '#7A2E2E', border: '1px solid rgba(122,46,46,0.18)', borderRadius: 4 },
    doble: { background: 'rgba(122,46,46,0.18)', color: '#9C4A44', border: '1px solid #7A2E2E', borderRadius: 4 },
    peor: { background: '#F3E2E0', color: '#7A2E2E', border: '1px solid #7A2E2E', borderRadius: 4 },
  }
  const k: K = isAce ? 'ace' : d <= -2 ? 'eagle' : d === -1 ? 'birdie' : d === 0 ? 'par' : d === 1 ? 'bogey' : d === 2 ? 'doble' : 'peor'
  const doublePerimeter = k === 'peor' // +3 o peor sobre par, cualquiera sea la magnitud

  return (
    <span style={{ position: 'relative', display: 'inline-flex', width: 26, height: 26 }}>
      {doublePerimeter && (
        <span style={{ position: 'absolute', inset: -4, border: '1.5px solid #7A2E2E', borderRadius: 6, pointerEvents: 'none' }} />
      )}
      <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, fontSize: 12, fontWeight: 700, boxSizing: 'border-box', ...styles[k] }}>
        {strokes}
      </span>
      {!!extra && extra > 0 && (
        <span style={{ position: 'absolute', top: -5, right: -5, width: 10, height: 10, background: '#1B4332', borderRadius: '50%', fontSize: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#F1EEE4', fontWeight: 900, zIndex: 3 }}>{extra}</span>
      )}
    </span>
  )
}

// Estado del match relativo SIEMPRE al lado izquierdo (Jugador 1 / Equipo 1).
// En vivo: running>0 => "X UP", running<0 => "X DOWN", 0 => "ALL SQUARE".
// Terminado: resultado real (X&Y) en verde si gana la izquierda, rojo si pierde.
function relStatusDisplay(running: number, concluded: boolean, concludedStatus: string, leftWon: boolean | null) {
  if (concluded) return { text: concludedStatus, color: leftWon ? '#2F6B4F' : '#7A2E2E' }
  if (running > 0) return { text: `${running} UP`, color: '#1B4332' }
  if (running < 0) return { text: `${-running} DOWN`, color: '#1B4332' }
  return { text: 'ALL SQUARE', color: '#1B4332' }
}

function RelStatusBadge({ running, concluded, concludedStatus, leftWon, label }: { running: number; concluded: boolean; concludedStatus: string; leftWon: boolean | null; label: string }) {
  const { text, color } = relStatusDisplay(running, concluded, concludedStatus, leftWon)
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 4 }}>{label}</div>
      <div style={{ fontFamily: 'var(--display)', fontSize: 22, letterSpacing: 1, color }}>{text}</div>
    </div>
  )
}

function PlayerChip({ name, pi, side }: { name: string; pi: number; side: 'left' | 'right' }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexDirection: 'row', flex: 1, justifyContent: side === 'right' ? 'flex-end' : 'flex-start' }}>
      <div style={{ width: 22, height: 22, borderRadius: '50%', background: PLAYER_BG[pi], display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: 'white', flexShrink: 0 }}>{name[0]?.toUpperCase()}</div>
      <span style={{ fontSize: 13, fontWeight: 600, color: PLAYER_COLORS[pi] }}>{name}</span>
    </div>
  )
}

function IndividualResultCard({ p1, p2, match, stroke, pi1, pi2 }: any) {
  if (match) {
    // Jugador 1 (equipo 1) SIEMPRE a la izquierda, Jugador 2 a la derecha.
    // Centro relativo al jugador 1: UP / DOWN / ALL SQUARE en vivo; resultado real (X&Y) al terminar.
    const running = match.holeResults.length ? match.holeResults[match.holeResults.length - 1].runningStatus : 0
    const leftWon = match.concluded ? match.leaderId === p1.id : null
    const { text, color } = relStatusDisplay(running, match.concluded, match.status, leftWon)
    return (
      <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <PlayerChip name={p1.name} pi={pi1} side="left" />
          <div style={{ fontFamily: 'var(--display)', fontSize: 20, color, minWidth: 52, textAlign: 'center', flexShrink: 0 }}>{text}</div>
          <PlayerChip name={p2.name} pi={pi2} side="right" />
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
  const [activeTab, setActiveTab] = useState<'card' | 'neto' | 'results' | 'hist'>('card')
  const [openMatches, setOpenMatches] = useState<Record<string, boolean>>({})
  const toggleMatch = (k: string) => setOpenMatches(m => ({ ...m, [k]: !m[k] }))
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

  // Al abrir la tarjeta, llevar la vista (scroll horizontal + vertical) hasta la
  // columna del hoyo de salida, para que quien anota parta directamente ahí.
  useEffect(() => {
    if (loading || activeTab !== 'card') return
    const t = setTimeout(() => {
      document.getElementById('start-hole-col')?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' })
    }, 150)
    return () => clearTimeout(t)
  }, [loading, activeTab])

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
  const mpsResult = r.mode === 'mejor_peor_suma' && players.length === 4
    ? calcMejorPeorSuma(players, scores, holes, holes.length, hcpPct) : null
  const bismarckResult = r.mode === 'bismarck' && players.length === 3
    ? calcBismarck(players, scores, holes, holes.length, hcpPct) : null
  const combinado4Result = r.mode === 'combinado_4' && players.length === 4
    ? calcCombinado4(players, scores, holes, holes.length, (r as any).dobles_mode || 'matchplay', (r as any).dobles_hcp_pct ?? 100, (r as any).individual_mode || 'matchplay', (r as any).individual_hcp_pct ?? 80) : null
  const combinadoBismarckResult = r.mode === 'combinado_bismarck' && players.length === 3
    ? calcCombinadoBismarck(players, scores, holes, holes.length, (r as any).bismarck_hcp_pct ?? 100, (r as any).individual_mode || 'matchplay', (r as any).individual_hcp_pct ?? 80) : null
  const sideMatch = ((r as any).side_match ?? 'none') as 'none' | 'dobles' | 'singles'
  const grupalSide = r.mode === 'stroke_grupal' && sideMatch !== 'none'
    ? calcGrupalSide(players, scores, holes, holes.length, sideMatch, (r as any).side_hcp_pct ?? 100) : null

  const front9 = holes.slice(0, 9)
  const back9 = holes.length > 9 ? holes.slice(9) : []
  const startHole = (r as any).start_hole ?? 1

  // Estrategia de ventaja a mostrar en la vista Gross (círculo con palos recibidos,
  // sin ajustar el score). Solo se muestra para modos con un único % de handicap;
  // Ryder y Bismarck+Individuales tienen varias apuestas con % distintos, así que
  // su indicación de ventaja vive solo en sus tablas Neto respectivas.
  const grossHcpStrategy: 'individual' | 'relative' | null =
    r.mode === 'stroke' || r.mode === 'stroke_grupal' ? 'individual'
    : ['matchplay_individual', 'matchplay_dobles', 'bismarck', 'mejor_peor_suma'].includes(r.mode) ? 'relative'
    : null
  const allHcpsGross = players.map(p => p.handicap)

  // Puntos Ryder: dobles vale 2, cada individual 1 (6 en total). Empate parte el valor.
  const ryderPoints = (() => {
    if (!combinado4Result) return null
    const played = (ps: typeof players) => holes.some(h => ps.some(p => getScore(p.id, h.hole_number) !== null))
    const tm1 = players.filter(p => p.team === 1)
    const tm2 = players.filter(p => p.team === 2)
    let t1 = 0, t2 = 0
    if (played([...tm1, ...tm2])) {
      const d = combinado4Result.dobles
      if (d) {
        if (d.leadingTeam === 1) t1 += 2
        else if (d.leadingTeam === 2) t2 += 2
        else { t1 += 1; t2 += 1 }
      } else if (combinado4Result.doblesStroke) {
        const best = (t: number) => Math.max(0, ...players.filter(p => p.team === t).map(p => combinado4Result.doblesStroke!.find(rr => rr.playerId === p.id)?.stableford ?? 0))
        const b1 = best(1), b2 = best(2)
        if (b1 > b2) t1 += 2; else if (b2 > b1) t2 += 2; else { t1 += 1; t2 += 1 }
      }
    }
    const indivPts: Record<number, { t1: number; t2: number }> = {}
    combinado4Result.individuales.forEach(({ p1, p2, match, stroke }, idx) => {
      let a = 0, b = 0
      if (p1 && p2 && played([p1, p2])) {
        if (match) {
          if (match.leaderId === p1.id) a = 1
          else if (match.leaderId === p2.id) b = 1
          else { a = 0.5; b = 0.5 }
        } else if (stroke) {
          const s1 = stroke.p1?.stableford ?? 0, s2 = stroke.p2?.stableford ?? 0
          if (s1 > s2) a = 1; else if (s2 > s1) b = 1; else { a = 0.5; b = 0.5 }
        }
      }
      indivPts[idx] = { t1: a, t2: b }
      t1 += a; t2 += b
    })
    return { t1, t2, indivPts }
  })()
  const fmtPts = (n: number) => n.toLocaleString('es-CL')

  const showNetoTab = MODES_WITH_HCP.includes(r.mode)

  // Build tabs
  type Tab = 'card' | 'neto' | 'results' | 'hist'
  const tabs: { key: Tab; label: string }[] = [
    { key: 'card', label: 'Gross' },
    ...(showNetoTab ? [{ key: 'neto' as Tab, label: 'Score Neto' }] : []),
    { key: 'results', label: 'Resultados' },
    { key: 'hist', label: 'Histórico' },
  ]

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <TopBar />
      <header style={{ background: 'linear-gradient(135deg, #EDEAD8 0%, #F1EEE4 100%)', borderBottom: '1px solid var(--border)', padding: '18px 16px 14px' }}>
        <div style={{ maxWidth: 800, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <div>
              <h1 style={{ fontFamily: 'var(--display)', fontSize: 22, letterSpacing: 1, lineHeight: 1 }}>{(r as any).group_name || course?.club || course?.name}{secondCourse ? (
                <span style={{ fontSize: 14, color: 'var(--text3)', display: 'block', marginTop: 4, letterSpacing: 0 }}>
                  {course?.loop_label || 'Vuelta 1'} + {secondCourse?.loop_label || 'Vuelta 2'}
                </span>
              ) : (course?.loop_label ? (
                <span style={{ fontSize: 14, color: 'var(--text3)', display: 'block', marginTop: 4, letterSpacing: 0 }}>{course.loop_label}</span>
              ) : null)}</h1>
              {(r as any).group_name && (
                <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 2 }}>{course?.club || course?.name || 'Campo desconocido'}</div>
              )}
              <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
                {new Date(r.date + 'T00:00:00').toLocaleDateString('es-CL', { day: 'numeric', month: 'long' })} · {holes.length} hoyos · {MODE_LABELS[r.mode]}{startHole !== 1 ? ` · Salida hoyo ${startHole}` : ''}
              </div>
            </div>
            {saving && <div style={{ marginLeft: 'auto', fontSize: 11, color: '#1B4332' }}>💾</div>}
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, flexShrink: 0 }}>
              {r.mode === 'stroke_grupal' && (r as any).grupal && (
                <Link href={`/leaderboard/${id}`} style={{
                  background: 'rgba(43,95,122,0.1)',
                  border: '1px solid rgba(43,95,122,0.18)', color: '#2B5F7A',
                  borderRadius: 8, padding: '6px 12px', fontSize: 12,
                  textDecoration: 'none'
                }}>🏆 Leaderboard</Link>
              )}
              <Link href={`/round/${id}/edit`} style={{
                background: 'rgba(184,147,90,0.12)',
                border: '1px solid rgba(184,147,90,0.2)', color: '#B8935A',
                borderRadius: 8, padding: '6px 12px', fontSize: 12,
                textDecoration: 'none'
              }}>✎ Editar</Link>
              <button onClick={initiateDelete} disabled={deleting} style={{
                background: 'rgba(122,46,46,0.08)',
                border: '1px solid rgba(122,46,46,0.12)', color: '#7A2E2E',
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
            borderBottom: `2px solid ${activeTab === t.key ? '#1B4332' : 'transparent'}`,
            color: activeTab === t.key ? '#1B4332' : 'var(--text3)',
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
                        {holeSet.map(h => {
                          const isStart = h.hole_number === startHole
                          return (
                          <th key={h.hole_number} id={isStart ? 'start-hole-col' : undefined} style={{
                            width: 42, padding: '6px 4px', fontSize: 12, color: 'var(--text3)',
                            background: isStart ? 'rgba(184,147,90,0.16)' : 'var(--surface2)',
                            border: isStart ? '1px solid #B8935A' : '1px solid var(--border)',
                            borderBottom: isStart ? '3px solid #B8935A' : undefined,
                          }}>
                            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text2)' }}>{h.hole_number}</div>
                            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)' }}>P{h.par}</div><div style={{ fontSize: 11, fontWeight: 700, color: '#1B4332' }}>V{h.handicap}</div>
                            {isStart && <div style={{ fontSize: 9, fontWeight: 700, color: '#B8935A', letterSpacing: 0.5, marginTop: 1 }}>SALIDA</div>}
                          </th>
                          )
                        })}
                        <th style={{ width: 52, padding: '6px 8px', fontSize: 11, color: '#1B4332', background: 'var(--surface2)', border: '1px solid var(--border)' }}>
                          {setLabel}
                        </th>
                        {isBack && (
                          <th style={{ width: 56, padding: '6px 8px', fontSize: 11, color: '#C9A227', background: 'var(--surface2)', border: '1px solid var(--border)' }}>
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
                              const extra = grossHcpStrategy === 'individual'
                                ? getExtraStrokes(h.handicap, p.handicap, holes.length, hcpPct)
                                : grossHcpStrategy === 'relative'
                                ? getRelativeExtra(h.handicap, p.handicap, allHcpsGross, holes.length, hcpPct)
                                : 0
                              return (
                                <td key={h.hole_number} style={{ padding: 3, border: '1px solid var(--border)', background: 'var(--surface)', textAlign: 'center' }}>
                                  <div style={{ position: 'relative', width: 34, margin: '0 auto' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 30 }}>
                                      <ScoreBadge strokes={s} par={h.par} extra={extra} />
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
                              <td style={{ padding: '6px 8px', border: '1px solid var(--border)', background: 'var(--surface)', textAlign: 'center', fontWeight: 700, color: '#C9A227', fontSize: 14 }}>
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
                { label: 'Hoyo en 1', bg: '#C9A227', r: '50%' },
                { label: 'Eagle o mejor', bg: '#F5D54A', r: '50%' },
                { label: 'Birdie', bg: '#1B4332', r: 4 },
                { label: 'Par', bg: '#FFFFFF', border: '1px solid var(--border2)' },
                { label: 'Bogey', bg: 'rgba(122,46,46,0.1)', border: '1px solid rgba(122,46,46,0.18)' },
                { label: 'Doble bogey', bg: 'rgba(122,46,46,0.18)', border: '1px solid #7A2E2E' },
                { label: '+3 o peor', bg: '#F3E2E0', border: '1px solid #7A2E2E', double: true },
              ].map((l: any) => (
                <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--text3)' }}>
                  <span style={{ position: 'relative', width: 14, height: 14, display: 'inline-flex' }}>
                    {l.double && <span style={{ position: 'absolute', inset: -3, border: '1.5px solid #7A2E2E', borderRadius: 5 }} />}
                    <span style={{ width: 14, height: 14, background: l.bg, borderRadius: l.r || 3, border: l.border }} />
                  </span>
                  {l.label}
                </div>
              ))}
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--text3)' }}>
                <span style={{ position: 'relative', width: 14, height: 14, display: 'inline-flex' }}>
                  <span style={{ width: 14, height: 14, background: 'var(--surface2)', borderRadius: 3, border: '1px solid var(--border)' }} />
                  <span style={{ position: 'absolute', top: -3, right: -3, width: 8, height: 8, background: '#1B4332', borderRadius: '50%' }} />
                </span>
                Recibe palo(s) de ventaja
              </div>
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
              n === null ? 'var(--text3)' : n > 0 ? '#1B4332' : n < 0 ? '#7A2E2E' : 'var(--text)'
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
                                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)' }}>P{h.par}</div><div style={{ fontSize: 11, fontWeight: 700, color: '#1B4332' }}>V{h.handicap}</div>
                                </th>
                              ))}
                              <th style={{ width: 52, padding: '6px 8px', fontSize: 11, color: '#1B4332', background: 'var(--surface2)', border: '1px solid var(--border)' }}>
                                {setLabel}
                              </th>
                              {isBack && (
                                <th style={{ width: 56, padding: '6px 8px', fontSize: 11, color: '#C9A227', background: 'var(--surface2)', border: '1px solid var(--border)' }}>
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
                                            background: extra > 0 ? 'rgba(27,67,50,0.1)' : 'var(--surface2)',
                                            border: extra > 0 ? '1px solid rgba(27,67,50,0.16)' : '1px solid var(--border)',
                                            borderRadius: 4, position: 'relative'
                                          }}>
                                            {neto}
                                            {extra > 0 && <span style={{ position: 'absolute', top: -4, right: -4, width: 10, height: 10, background: '#1B4332', borderRadius: '50%', fontSize: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#F1EEE4', fontWeight: 900 }}>{extra}</span>}
                                          </div>
                                        ) : (
                                          <span style={{ position: 'relative', display: 'inline-flex', width: 26, height: 26, alignItems: 'center', justifyContent: 'center' }}>
                                            <span style={{ color: 'var(--text3)', fontSize: 13 }}>—</span>
                                            {extra > 0 && <span style={{ position: 'absolute', top: -5, right: -5, width: 10, height: 10, background: '#1B4332', borderRadius: '50%', fontSize: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#F1EEE4', fontWeight: 900 }}>{extra}</span>}
                                          </span>
                                        )}
                                      </td>
                                    )
                                  })}
                                  <td style={{ padding: '6px 8px', border: '1px solid var(--border)', background: 'var(--surface)', textAlign: 'center', fontWeight: 700, fontSize: 14 }}>
                                    {hasRow ? <span style={{ color: PLAYER_COLORS[pi] }}>{rowNeto}</span> : '—'}
                                  </td>
                                  {isBack && (
                                    <td style={{ padding: '6px 8px', border: '1px solid var(--border)', background: 'var(--surface)', textAlign: 'center', fontWeight: 700, fontSize: 14 }}>
                                      {hasTotal ? <span style={{ color: '#C9A227' }}>{totalNeto}</span> : '—'}
                                    </td>
                                  )}
                                </tr>
                              )
                            })}
                            {showStatus && statuses && renderStatusRow(
                              holeSet, statuses, 'ESTADO', PLAYER_COLORS[p1pi] || '#1B4332', isBack
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
                                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)' }}>P{h.par}</div><div style={{ fontSize: 11, fontWeight: 700, color: '#1B4332' }}>V{h.handicap}</div>
                                </th>
                              ))}
                              <th style={{ width: 52, padding: '6px 8px', fontSize: 11, color: '#1B4332', background: 'var(--surface2)', border: '1px solid var(--border)' }}>{setLabel}</th>
                              {isBack && (
                                <th style={{ width: 56, padding: '6px 8px', fontSize: 11, color: '#C9A227', background: 'var(--surface2)', border: '1px solid var(--border)' }}>TOTAL</th>
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
                                    <td style={{ padding: '6px 8px', border: '1px solid var(--border)', background: 'var(--surface)', textAlign: 'center', fontWeight: 700, fontSize: 14, color: '#C9A227' }}>
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

            const lastNonNull = (arr: (number | null)[]) => {
              let v: number | null = null
              arr.forEach(x => { if (x !== null) v = x })
              return v
            }
            // Estadística simple: neto promedio por hoyo y desviación vs par (en neto).
            const netStats = (mp: typeof players, pct: number) => {
              const allHcps = mp.map(p => p.handicap)
              return mp.map(p => {
                let sumNet = 0, sumVsPar = 0, n = 0
                holes.forEach(h => {
                  const s = getScore(p.id, h.hole_number)
                  if (s === null) return
                  const net = s - getRelativeExtra(h.handicap, p.handicap, allHcps, holes.length, pct)
                  sumNet += net; sumVsPar += net - h.par; n++
                })
                return { id: p.id, name: p.name, n, avgNet: n ? sumNet / n : null, avgVsPar: n ? sumVsPar / n : null }
              })
            }
            const thruOf = (ps: typeof players) => holes.filter(h => ps.every(p => getScore(p.id, h.hole_number) !== null)).length

            const matches = [
              {
                key: 'dobles', label: 'DOBLES', color: '#2F6B4F', pct: dPct,
                left: team1.map(p => p.name).join(' y ') || 'Equipo 1',
                right: team2.map(p => p.name).join(' y ') || 'Equipo 2',
                status: lastNonNull(computeDoublesData(team1, team2, dPct).map(d => d.status)),
                thru: thruOf([...team1, ...team2]),
                stats: netStats([...team1, ...team2], dPct),
                content: dMode === 'matchplay'
                  ? <DoublesNetTable title="DOBLES — MATCH PLAY" titleColor="#2F6B4F" team1Players={team1} team2Players={team2} pct={dPct} />
                  : <NetTable title="DOBLES — STROKE" titleColor="#2F6B4F" groupPlayers={players} pct={dPct} strategy="individual" />
              },
              ...pairs.map(([p1, p2], idx) => {
                const pi1 = players.findIndex(p => p.id === p1.id)
                return {
                  key: `i${idx}`, label: `INDIVIDUAL ${idx + 1}`, color: PLAYER_COLORS[pi1] || '#B8935A', pct: iPct,
                  left: p1.name, right: p2.name,
                  status: lastNonNull(computeIndivStatuses(p1, p2, iPct)),
                  thru: thruOf([p1, p2]),
                  stats: netStats([p1, p2], iPct),
                  content: <NetTable title={`${p1.name} vs ${p2.name} — ${iMode === 'stroke' ? 'STROKE' : 'MATCH PLAY'}`}
                    titleColor={PLAYER_COLORS[pi1]} groupPlayers={[p1, p2]} pct={iPct}
                    strategy={iMode === 'stroke' ? 'individual' : 'relative'} matchPlay={iMode === 'matchplay'} />
                }
              })
            ]
            // Puntos Ryder: dobles vale 2, cada individual 1 (6 en total). Empate parte el valor.
            let pts1 = 0, pts2 = 0
            matches.forEach(m => {
              const val = m.key === 'dobles' ? 2 : 1
              if (m.status === null) return
              if (m.status > 0) pts1 += val
              else if (m.status < 0) pts2 += val
              else { pts1 += val / 2; pts2 += val / 2 }
            })
            const ties = matches.filter(m => m.status === 0).length
            const fmtPts = (n: number) => n.toLocaleString('es-CL')

            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
                  <div style={{ flex: 1, textAlign: 'center', background: 'var(--surface)', border: '1px solid #2dd4bf33', borderRadius: 10, padding: '8px 6px' }}>
                    <div style={{ fontSize: 10, color: 'var(--text3)', letterSpacing: 1 }}>EQUIPO 1</div>
                    <div style={{ fontFamily: 'var(--display)', fontSize: 24, fontWeight: 700, color: '#1B4332', lineHeight: 1.1 }}>{fmtPts(pts1)}</div>
                    <div style={{ fontSize: 10, color: 'var(--text3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{team1.map(p => p.name).join(' y ')}</div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)', fontSize: 10, minWidth: 44, textAlign: 'center', lineHeight: 1.3 }}>
                    <span style={{ fontWeight: 700, color: 'var(--text2)' }}>PTS</span>
                    <span>de 6</span>
                    {ties > 0 && <span>{ties} AS</span>}
                  </div>
                  <div style={{ flex: 1, textAlign: 'center', background: 'var(--surface)', border: '1px solid #f8717133', borderRadius: 10, padding: '8px 6px' }}>
                    <div style={{ fontSize: 10, color: 'var(--text3)', letterSpacing: 1 }}>EQUIPO 2</div>
                    <div style={{ fontFamily: 'var(--display)', fontSize: 24, fontWeight: 700, color: '#7A2E2E', lineHeight: 1.1 }}>{fmtPts(pts2)}</div>
                    <div style={{ fontSize: 10, color: 'var(--text3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{team2.map(p => p.name).join(' y ')}</div>
                  </div>
                </div>

                {matches.map(m => {
                  const open = !!openMatches[m.key]
                  const st = m.status
                  const leadFirst = st !== null && st > 0
                  const leadSecond = st !== null && st < 0
                  const badge = st === null ? '—' : st === 0 ? 'AS' : `${Math.abs(st)}↑`
                  const badgeColor = st === null ? 'var(--text3)' : st === 0 ? 'var(--text2)' : leadFirst ? '#1B4332' : '#7A2E2E'
                  return (
                    <div key={m.key} style={{ background: 'var(--surface)', border: `1px solid ${m.color}33`, borderRadius: 12, overflow: 'hidden' }}>
                      <button onClick={() => toggleMatch(m.key)} style={{
                        width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 10,
                        padding: '12px 14px', background: 'transparent', border: 'none', cursor: 'pointer'
                      }}>
                        <span style={{ color: m.color, fontSize: 12, width: 12, flexShrink: 0 }}>{open ? '▾' : '▸'}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, color: m.color }}>{m.label} · {m.key === 'dobles' ? '2 pts' : '1 pt'}</span>
                            <span style={{ fontSize: 10, color: 'var(--text3)' }}>{m.thru > 0 ? `jugados ${m.thru}` : 'sin jugar'}</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ flex: 1, textAlign: 'right', fontSize: 13, fontWeight: leadFirst ? 700 : 400, color: leadFirst ? '#1B4332' : 'var(--text2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.left}</span>
                            <span style={{ flexShrink: 0, minWidth: 42, textAlign: 'center', fontFamily: 'var(--display)', fontSize: 13, fontWeight: 700, color: badgeColor, background: `${badgeColor}1a`, borderRadius: 6, padding: '3px 6px' }}>{badge}</span>
                            <span style={{ flex: 1, textAlign: 'left', fontSize: 13, fontWeight: leadSecond ? 700 : 400, color: leadSecond ? '#7A2E2E' : 'var(--text2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.right}</span>
                          </div>
                        </div>
                      </button>
                      {open && (
                        <div style={{ padding: '0 12px 12px' }}>
                          {m.content}
                          <div style={{ marginTop: 4, background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px' }}>
                            <div style={{ fontSize: 10, letterSpacing: 1, color: 'var(--text3)', marginBottom: 8 }}>ESTADÍSTICA · NETO (HCP {m.pct}%)</div>
                            {m.stats.map(s => (
                              <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, padding: '3px 0' }}>
                                <span style={{ color: 'var(--text2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1, marginRight: 8 }}>{s.name}</span>
                                <span style={{ color: 'var(--text3)', flexShrink: 0 }}>
                                  {s.avgNet === null ? '—' : <>neto/hoyo <strong style={{ color: 'var(--text)' }}>{s.avgNet.toFixed(1)}</strong> · vs par <strong style={{ color: (s.avgVsPar ?? 0) <= 0 ? '#1B4332' : '#7A2E2E' }}>{(s.avgVsPar ?? 0) >= 0 ? '+' : ''}{(s.avgVsPar ?? 0).toFixed(1)}</strong></>}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
                <div style={{ fontSize: 11, color: 'var(--text3)', paddingTop: 4, lineHeight: 1.5 }}>
                  Toca un partido para ver el detalle hoyo a hoyo y su estadística. El número es cuántos hoyos arriba va el lado resaltado; <strong style={{ color: 'var(--text2)' }}>AS</strong> = empate. «vs par» = promedio del score neto menos el par del hoyo (negativo = bajo par).
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
                  <NetTable title="BISMARCK" titleColor="#7A2E2E" groupPlayers={players} pct={bPct} strategy="relative" />
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
                <DoublesNetTable title="MATCH PLAY DOBLES" titleColor="#6B5B95"
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
            {(r.mode === 'stroke' || r.mode === 'stroke_grupal') && (
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', fontFamily: 'var(--display)', fontSize: 14, letterSpacing: 2, color: 'var(--text3)' }}>{r.mode === 'stroke_grupal' ? 'STROKE PLAY GRUPAL — STABLEFORD' : 'STROKE PLAY — STABLEFORD'}</div>
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
                          <td style={{ padding: '10px 12px', border: '1px solid var(--border)', textAlign: 'center', fontFamily: 'var(--display)', fontSize: 18, color: rank === 0 ? '#B8935A' : 'var(--text3)' }}>{rank + 1}</td>
                          <td style={{ padding: '10px 12px', border: '1px solid var(--border)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div style={{ width: 24, height: 24, borderRadius: '50%', background: PLAYER_BG[pi], display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: 'white' }}>{res.name[0]?.toUpperCase()}</div>
                              <span style={{ fontWeight: 500, color: PLAYER_COLORS[pi] }}>{res.name}</span>
                            </div>
                          </td>
                          <td style={{ padding: '10px 12px', border: '1px solid var(--border)', textAlign: 'center', color: 'var(--text3)' }}>{players[pi]?.handicap}</td>
                          <td style={{ padding: '10px 12px', border: '1px solid var(--border)', textAlign: 'center', fontWeight: 600 }}>{res.gross || '—'}</td>
                          <td style={{ padding: '10px 12px', border: '1px solid var(--border)', textAlign: 'center', fontWeight: 600, color: '#1B4332' }}>{res.gross ? res.net : '—'}</td>
                          <td style={{ padding: '10px 12px', border: '1px solid var(--border)', textAlign: 'center', fontWeight: 600, color: res.overUnder < 0 ? '#1B4332' : res.overUnder > 0 ? '#7A2E2E' : 'var(--text)' }}>
                            {res.gross ? (res.overUnder > 0 ? `+${res.overUnder}` : res.overUnder) : '—'}
                          </td>
                          <td style={{ padding: '10px 12px', border: '1px solid var(--border)', textAlign: 'center', fontFamily: 'var(--display)', fontSize: 20, color: '#B8935A' }}>{res.stableford || '—'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* STROKE GRUPAL — banner competencia + leaderboard + side game */}
            {r.mode === 'stroke_grupal' && (
              <>
                {(r as any).grupal && (
                  <div style={{ background: 'rgba(43,95,122,0.08)', border: '1px solid rgba(43,95,122,0.15)', borderRadius: 12, padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ fontSize: 10, color: 'var(--text3)', letterSpacing: 1 }}>COMPETENCIA GRUPAL</div>
                      <div style={{ fontFamily: 'var(--display)', fontSize: 18, color: '#2B5F7A', letterSpacing: 1 }}>{(r as any).competition_name || '—'}</div>
                    </div>
                    <Link href={`/leaderboard/${id}`} style={{
                      background: '#2B5F7A', color: '#E9EFEA', borderRadius: 10, padding: '10px 16px',
                      fontFamily: 'var(--display)', fontSize: 14, letterSpacing: 1, textDecoration: 'none'
                    }}>🏆 Ver Leaderboard</Link>
                  </div>
                )}

                {grupalSide && grupalSide.dobles && (() => {
                  const d = grupalSide.dobles!
                  const dRunning = d.holeResults.length ? d.holeResults[d.holeResults.length - 1].runningStatus : 0
                  const dLeftWon = d.concluded ? d.leadingTeam === 1 : null
                  return (
                    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
                      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', fontFamily: 'var(--display)', fontSize: 14, letterSpacing: 2, color: 'var(--text3)' }}>PARTIDO PARALELO — DOBLES (MATCH PLAY)</div>
                      <div style={{ padding: '16px 16px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                        <div style={{ textAlign: 'center', flex: 1 }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: d.leadingTeam === 1 ? PLAYER_COLORS[0] : 'var(--text2)', marginBottom: 4 }}>TEAM 1</div>
                          {players.filter(p => p.team === 1).map(p => <div key={p.id} style={{ fontSize: 13, color: 'var(--text3)' }}>{p.name}</div>)}
                        </div>
                        <RelStatusBadge running={dRunning} concluded={d.concluded} concludedStatus={d.status} leftWon={dLeftWon} label={d.concluded ? '🏆 Terminado' : `${d.holeResults.length} hoyos`} />
                        <div style={{ textAlign: 'center', flex: 1 }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: d.leadingTeam === 2 ? PLAYER_COLORS[2] : 'var(--text2)', marginBottom: 4 }}>TEAM 2</div>
                          {players.filter(p => p.team === 2).map(p => <div key={p.id} style={{ fontSize: 13, color: 'var(--text3)' }}>{p.name}</div>)}
                        </div>
                      </div>
                    </div>
                  )
                })()}

                {grupalSide && grupalSide.singles.length > 0 && (
                  <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
                    <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', fontFamily: 'var(--display)', fontSize: 14, letterSpacing: 2, color: 'var(--text3)' }}>PARTIDOS PARALELOS — INDIVIDUALES (MATCH PLAY)</div>
                    <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {grupalSide.singles.map(({ p1, p2, match }, idx) => (
                        <IndividualResultCard key={idx} p1={p1} p2={p2} match={match} stroke={null}
                          pi1={players.findIndex(p => p.id === p1.id)} pi2={players.findIndex(p => p.id === p2.id)} />
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* MATCH PLAY INDIVIDUAL */}
            {r.mode === 'matchplay_individual' && matchResult && (() => {
              const leftP = players[0]
              const rightP = players[1]
              const leftPi = 0
              const rightPi = 1
              const mpRunning = matchResult.holeResults.length ? matchResult.holeResults[matchResult.holeResults.length - 1].runningStatus : 0
              const mpLeftWon = matchResult.concluded ? matchResult.leaderId === players[0]?.id : null
              return (
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', fontFamily: 'var(--display)', fontSize: 14, letterSpacing: 2, color: 'var(--text3)' }}>MATCH PLAY INDIVIDUAL</div>
                <div style={{ padding: '16px 16px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                  {leftP && (
                    <div style={{ textAlign: 'center', flex: 1 }}>
                      <div style={{ width: 44, height: 44, borderRadius: '50%', background: PLAYER_BG[leftPi], display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700, color: 'white', margin: '0 auto 8px' }}>{leftP.name[0]?.toUpperCase()}</div>
                      <div style={{ fontWeight: 600, color: leftP.id === matchResult.leaderId ? PLAYER_COLORS[leftPi] : 'var(--text2)', fontSize: 14 }}>{leftP.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text3)' }}>HCP {leftP.handicap}</div>
                    </div>
                  )}
                  <RelStatusBadge running={mpRunning} concluded={matchResult.concluded} concludedStatus={matchResult.status} leftWon={mpLeftWon} label={matchResult.concluded ? '🏆 Terminado' : `${matchResult.holeResults.length} hoyos`} />
                  {rightP && (
                    <div style={{ textAlign: 'center', flex: 1 }}>
                      <div style={{ width: 44, height: 44, borderRadius: '50%', background: PLAYER_BG[rightPi], display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700, color: 'white', margin: '0 auto 8px' }}>{rightP.name[0]?.toUpperCase()}</div>
                      <div style={{ fontWeight: 600, color: rightP.id === matchResult.leaderId ? PLAYER_COLORS[rightPi] : 'var(--text2)', fontSize: 14 }}>{rightP.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text3)' }}>HCP {rightP.handicap}</div>
                    </div>
                  )}
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
              const dRunning = doublesResult.holeResults.length ? doublesResult.holeResults[doublesResult.holeResults.length - 1].runningStatus : 0
              const dLeftWon = doublesResult.concluded ? doublesResult.leadingTeam === 1 : null
              return (
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', fontFamily: 'var(--display)', fontSize: 14, letterSpacing: 2, color: 'var(--text3)' }}>MATCH PLAY DOBLES</div>
                <div style={{ padding: '16px 16px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                  <div style={{ textAlign: 'center', flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: doublesResult.leadingTeam === 1 ? PLAYER_COLORS[0] : 'var(--text2)', marginBottom: 4 }}>TEAM 1</div>
                    {players.filter(p => p.team === 1).map(p => <div key={p.id} style={{ fontSize: 13, color: 'var(--text3)' }}>{p.name}</div>)}
                  </div>
                  <RelStatusBadge running={dRunning} concluded={doublesResult.concluded} concludedStatus={doublesResult.status} leftWon={dLeftWon} label={doublesResult.concluded ? '🏆 Terminado' : `${doublesResult.holeResults.length} hoyos`} />
                  <div style={{ textAlign: 'center', flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: doublesResult.leadingTeam === 2 ? PLAYER_COLORS[2] : 'var(--text2)', marginBottom: 4 }}>TEAM 2</div>
                    {players.filter(p => p.team === 2).map(p => <div key={p.id} style={{ fontSize: 13, color: 'var(--text3)' }}>{p.name}</div>)}
                  </div>
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

            {/* MEJOR, PEOR Y SUMA */}
            {r.mode === 'mejor_peor_suma' && mpsResult && (() => {
              const t1p = players.filter(p => p.team === 1)
              const t2p = players.filter(p => p.team === 2)
              const ordered = [...t1p, ...t2p]
              const teamCol = (t: number | undefined) => PLAYER_COLORS[t === 1 ? 0 : 2]
              const m = mpsResult.margin
              const signed = (v: number) => (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v)
              const cat = (w: 0 | 1 | 2, val: number) => w === 0
                ? <span style={{ color: 'var(--text3)' }}>=</span>
                : <span style={{ fontWeight: 700, color: teamCol(w) }}>{val}</span>
              const cellTd: React.CSSProperties = { padding: '5px 6px', borderBottom: '1px solid var(--border)', textAlign: 'center', whiteSpace: 'nowrap' }
              const headTh: React.CSSProperties = { padding: '7px 6px', textAlign: 'center', fontSize: 10, color: 'var(--text3)', background: 'var(--surface2)', whiteSpace: 'nowrap', lineHeight: 1.2 }
              return (
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', fontFamily: 'var(--display)', fontSize: 14, letterSpacing: 2, color: 'var(--text3)', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                  <span>MEJOR, PEOR Y SUMA</span>
                  <span style={{ fontSize: 11 }}>NETO · HCP {hcpPct}%</span>
                </div>
                {/* Marcador */}
                <div style={{ display: 'flex', alignItems: 'center', padding: 16, gap: 8 }}>
                  <div style={{ flex: 1, textAlign: 'center' }}>
                    <div style={{ fontSize: 11, color: teamCol(1), fontWeight: 700, letterSpacing: 1 }}>EQUIPO 1</div>
                    <div style={{ fontFamily: 'var(--display)', fontSize: 34, color: teamCol(1) }}>{mpsResult.totalT1}</div>
                    <div style={{ fontSize: 12, color: 'var(--text3)' }}>{t1p.map(p => p.name).join(' y ')}</div>
                  </div>
                  <div style={{ textAlign: 'center', minWidth: 78 }}>
                    <div style={{ fontSize: 10, color: 'var(--text3)', letterSpacing: 1 }}>MARGEN</div>
                    <div style={{ fontFamily: 'var(--display)', fontSize: 24, color: m > 0 ? teamCol(1) : m < 0 ? teamCol(2) : 'var(--text2)' }}>{m === 0 ? 'EQ' : signed(m)}</div>
                    <div style={{ fontSize: 10, color: 'var(--text3)' }}>{m > 0 ? 'Equipo 1' : m < 0 ? 'Equipo 2' : 'Empate'}</div>
                  </div>
                  <div style={{ flex: 1, textAlign: 'center' }}>
                    <div style={{ fontSize: 11, color: teamCol(2), fontWeight: 700, letterSpacing: 1 }}>EQUIPO 2</div>
                    <div style={{ fontFamily: 'var(--display)', fontSize: 34, color: teamCol(2) }}>{mpsResult.totalT2}</div>
                    <div style={{ fontSize: 12, color: 'var(--text3)' }}>{t2p.map(p => p.name).join(' y ')}</div>
                  </div>
                </div>
                {/* Desglose por hoyo */}
                {mpsResult.holeResults.length === 0 ? (
                  <div style={{ padding: '0 16px 16px', fontSize: 12, color: 'var(--text3)' }}>Aún no hay hoyos completados por las 4 personas.</div>
                ) : (
                  <div style={{ overflowX: 'auto', borderTop: '1px solid var(--border)' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                      <thead>
                        <tr>
                          <th style={headTh}>H</th>
                          {ordered.map(p => <th key={p.id} style={{ ...headTh, color: teamCol(p.team) }}>{p.name}</th>)}
                          <th style={headTh}>Mejor<br />(2)</th>
                          <th style={headTh}>Suma<br />(1)</th>
                          <th style={headTh}>Peor<br />(1)</th>
                          <th style={headTh}>Hoyo</th>
                          <th style={headTh}>Acum</th>
                        </tr>
                      </thead>
                      <tbody>
                        {mpsResult.holeResults.map(h => {
                          const net = (pid: string) => h.nets.find(n => n.playerId === pid)?.net
                          const hp = h.pts1 - h.pts2
                          return (
                            <tr key={h.hole}>
                              <td style={{ ...cellTd, color: 'var(--text3)', fontWeight: 700 }}>{h.hole}</td>
                              {ordered.map(p => <td key={p.id} style={{ ...cellTd, color: teamCol(p.team), fontWeight: 600 }}>{net(p.id) ?? '—'}</td>)}
                              <td style={cellTd}>{cat(h.winners.mejor, 2)}</td>
                              <td style={cellTd}>{cat(h.winners.suma, 1)}</td>
                              <td style={cellTd}>{cat(h.winners.peor, 1)}</td>
                              <td style={{ ...cellTd, fontWeight: 700, color: hp > 0 ? teamCol(1) : hp < 0 ? teamCol(2) : 'var(--text3)' }}>{hp === 0 ? '0' : signed(hp)}</td>
                              <td style={{ ...cellTd, fontFamily: 'var(--display)', fontSize: 13, color: h.margin > 0 ? teamCol(1) : h.margin < 0 ? teamCol(2) : 'var(--text2)' }}>{h.margin === 0 ? '0' : signed(h.margin)}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
                <p style={{ fontSize: 11, color: 'var(--text3)', padding: '10px 16px', lineHeight: 1.6, margin: 0 }}>
                  Cada hoyo (neto, menor gana): <strong>Mejor</strong> bola = 2 pts · <strong>Suma</strong> de la pareja = 1 pt · <strong>Peor</strong> bola = 1 pt. Empate en una categoría = 0. <strong>Hoyo</strong> = saldo del hoyo y <strong>Acum</strong> = saldo acumulado, a favor del Equipo 1 (− si va arriba el Equipo 2).
                </p>
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
                        <div style={{ fontFamily: 'var(--display)', fontSize: 32, color: rank === 0 ? '#B8935A' : 'var(--text)' }}>{t.total}</div>
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
                {ryderPoints && (
                  <div style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
                    <div style={{ flex: 1, textAlign: 'center', background: 'var(--surface)', border: '1px solid #2dd4bf33', borderRadius: 12, padding: '12px 8px' }}>
                      <div style={{ fontSize: 10, color: 'var(--text3)', letterSpacing: 1 }}>EQUIPO 1</div>
                      <div style={{ fontFamily: 'var(--display)', fontSize: 30, fontWeight: 700, color: '#1B4332', lineHeight: 1.1 }}>{fmtPts(ryderPoints.t1)}</div>
                      <div style={{ fontSize: 10, color: 'var(--text3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{players.filter(p => p.team === 1).map(p => p.name).join(' y ')}</div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)', fontSize: 10, minWidth: 44 }}>
                      <span style={{ fontWeight: 700, color: 'var(--text2)' }}>PTS</span><span>de 6</span>
                    </div>
                    <div style={{ flex: 1, textAlign: 'center', background: 'var(--surface)', border: '1px solid #f8717133', borderRadius: 12, padding: '12px 8px' }}>
                      <div style={{ fontSize: 10, color: 'var(--text3)', letterSpacing: 1 }}>EQUIPO 2</div>
                      <div style={{ fontFamily: 'var(--display)', fontSize: 30, fontWeight: 700, color: '#7A2E2E', lineHeight: 1.1 }}>{fmtPts(ryderPoints.t2)}</div>
                      <div style={{ fontSize: 10, color: 'var(--text3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{players.filter(p => p.team === 2).map(p => p.name).join(' y ')}</div>
                    </div>
                  </div>
                )}
                <div style={{ background: 'var(--surface)', border: '1px solid #34d39930', borderRadius: 12, overflow: 'hidden' }}>
                  <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', fontFamily: 'var(--display)', fontSize: 14, letterSpacing: 2, color: '#2F6B4F', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>DOBLES — {((r as any).dobles_mode === 'stroke' ? 'STROKE' : 'MATCH PLAY')} · HCP {(r as any).dobles_hcp_pct}%</span>
                    <span style={{ fontFamily: 'var(--body)', fontSize: 11, color: 'var(--text3)', letterSpacing: 0 }}>vale 2 pts</span>
                  </div>
                  <div style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: PLAYER_COLORS[0], marginBottom: 4 }}>TEAM 1</div>
                      {players.filter(p => p.team === 1).map(p => <div key={p.id} style={{ fontSize: 13, color: 'var(--text3)' }}>{p.name}</div>)}
                    </div>
                    {combinado4Result.dobles && (
                      <RelStatusBadge
                        running={combinado4Result.dobles.holeResults.length ? combinado4Result.dobles.holeResults[combinado4Result.dobles.holeResults.length - 1].runningStatus : 0}
                        concluded={combinado4Result.dobles.concluded}
                        concludedStatus={combinado4Result.dobles.status}
                        leftWon={combinado4Result.dobles.concluded ? combinado4Result.dobles.leadingTeam === 1 : null}
                        label={combinado4Result.dobles.concluded ? '🏆 Terminado' : 'En juego'}
                      />
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
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: PLAYER_COLORS[2], marginBottom: 4 }}>TEAM 2</div>
                      {players.filter(p => p.team === 2).map(p => <div key={p.id} style={{ fontSize: 13, color: 'var(--text3)' }}>{p.name}</div>)}
                    </div>
                  </div>
                  <div style={{ padding: '8px 16px', borderTop: '1px solid var(--border)', textAlign: 'right', fontSize: 11, fontWeight: 700 }}>
                    {(() => {
                      const anyScore = holes.some(h => players.some(p => getScore(p.id, h.hole_number) !== null))
                      if (!anyScore) return <span style={{ color: 'var(--text3)' }}>sin definir</span>
                      let lead: number | null = null
                      const d = combinado4Result.dobles
                      if (d) lead = d.leadingTeam
                      else if (combinado4Result.doblesStroke) {
                        const best = (t: number) => Math.max(0, ...players.filter(p => p.team === t).map(p => combinado4Result.doblesStroke!.find(rr => rr.playerId === p.id)?.stableford ?? 0))
                        const b1 = best(1), b2 = best(2); lead = b1 > b2 ? 1 : b2 > b1 ? 2 : null
                      }
                      if (lead === 1) return <span style={{ color: '#1B4332' }}>2 pts · Equipo 1</span>
                      if (lead === 2) return <span style={{ color: '#7A2E2E' }}>2 pts · Equipo 2</span>
                      return <span style={{ color: 'var(--text3)' }}>1 y 1 · AS</span>
                    })()}
                  </div>
                </div>

                <div style={{ background: 'var(--surface)', border: '1px solid #f59e0b30', borderRadius: 12, overflow: 'hidden' }}>
                  <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', fontFamily: 'var(--display)', fontSize: 14, letterSpacing: 2, color: '#B8935A', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>INDIVIDUALES — {((r as any).individual_mode === 'stroke' ? 'STROKE' : 'MATCH PLAY')} · HCP {(r as any).individual_hcp_pct}%</span>
                    <span style={{ fontFamily: 'var(--body)', fontSize: 11, color: 'var(--text3)', letterSpacing: 0 }}>1 pt c/u</span>
                  </div>
                  <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {combinado4Result.individuales.map(({ p1, p2, match, stroke }, idx) => {
                      const pi1 = players.findIndex(p => p.id === p1?.id)
                      const pi2 = players.findIndex(p => p.id === p2?.id)
                      if (!p1 || !p2) return null
                      const pts = ryderPoints?.indivPts[idx] || { t1: 0, t2: 0 }
                      const ptsLabel = pts.t1 === 1 ? `1 pt · ${p1.name}` : pts.t2 === 1 ? `1 pt · ${p2.name}` : (pts.t1 === 0.5 ? '0,5 y 0,5 · AS' : 'sin definir')
                      const ptsColor = pts.t1 === 1 ? PLAYER_COLORS[pi1] : pts.t2 === 1 ? PLAYER_COLORS[pi2] : 'var(--text3)'
                      return (
                        <div key={idx}>
                          <IndividualResultCard p1={p1} p2={p2} match={match} stroke={stroke} pi1={pi1} pi2={pi2} />
                          <div style={{ textAlign: 'right', fontSize: 11, fontWeight: 700, color: ptsColor, padding: '3px 4px 0' }}>{ptsLabel}</div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* COMBINADO BISMARCK */}
            {r.mode === 'combinado_bismarck' && combinadoBismarckResult && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ background: 'var(--surface)', border: '1px solid #f8717130', borderRadius: 12, overflow: 'hidden' }}>
                  <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', fontFamily: 'var(--display)', fontSize: 14, letterSpacing: 2, color: '#7A2E2E' }}>
                    BISMARCK · HCP {(r as any).bismarck_hcp_pct}%
                  </div>
                  <div style={{ display: 'flex', padding: 16, gap: 12 }}>
                    {combinadoBismarckResult.bismarck.totals.map((t, rank) => {
                      const pi = players.findIndex(p => p.id === t.playerId)
                      return (
                        <div key={t.playerId} style={{ flex: 1, textAlign: 'center', padding: '12px 8px', borderRadius: 10, background: rank === 0 ? `${PLAYER_BG[pi]}20` : 'var(--surface2)', border: `1px solid ${rank === 0 ? PLAYER_BG[pi] + '40' : 'var(--border)'}` }}>
                          <div style={{ width: 28, height: 28, borderRadius: '50%', background: PLAYER_BG[pi], display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: 'white', margin: '0 auto 6px', fontSize: 11 }}>{t.name[0]?.toUpperCase()}</div>
                          <div style={{ fontSize: 12, fontWeight: 600, color: PLAYER_COLORS[pi] }}>{t.name}</div>
                          <div style={{ fontFamily: 'var(--display)', fontSize: 28, color: rank === 0 ? '#B8935A' : 'var(--text)' }}>{t.total}</div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                <div style={{ background: 'var(--surface)', border: '1px solid #f59e0b30', borderRadius: 12, overflow: 'hidden' }}>
                  <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', fontFamily: 'var(--display)', fontSize: 14, letterSpacing: 2, color: '#B8935A' }}>
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

        {activeTab === 'hist' && (
          <CourseStats courseId={r.course_id} currentRoundId={r.id} />
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
            background: 'var(--surface)', border: '1px solid rgba(122,46,46,0.18)',
            borderRadius: 14, padding: 24, maxWidth: 380, width: '100%'
          }}>
            <div style={{ fontFamily: 'var(--display)', fontSize: 18, letterSpacing: 2, color: '#7A2E2E', marginBottom: 8 }}>
              🗑 BORRAR PARTIDA
            </div>
            <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 16, lineHeight: 1.5 }}>
              Esta acción no se puede deshacer. Para confirmar, escribe el código:
            </div>
            <div style={{
              background: 'rgba(122,46,46,0.06)',
              border: '1px solid rgba(122,46,46,0.15)',
              borderRadius: 10, padding: '14px 16px', textAlign: 'center',
              marginBottom: 14
            }}>
              <div style={{ fontSize: 10, color: 'var(--text3)', letterSpacing: 2, marginBottom: 4 }}>CÓDIGO</div>
              <div style={{ fontFamily: 'var(--display)', fontSize: 36, letterSpacing: 8, color: '#7A2E2E', fontWeight: 700 }}>
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
                background: 'rgba(27,42,26,0.04)',
                border: `1px solid ${deleteError ? '#7A2E2E' : 'var(--border2)'}`,
                borderRadius: 8, color: 'var(--text)',
                padding: '12px 14px', fontSize: 18, letterSpacing: 6,
                textAlign: 'center', outline: 'none', marginBottom: 4,
                fontFamily: 'var(--display)'
              }}
            />
            {deleteError && (
              <div style={{ fontSize: 12, color: '#7A2E2E', marginBottom: 8 }}>Código incorrecto.</div>
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <button onClick={cancelDelete} disabled={deleting} style={{
                flex: 1, padding: '10px 14px',
                background: 'transparent', border: '1px solid var(--border2)',
                borderRadius: 8, color: 'var(--text2)', fontSize: 13, cursor: 'pointer'
              }}>Cancelar</button>
              <button onClick={confirmDelete} disabled={deleting || deleteInput.length !== 4} style={{
                flex: 1, padding: '10px 14px',
                background: deleteInput.length === 4 ? '#7A2E2E' : 'rgba(122,46,46,0.18)',
                border: 'none', borderRadius: 8,
                color: deleteInput.length === 4 ? '#F3E2E0' : '#8B9285',
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
