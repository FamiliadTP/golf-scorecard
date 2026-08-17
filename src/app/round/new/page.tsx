'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import TopBar from '@/components/TopBar'
import { supabase, Course, GameMode, Player } from '@/lib/supabase'

const MODES: { value: GameMode; label: string; desc: string; color: string; players: string; counts: number[] }[] = [
  { value: 'combinado_4', label: 'Ryder', desc: 'Dobles + 4 individuales cruzados', color: '#2F6B4F', players: '4 jugadores', counts: [4] },
  { value: 'stroke', label: 'Stroke Play', desc: 'Stableford con handicap', color: '#1B4332', players: '1–4 jugadores', counts: [1, 2, 3, 4] },
  { value: 'stroke_grupal', label: 'Stroke Play Grupal', desc: 'Todos contra todos + leaderboard en línea', color: '#2B5F7A', players: '3–4 jugadores', counts: [3, 4] },
  { value: 'matchplay_individual', label: 'Match Play', desc: 'Individual hoyo a hoyo', color: '#B8935A', players: '2 jugadores', counts: [2] },
  { value: 'matchplay_dobles', label: 'Match Play Dobles', desc: 'Mejor bola 2 vs 2', color: '#6B5B95', players: '4 jugadores', counts: [4] },
  { value: 'mejor_peor_suma', label: 'Mejor, Peor y Suma', desc: 'Parejas: best ball (2) + suma (1) + worst ball (1) por hoyo', color: '#2B5F7A', players: '4 jugadores', counts: [4] },
  { value: 'bismarck', label: 'Bismarck', desc: '6 puntos por hoyo (4-2-0)', color: '#7A2E2E', players: 'Exactamente 3', counts: [3] },
  { value: 'combinado_bismarck', label: 'Bismarck + Individuales', desc: 'Bismarck + 3 individuales', color: '#B8703C', players: 'Exactamente 3', counts: [3] },
]

// Categorías de número de jugadores para el paso previo del wizard de Modalidad.
const PLAYER_CATEGORIES: { key: '4' | '3' | '2' | '1'; label: string; count: number; defaultMode: GameMode }[] = [
  { key: '4', label: 'Cuarto', count: 4, defaultMode: 'combinado_4' },
  { key: '3', label: 'Trío', count: 3, defaultMode: 'combinado_bismarck' },
  { key: '2', label: '2 jugadores', count: 2, defaultMode: 'matchplay_individual' },
  { key: '1', label: '1 jugador', count: 1, defaultMode: 'stroke' },
]

const PLAYER_COLORS = ['#1B4332', '#B8935A', '#6B5B95', '#7A2E2E']
const PLAYER_BG = ['#3D7A5C', '#B8703C', '#6B5B95', '#7A2E2E']
const HCP_OPTIONS = [0, 75, 80, 100]

const inp: React.CSSProperties = {
  background: 'rgba(27,42,26,0.04)', border: '1px solid var(--border)',
  borderRadius: 8, color: 'var(--text)', fontFamily: 'var(--body)',
  padding: '10px 12px', fontSize: 14, outline: 'none', width: '100%'
}

function HcpPctSelector({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div style={{ display: 'flex', gap: 6 }}>
      {HCP_OPTIONS.map(opt => (
        <button key={opt} onClick={() => onChange(opt)} style={{
          padding: '6px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 13,
          border: '1px solid var(--border)',
          background: value === opt ? '#1B4332' : 'transparent',
          color: value === opt ? '#F1EEE4' : 'var(--text3)',
          fontWeight: value === opt ? 700 : 400,
        }}>{opt === 0 ? 'Sin HCP' : `${opt}%`}</button>
      ))}
    </div>
  )
}

function ModeSelector({ value, onChange, label }: { value: 'stroke' | 'matchplay'; onChange: (v: 'stroke' | 'matchplay') => void; label: string }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: 'var(--text3)', letterSpacing: 1, marginBottom: 6 }}>{label}</div>
      <div style={{ display: 'flex', gap: 6 }}>
        {(['stroke', 'matchplay'] as const).map(m => (
          <button key={m} onClick={() => onChange(m)} style={{
            padding: '6px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 13,
            border: '1px solid var(--border)',
            background: value === m ? '#1B4332' : 'transparent',
            color: value === m ? '#F1EEE4' : 'var(--text3)',
            fontWeight: value === m ? 700 : 400,
          }}>{m === 'stroke' ? 'Stroke Play' : 'Match Play'}</button>
        ))}
      </div>
    </div>
  )
}

export default function NewRound() {
  const router = useRouter()
  const [courses, setCourses] = useState<Course[]>([])
  const [courseId, setCourseId] = useState('')
  const [secondCourseId, setSecondCourseId] = useState('')
  const [playTwoLoops, setPlayTwoLoops] = useState(false)
  const [playerCategory, setPlayerCategory] = useState<'4' | '3' | '2' | '1'>('4')
  const [mode, setMode] = useState<GameMode>('combinado_4')
  const [holesPlayed, setHolesPlayed] = useState(18)
  const [startHole, setStartHole] = useState(1)
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [players, setPlayers] = useState([
    { name: '', handicap: 18, team: 1 },
    { name: '', handicap: 18, team: 2 },
  ])
  const [hcpPct, setHcpPct] = useState(100)
  const [doblesMode, setDoblesMode] = useState<'stroke' | 'matchplay'>('matchplay')
  const [doblesHcpPct, setDoblesHcpPct] = useState(100)
  const [individualMode, setIndividualMode] = useState<'stroke' | 'matchplay'>('matchplay')
  const [individualHcpPct, setIndividualHcpPct] = useState(100)
  const [bismarckHcpPct, setBismarckHcpPct] = useState(100)
  const [grupal, setGrupal] = useState(false)
  const [competitionName, setCompetitionName] = useState('')
  const [lockedName, setLockedName] = useState(false)
  const [sideMatch, setSideMatch] = useState<'none' | 'dobles' | 'singles'>('none')
  const [sideHcpPct, setSideHcpPct] = useState(100)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    supabase.from('courses').select('*, holes(*)').then(({ data: c }) => {
      const sorted = [...(c || [])].sort((a: any, b: any) =>
        (a.club || a.name).localeCompare(b.club || b.name, 'es'))
      setCourses(sorted as any)
      if (sorted.length > 0) { setCourseId(sorted[0].id); setHolesPlayed((sorted[0] as any).holes_count || 18) }
    })
  }, [])

  const isStroke = mode === 'stroke'
  const isStrokeLike = mode === 'stroke' || mode === 'stroke_grupal'
  const needsTeams = mode === 'combinado_4' || mode === 'matchplay_dobles' || mode === 'mejor_peor_suma' || (mode === 'stroke_grupal' && sideMatch === 'dobles')

  const selectedCourse: any = courses.find(c => c.id === courseId)
  const isNineType = selectedCourse?.holes_count === 9
  const nineCourses: any[] = courses.filter((c: any) => c.holes_count === 9)
  // En el selector se muestra el nombre corto (el que va después del guión, es
  // decir el club); si no hay club definido, se usa el nombre del campo.
  const courseLabel = (c: any) =>
    `${c.club || c.name}${c.loop_label ? ` · ${c.loop_label}` : ''}`

  // Ajusta vueltas / segunda vuelta según el tipo de campo seleccionado.
  useEffect(() => {
    const c: any = courses.find(x => x.id === courseId)
    if (!c) return
    if (c.holes_count === 9) {
      if (playTwoLoops) {
        setHolesPlayed(18)
        setSecondCourseId(prev => prev || courseId)
      } else {
        setHolesPlayed(9)
        setSecondCourseId('')
      }
    } else {
      setPlayTwoLoops(false)
      setSecondCourseId('')
      setHolesPlayed(c.holes_count || 18)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId, playTwoLoops, courses])

  // Fixed player counts per mode
  const fixedCount: Record<GameMode, number | null> = {
    stroke: null, matchplay_individual: 2, matchplay_dobles: 4,
    bismarck: 3, combinado_4: 4, combinado_bismarck: 3, mejor_peor_suma: 4,
    stroke_grupal: null
  }

  // Modalidades disponibles para la categoría de número de jugadores elegida.
  const categoryModes = MODES.filter(m => m.counts.includes(parseInt(playerCategory)))

  // Al cambiar la categoría de jugadores: si la modalidad actual ya no aplica,
  // cae a la modalidad por defecto de esa categoría (Cuarto→Ryder,
  // Trío→Bismarck+Individuales, 2→Match Play, 1→Stroke Play).
  useEffect(() => {
    const category = PLAYER_CATEGORIES.find(c => c.key === playerCategory)!
    if (!categoryModes.some(m => m.value === mode)) setMode(category.defaultMode)
    // Para modos de conteo flexible (Stroke / Stroke Grupal) hay que fijar el
    // número de jugadores explícitamente a la categoría elegida.
    if (fixedCount[mode] === null) {
      setPlayers(prev => {
        const n = category.count
        const base = prev.slice(0, n)
        while (base.length < n) base.push({ name: '', handicap: 18, team: base.length < 2 ? 1 : 2 })
        return base
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerCategory])

  useEffect(() => {
    const needed = fixedCount[mode]
    if (needed !== null) {
      setPlayers(prev => {
        const base = prev.slice(0, needed)
        while (base.length < needed) base.push({ name: '', handicap: 18, team: base.length < 2 ? 1 : 2 })
        if (mode === 'combinado_4' || mode === 'matchplay_dobles' || mode === 'mejor_peor_suma') {
          return base.map((p, i) => ({ ...p, team: i < 2 ? 1 : 2 }))
        }
        return base
      })
    }
  }, [mode])

  // Stroke Grupal: mínimo 3 jugadores; si el side game es Dobles, forzar 4 y equipos 2/2.
  useEffect(() => {
    if (mode !== 'stroke_grupal') return
    setPlayers(prev => {
      let base = [...prev]
      const min = sideMatch === 'dobles' ? 4 : 3
      while (base.length < min) base.push({ name: '', handicap: 18, team: base.length < 2 ? 1 : 2 })
      if (sideMatch === 'dobles') base = base.slice(0, 4).map((p, i) => ({ ...p, team: i < 2 ? 1 : 2 }))
      return base
    })
  }, [mode, sideMatch])

  // Stroke Grupal + Grupal=Sí: hereda el nombre de competencia del primer grupal
  // del día en la misma cancha (merge automático por cancha + fecha + modalidad).
  useEffect(() => {
    if (mode !== 'stroke_grupal' || !grupal || !courseId || !date) { setLockedName(false); return }
    let cancel = false
    supabase.from('rounds')
      .select('competition_name')
      .eq('mode', 'stroke_grupal').eq('grupal', true)
      .eq('course_id', courseId).eq('date', date)
      .not('competition_name', 'is', null)
      .order('created_at', { ascending: true }).limit(1)
      .then(({ data }) => {
        if (cancel) return
        const found = data && data.length ? (data[0] as any).competition_name : null
        if (found) { setCompetitionName(found); setLockedName(true) }
        else setLockedName(false)
      })
    return () => { cancel = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, grupal, courseId, date])

  // El hoyo de salida no puede superar el total de hoyos que se van a jugar.
  useEffect(() => {
    if (startHole > holesPlayed) setStartHole(1)
  }, [holesPlayed, startHole])

  const updatePlayer = (i: number, field: string, val: any) =>
    setPlayers(prev => prev.map((p, idx) => idx === i ? { ...p, [field]: val } : p))

  const addPlayer = () => {
    if (players.length >= 4) return
    setPlayers(prev => [...prev, { name: '', handicap: 18, team: prev.length < 2 ? 1 : 2 }])
  }

  const minPlayers = mode === 'stroke_grupal' ? (sideMatch === 'dobles' ? 4 : 3) : 1
  const removePlayer = (i: number) => {
    if (players.length <= minPlayers) return
    setPlayers(prev => prev.filter((_, idx) => idx !== i))
  }

  const teamBalanced = !needsTeams ||
    (players.filter(p => p.team === 1).length === 2 && players.filter(p => p.team === 2).length === 2)

  const isValid = () => {
    if (!courseId) return false
    if (playTwoLoops && !secondCourseId) return false
    if (!teamBalanced) return false
    if (mode === 'stroke_grupal') {
      if (players.length < (sideMatch === 'dobles' ? 4 : 3)) return false
      if (grupal && !competitionName.trim()) return false
    }
    const needed = fixedCount[mode]
    if (needed !== null && players.length !== needed) return false
    return players.every(p => p.name.trim())
  }

  const handleStart = async () => {
    if (!isValid() || saving) return
    setSaving(true)
    const roundData: any = { course_id: courseId, second_course_id: playTwoLoops ? secondCourseId : null, mode, holes_played: holesPlayed, start_hole: startHole, date }
    if (['stroke', 'matchplay_individual', 'matchplay_dobles', 'bismarck', 'mejor_peor_suma', 'stroke_grupal'].includes(mode)) roundData.hcp_pct = hcpPct
    if (mode === 'stroke_grupal') {
      roundData.grupal = grupal
      roundData.competition_name = grupal ? competitionName.trim() : null
      roundData.side_match = sideMatch
      roundData.side_hcp_pct = sideHcpPct
    }
    if (mode === 'combinado_4') {
      roundData.dobles_mode = doblesMode; roundData.dobles_hcp_pct = doblesHcpPct
      roundData.individual_mode = individualMode; roundData.individual_hcp_pct = individualHcpPct
    }
    if (mode === 'combinado_bismarck') {
      roundData.bismarck_hcp_pct = bismarckHcpPct
      roundData.individual_mode = individualMode; roundData.individual_hcp_pct = individualHcpPct
    }
    const { data: round, error } = await supabase.from('rounds').insert(roundData).select().single()
    if (error || !round) { setSaving(false); return }
    for (let i = 0; i < players.length; i++) {
      const p = players[i]
      await supabase.from('round_players').insert({ round_id: round.id, name: p.name.trim(), handicap: p.handicap, position: i, team: p.team })
      // Upsert in players table
      await supabase.from('players').upsert({ name: p.name.trim(), last_handicap: p.handicap }, { onConflict: 'name' })
    }
    router.push(`/round/${round.id}`)
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <TopBar title="Nueva Partida" />

      <main style={{ maxWidth: 640, margin: '0 auto', padding: '24px 16px', display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* 1. CAMPO */}
        <section style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 20 }}>
          <h2 style={{ fontFamily: 'var(--display)', fontSize: 14, letterSpacing: 2, color: 'var(--text3)', marginBottom: 14 }}>CAMPO</h2>
          {courses.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 20, color: 'var(--text3)' }}>
              <p>No hay campos guardados.</p>
              <Link href="/course/new" style={{ color: '#1B4332', fontWeight: 600 }}>Crear campo →</Link>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <label style={{ fontSize: 11, color: 'var(--text3)', letterSpacing: 1, display: 'block', marginBottom: 6 }}>CAMPO</label>
                <select value={courseId} onChange={e => { setCourseId(e.target.value); const c = courses.find(c => c.id === e.target.value); if (c) setHolesPlayed((c as any).holes_count || 18) }} style={{ ...inp, color: '#22301F' }}>
                  {courses.map(c => <option key={c.id} value={c.id} style={{ background: '#EDEAD8', color: '#22301F' }}>{courseLabel(c)}</option>)}
                </select>
              </div>

              {isNineType && (
                <div>
                  <label style={{ fontSize: 11, color: 'var(--text3)', letterSpacing: 1, display: 'block', marginBottom: 6 }}>VUELTAS</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {[
                      { two: false, label: '1 vuelta (9)' },
                      { two: true, label: '2 vueltas (18)' },
                    ].map(o => (
                      <button key={o.label} onClick={() => setPlayTwoLoops(o.two)} style={{
                        padding: '8px 18px', borderRadius: 8, border: '1px solid var(--border)',
                        background: playTwoLoops === o.two ? '#1B4332' : 'transparent',
                        color: playTwoLoops === o.two ? '#F1EEE4' : 'var(--text3)',
                        fontWeight: 600, fontSize: 14, cursor: 'pointer'
                      }}>{o.label}</button>
                    ))}
                  </div>
                </div>
              )}

              {isNineType && playTwoLoops && (
                <div>
                  <label style={{ fontSize: 11, color: 'var(--text3)', letterSpacing: 1, display: 'block', marginBottom: 6 }}>SEGUNDA VUELTA</label>
                  <select value={secondCourseId} onChange={e => setSecondCourseId(e.target.value)} style={{ ...inp, color: '#22301F' }}>
                    {nineCourses.map(c => <option key={c.id} value={c.id} style={{ background: '#EDEAD8', color: '#22301F' }}>{courseLabel(c)}</option>)}
                  </select>
                  <p style={{ fontSize: 12, color: 'var(--text3)', marginTop: 6, lineHeight: 1.4 }}>
                    1ª vuelta = ventajas impares · 2ª vuelta = ventajas pares. Puedes repetir la
                    misma vuelta dos veces.
                  </p>
                </div>
              )}

              <div style={{ display: 'flex', gap: 10 }}>
                {!isNineType && (
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: 11, color: 'var(--text3)', letterSpacing: 1, display: 'block', marginBottom: 6 }}>HOYOS</label>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {[9, 18].map(n => (
                        <button key={n} onClick={() => setHolesPlayed(n)} style={{
                          padding: '8px 20px', borderRadius: 8, border: '1px solid var(--border)',
                          background: holesPlayed === n ? '#1B4332' : 'transparent',
                          color: holesPlayed === n ? '#F1EEE4' : 'var(--text3)',
                          fontWeight: 600, fontSize: 14, cursor: 'pointer'
                        }}>{n}</button>
                      ))}
                    </div>
                  </div>
                )}
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 11, color: 'var(--text3)', letterSpacing: 1, display: 'block', marginBottom: 6 }}>FECHA</label>
                  <input type="date" value={date} onChange={e => setDate(e.target.value)} style={inp} />
                </div>
              </div>

              <div>
                <label style={{ fontSize: 11, color: 'var(--text3)', letterSpacing: 1, display: 'block', marginBottom: 6 }}>HOYO DE SALIDA</label>
                <select value={startHole} onChange={e => setStartHole(parseInt(e.target.value))} style={{ ...inp, color: '#22301F', maxWidth: 140 }}>
                  {Array.from({ length: holesPlayed }, (_, i) => i + 1).map(n => (
                    <option key={n} value={n} style={{ background: '#EDEAD8', color: '#22301F' }}>{n}</option>
                  ))}
                </select>
                <p style={{ fontSize: 12, color: 'var(--text3)', marginTop: 6, lineHeight: 1.4 }}>
                  Por defecto 1. Útil en días de alta demanda o salida simultánea, cuando el
                  grupo empieza en un hoyo distinto al 1. La tarjeta se mantiene igual; solo
                  marca ese hoyo para quien anota.
                </p>
              </div>
            </div>
          )}
        </section>

        {/* 2. JUGADORES — número de jugadores + nombres, sin HCP aquí */}
        <section style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <h2 style={{ fontFamily: 'var(--display)', fontSize: 14, letterSpacing: 2, color: 'var(--text3)' }}>JUGADORES</h2>
            {false && isStrokeLike && players.length < 4 && (
              <button onClick={addPlayer} style={{
                background: 'transparent', border: '1px solid var(--border2)',
                borderRadius: 6, color: 'var(--text2)', padding: '5px 12px', fontSize: 13, cursor: 'pointer'
              }}>＋ Agregar</button>
            )}
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 11, color: 'var(--text3)', letterSpacing: 1, display: 'block', marginBottom: 6 }}>NÚMERO DE JUGADORES</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {PLAYER_CATEGORIES.map(c => (
                <button key={c.key} onClick={() => setPlayerCategory(c.key)} style={{
                  padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border)',
                  background: playerCategory === c.key ? '#1B4332' : 'transparent',
                  color: playerCategory === c.key ? '#F1EEE4' : 'var(--text3)',
                  fontWeight: 600, fontSize: 14, cursor: 'pointer'
                }}>{c.label}</button>
              ))}
            </div>
          </div>

          {needsTeams && (
            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
              {[1, 2].map(t => (
                <div key={t} style={{ flex: 1, padding: '8px 12px', borderRadius: 8, background: `${PLAYER_COLORS[t === 1 ? 0 : 2]}10`, border: `1px solid ${PLAYER_COLORS[t === 1 ? 0 : 2]}30`, fontSize: 12, color: PLAYER_COLORS[t === 1 ? 0 : 2] }}>
                  <strong>Team {t}:</strong> {players.filter(p => p.team === t).map(p => p.name || '…').join(' & ') || '—'}
                </div>
              ))}
            </div>
          )}

          {needsTeams && !teamBalanced && (
            <div style={{ marginBottom: 14, padding: '8px 12px', borderRadius: 8, background: 'rgba(122,46,46,0.06)', border: '1px solid rgba(122,46,46,0.15)', fontSize: 12, color: '#7A2E2E' }}>
              Cada equipo debe tener 2 jugadores. Usa los botones T1 / T2 para asignarlos.
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {players.map((p, i) => {
              const isDoubles = needsTeams
              const teamColor = (t: number) => PLAYER_COLORS[t === 1 ? 0 : 2]
              const teamBg = (t: number) => PLAYER_BG[t === 1 ? 0 : 2]
              return (
              <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '10px 14px', borderRadius: 10, background: 'rgba(27,42,26,0.03)', border: '1px solid var(--border)' }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: isDoubles ? teamBg(p.team) : PLAYER_BG[i], display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12, color: 'white', flexShrink: 0 }}>
                  {isDoubles ? `T${p.team}` : (i + 1)}
                </div>
                <input
                  value={p.name}
                  onChange={e => updatePlayer(i, 'name', e.target.value)}
                  placeholder="Nombre del jugador..."
                  style={{ ...inp, padding: '8px 12px', flex: 1 }}
                />
                {isDoubles && (
                  <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                    {[1, 2].map(t => (
                      <button key={t} onClick={() => updatePlayer(i, 'team', t)} style={{
                        padding: '7px 11px', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                        border: `1px solid ${p.team === t ? teamColor(t) : 'var(--border)'}`,
                        background: p.team === t ? teamColor(t) : 'transparent',
                        color: p.team === t ? '#F1EEE4' : 'var(--text3)'
                      }}>T{t}</button>
                    ))}
                  </div>
                )}
                {false && isStrokeLike && players.length > minPlayers && (
                  <button onClick={() => removePlayer(i)} style={{
                    background: 'rgba(122,46,46,0.08)', border: '1px solid rgba(122,46,46,0.12)',
                    color: '#7A2E2E', borderRadius: 6, padding: '7px 10px',
                    cursor: 'pointer', fontSize: 13, flexShrink: 0
                  }}>✕</button>
                )}
              </div>
              )
            })}
          </div>
        </section>

        {/* 3. HANDICAP individual por jugador */}
        <section style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 20 }}>
          <h2 style={{ fontFamily: 'var(--display)', fontSize: 14, letterSpacing: 2, color: 'var(--text3)', marginBottom: 14 }}>HANDICAP</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {players.map((p, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 10, background: 'rgba(27,42,26,0.03)', border: '1px solid var(--border)' }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: PLAYER_BG[i], display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 11, color: 'white', flexShrink: 0 }}>
                  {p.name ? p.name[0].toUpperCase() : (i + 1)}
                </div>
                <span style={{ flex: 1, fontSize: 14, color: p.name ? PLAYER_COLORS[i] : 'var(--text3)', fontWeight: p.name ? 600 : 400 }}>
                  {p.name || `Jugador ${i + 1}`}
                </span>
                {needsTeams && (
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 6, marginRight: 4, color: '#F1EEE4', background: PLAYER_COLORS[p.team === 1 ? 0 : 2] }}>
                    T{p.team}
                  </span>
                )}
                <label style={{ fontSize: 11, color: 'var(--text3)', letterSpacing: 1, marginRight: 6 }}>HCP</label>
                <input
                  type="number" min={0} max={54}
                  value={p.handicap}
                  onChange={e => updatePlayer(i, 'handicap', parseInt(e.target.value) || 0)}
                  onFocus={e => e.target.select()}
                  style={{ ...inp, width: 64, padding: '7px 10px', textAlign: 'center' }}
                />
              </div>
            ))}
          </div>
        </section>

        {/* 5. MODALIDAD — filtrada por el número de jugadores elegido arriba */}
        <section style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 20 }}>
          <h2 style={{ fontFamily: 'var(--display)', fontSize: 14, letterSpacing: 2, color: 'var(--text3)', marginBottom: 14 }}>MODALIDAD</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {categoryModes.map(m => (
              <button key={m.value} onClick={() => setMode(m.value)} style={{
                display: 'flex', alignItems: 'center', gap: 14, padding: '12px 14px',
                borderRadius: 10, cursor: 'pointer', border: `1px solid ${mode === m.value ? m.color + '60' : 'var(--border)'}`,
                background: mode === m.value ? `${m.color}12` : 'transparent', textAlign: 'left'
              }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: mode === m.value ? m.color : 'var(--border2)', flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, color: mode === m.value ? m.color : 'var(--text)' }}>{m.label}</div>
                  <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>{m.desc} · {m.players}</div>
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* 6. % HANDICAP */}

        {/* Modalidades simples */}
        {['stroke', 'matchplay_individual', 'matchplay_dobles', 'bismarck', 'mejor_peor_suma', 'stroke_grupal'].includes(mode) && (
          <section style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 20 }}>
            <h2 style={{ fontFamily: 'var(--display)', fontSize: 14, letterSpacing: 2, color: 'var(--text3)', marginBottom: 14 }}>% HANDICAP</h2>
            <HcpPctSelector value={hcpPct} onChange={setHcpPct} />
          </section>
        )}

        {/* Config Stroke Grupal */}
        {mode === 'stroke_grupal' && (
          <section style={{ background: 'var(--surface)', border: '1px solid #38bdf830', borderRadius: 12, padding: 20 }}>
            <h2 style={{ fontFamily: 'var(--display)', fontSize: 14, letterSpacing: 2, color: '#2B5F7A', marginBottom: 16 }}>COMPETENCIA GRUPAL</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* Switch Grupal Sí/No */}
              <div>
                <div style={{ fontSize: 11, color: 'var(--text3)', letterSpacing: 1, marginBottom: 6 }}>¿GRUPAL?</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {[{ v: true, l: 'Sí' }, { v: false, l: 'No' }].map(o => (
                    <button key={o.l} onClick={() => setGrupal(o.v)} style={{
                      padding: '8px 22px', borderRadius: 8, border: '1px solid var(--border)',
                      background: grupal === o.v ? '#2B5F7A' : 'transparent',
                      color: grupal === o.v ? '#E9EFEA' : 'var(--text3)',
                      fontWeight: 600, fontSize: 14, cursor: 'pointer'
                    }}>{o.l}</button>
                  ))}
                </div>
                <p style={{ fontSize: 12, color: 'var(--text3)', marginTop: 6, lineHeight: 1.4 }}>
                  Si es Grupal, todos los cuartos/tríos de la misma cancha, fecha y modalidad
                  entran al mismo leaderboard automáticamente.
                </p>
              </div>

              {/* Nombre de la competencia */}
              {grupal && (
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', letterSpacing: 1, marginBottom: 6 }}>NOMBRE DE LA COMPETENCIA</div>
                  <input
                    value={competitionName}
                    onChange={e => setCompetitionName(e.target.value)}
                    placeholder="Ej: Copa Las Brisas"
                    disabled={lockedName}
                    style={{ ...inp, opacity: lockedName ? 0.7 : 1 }}
                  />
                  <p style={{ fontSize: 12, color: lockedName ? '#2B5F7A' : 'var(--text3)', marginTop: 6, lineHeight: 1.4 }}>
                    {lockedName
                      ? 'Ya existe una competencia grupal este día en esta cancha. Se hereda su nombre.'
                      : 'Este es el primer grupal del día en esta cancha; los siguientes heredarán este nombre.'}
                  </p>
                </div>
              )}

              {/* Partidos paralelos (side game) */}
              <div style={{ padding: 14, background: 'rgba(184,147,90,0.08)', borderRadius: 10, border: '1px solid #f59e0b20' }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#B8935A', marginBottom: 10 }}>
                  Partidos paralelos (opcional, solo dentro del cuarto/trío)
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                  {[
                    { v: 'none' as const, l: 'Ninguno', show: true },
                    { v: 'dobles' as const, l: 'Dobles (2v2)', show: players.length === 4 || sideMatch === 'dobles' },
                    { v: 'singles' as const, l: 'Singles — todos contra todos', show: true },
                  ].filter(o => o.show).map(o => (
                    <button key={o.v} onClick={() => setSideMatch(o.v)} style={{
                      padding: '7px 14px', borderRadius: 8, border: '1px solid var(--border)',
                      background: sideMatch === o.v ? '#B8935A' : 'transparent',
                      color: sideMatch === o.v ? '#F6ECDA' : 'var(--text3)',
                      fontWeight: sideMatch === o.v ? 700 : 400, fontSize: 13, cursor: 'pointer'
                    }}>{o.l}</button>
                  ))}
                </div>
                {sideMatch !== 'none' && (
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text3)', letterSpacing: 1, marginBottom: 6 }}>% HANDICAP PARTIDOS</div>
                    <HcpPctSelector value={sideHcpPct} onChange={setSideHcpPct} />
                  </div>
                )}
                <p style={{ fontSize: 12, color: 'var(--text3)', marginTop: 8, lineHeight: 1.4 }}>
                  Los partidos paralelos corren en match play y no afectan el leaderboard de stroke play.
                  {sideMatch === 'dobles' && ' Dobles requiere 4 jugadores y equipos 2/2.'}
                </p>
              </div>
            </div>
          </section>
        )}

        {/* Config combinado 4 (Ryder) */}
        {mode === 'combinado_4' && (
          <section style={{ background: 'var(--surface)', border: '1px solid #34d39930', borderRadius: 12, padding: 20 }}>
            <h2 style={{ fontFamily: 'var(--display)', fontSize: 14, letterSpacing: 2, color: '#2F6B4F', marginBottom: 16 }}>% HANDICAP POR APUESTA</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ padding: 14, background: 'rgba(47,107,79,0.08)', borderRadius: 10, border: '1px solid #34d39920' }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#2F6B4F', marginBottom: 10 }}>Dobles (T1 vs T2)</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <ModeSelector value={doblesMode} onChange={setDoblesMode} label="MODALIDAD DOBLES" />
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text3)', letterSpacing: 1, marginBottom: 6 }}>% HANDICAP DOBLES</div>
                    <HcpPctSelector value={doblesHcpPct} onChange={setDoblesHcpPct} />
                  </div>
                </div>
              </div>
              <div style={{ padding: 14, background: 'rgba(184,147,90,0.08)', borderRadius: 10, border: '1px solid #f59e0b20' }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#B8935A', marginBottom: 10 }}>Individuales (4 partidos cruzados)</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <ModeSelector value={individualMode} onChange={setIndividualMode} label="MODALIDAD INDIVIDUALES" />
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text3)', letterSpacing: 1, marginBottom: 6 }}>% HANDICAP INDIVIDUALES</div>
                    <HcpPctSelector value={individualHcpPct} onChange={setIndividualHcpPct} />
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Config combinado bismarck */}
        {mode === 'combinado_bismarck' && (
          <section style={{ background: 'var(--surface)', border: '1px solid #fb923c30', borderRadius: 12, padding: 20 }}>
            <h2 style={{ fontFamily: 'var(--display)', fontSize: 14, letterSpacing: 2, color: '#B8703C', marginBottom: 16 }}>% HANDICAP POR APUESTA</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ padding: 14, background: 'rgba(122,46,46,0.05)', borderRadius: 10, border: '1px solid #f8717120' }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#7A2E2E', marginBottom: 10 }}>Bismarck</div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', letterSpacing: 1, marginBottom: 6 }}>% HANDICAP BISMARCK</div>
                  <HcpPctSelector value={bismarckHcpPct} onChange={setBismarckHcpPct} />
                </div>
              </div>
              <div style={{ padding: 14, background: 'rgba(184,147,90,0.08)', borderRadius: 10, border: '1px solid #f59e0b20' }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#B8935A', marginBottom: 10 }}>Individuales (3 partidos cruzados)</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <ModeSelector value={individualMode} onChange={setIndividualMode} label="MODALIDAD INDIVIDUALES" />
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text3)', letterSpacing: 1, marginBottom: 6 }}>% HANDICAP INDIVIDUALES</div>
                    <HcpPctSelector value={individualHcpPct} onChange={setIndividualHcpPct} />
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        <button onClick={handleStart} disabled={!isValid() || saving} style={{
          width: '100%', padding: 16,
          background: !isValid() || saving ? 'var(--border)' : '#1B4332',
          color: !isValid() || saving ? 'var(--text3)' : '#F1EEE4',
          border: 'none', borderRadius: 12,
          fontFamily: 'var(--display)', fontSize: 18, letterSpacing: 3,
          cursor: !isValid() || saving ? 'not-allowed' : 'pointer'
        }}>
          {saving ? 'INICIANDO…' : 'INICIAR PARTIDA'}
        </button>
      </main>
    </div>
  )
}
