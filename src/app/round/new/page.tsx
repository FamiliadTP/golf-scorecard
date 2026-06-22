'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import TopBar from '@/components/TopBar'
import { supabase, Course, GameMode, Player } from '@/lib/supabase'

const MODES: { value: GameMode; label: string; desc: string; color: string; players: string }[] = [
  { value: 'combinado_4', label: 'Ryder', desc: 'Dobles + 4 individuales cruzados', color: '#34d399', players: '4 jugadores' },
  { value: 'stroke', label: 'Stroke Play', desc: 'Stableford con handicap', color: '#2dd4bf', players: '1–4 jugadores' },
  { value: 'matchplay_individual', label: 'Match Play', desc: 'Individual hoyo a hoyo', color: '#f59e0b', players: '2 jugadores' },
  { value: 'matchplay_dobles', label: 'Match Play Dobles', desc: 'Mejor bola 2 vs 2', color: '#a78bfa', players: '4 jugadores' },
  { value: 'mejor_peor_suma', label: 'Mejor, Peor y Suma', desc: 'Parejas: best ball (2) + suma (1) + worst ball (1) por hoyo', color: '#22d3ee', players: '4 jugadores' },
  { value: 'bismarck', label: 'Bismarck', desc: '6 puntos por hoyo (4-2-0)', color: '#f87171', players: 'Exactamente 3' },
  { value: 'combinado_bismarck', label: 'Bismarck + Individuales', desc: 'Bismarck + 3 individuales', color: '#fb923c', players: 'Exactamente 3' },
]

const PLAYER_COLORS = ['#2dd4bf', '#f59e0b', '#a78bfa', '#f87171']
const PLAYER_BG = ['#0d9488', '#d97706', '#7c3aed', '#dc2626']
const HCP_OPTIONS = [0, 75, 80, 100]

const inp: React.CSSProperties = {
  background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)',
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
          background: value === opt ? '#2dd4bf' : 'transparent',
          color: value === opt ? '#071209' : 'var(--text3)',
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
            background: value === m ? '#2dd4bf' : 'transparent',
            color: value === m ? '#071209' : 'var(--text3)',
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
  const [mode, setMode] = useState<GameMode>('stroke')
  const [holesPlayed, setHolesPlayed] = useState(18)
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
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    supabase.from('courses').select('*, holes(*)').order('name').then(({ data: c }) => {
      setCourses((c || []) as any)
      if (c && c.length > 0) { setCourseId(c[0].id); setHolesPlayed((c[0] as any).holes_count || 18) }
    })
  }, [])

  const isStroke = mode === 'stroke'

  const selectedCourse: any = courses.find(c => c.id === courseId)
  const isNineType = selectedCourse?.holes_count === 9
  const nineCourses: any[] = courses.filter((c: any) => c.holes_count === 9)
  const courseLabel = (c: any) =>
    `${c.name}${c.loop_label ? ` · ${c.loop_label}` : ''}${c.club ? ` — ${c.club}` : ''}`

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
    bismarck: 3, combinado_4: 4, combinado_bismarck: 3, mejor_peor_suma: 4
  }

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

  const updatePlayer = (i: number, field: string, val: any) =>
    setPlayers(prev => prev.map((p, idx) => idx === i ? { ...p, [field]: val } : p))

  const addPlayer = () => {
    if (players.length >= 4) return
    setPlayers(prev => [...prev, { name: '', handicap: 18, team: 1 }])
  }

  const removePlayer = (i: number) => {
    if (players.length <= 1) return
    setPlayers(prev => prev.filter((_, idx) => idx !== i))
  }

  const teamBalanced = !(mode === 'combinado_4' || mode === 'matchplay_dobles' || mode === 'mejor_peor_suma') ||
    (players.filter(p => p.team === 1).length === 2 && players.filter(p => p.team === 2).length === 2)

  const isValid = () => {
    if (!courseId) return false
    if (playTwoLoops && !secondCourseId) return false
    if (!teamBalanced) return false
    const needed = fixedCount[mode]
    if (needed !== null && players.length !== needed) return false
    return players.every(p => p.name.trim())
  }

  const handleStart = async () => {
    if (!isValid() || saving) return
    setSaving(true)
    const roundData: any = { course_id: courseId, second_course_id: playTwoLoops ? secondCourseId : null, mode, holes_played: holesPlayed, date }
    if (['stroke', 'matchplay_individual', 'matchplay_dobles', 'bismarck', 'mejor_peor_suma'].includes(mode)) roundData.hcp_pct = hcpPct
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
              <Link href="/course/new" style={{ color: '#2dd4bf', fontWeight: 600 }}>Crear campo →</Link>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <label style={{ fontSize: 11, color: 'var(--text3)', letterSpacing: 1, display: 'block', marginBottom: 6 }}>CAMPO</label>
                <select value={courseId} onChange={e => { setCourseId(e.target.value); const c = courses.find(c => c.id === e.target.value); if (c) setHolesPlayed((c as any).holes_count || 18) }} style={{ ...inp, color: '#e2f5e9' }}>
                  {courses.map(c => <option key={c.id} value={c.id} style={{ background: '#0f2318', color: '#e2f5e9' }}>{courseLabel(c)}</option>)}
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
                        background: playTwoLoops === o.two ? '#2dd4bf' : 'transparent',
                        color: playTwoLoops === o.two ? '#071209' : 'var(--text3)',
                        fontWeight: 600, fontSize: 14, cursor: 'pointer'
                      }}>{o.label}</button>
                    ))}
                  </div>
                </div>
              )}

              {isNineType && playTwoLoops && (
                <div>
                  <label style={{ fontSize: 11, color: 'var(--text3)', letterSpacing: 1, display: 'block', marginBottom: 6 }}>SEGUNDA VUELTA</label>
                  <select value={secondCourseId} onChange={e => setSecondCourseId(e.target.value)} style={{ ...inp, color: '#e2f5e9' }}>
                    {nineCourses.map(c => <option key={c.id} value={c.id} style={{ background: '#0f2318', color: '#e2f5e9' }}>{courseLabel(c)}</option>)}
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
                          background: holesPlayed === n ? '#2dd4bf' : 'transparent',
                          color: holesPlayed === n ? '#071209' : 'var(--text3)',
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
            </div>
          )}
        </section>

        {/* 2. MODALIDAD */}
        <section style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 20 }}>
          <h2 style={{ fontFamily: 'var(--display)', fontSize: 14, letterSpacing: 2, color: 'var(--text3)', marginBottom: 14 }}>MODALIDAD</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {MODES.map(m => (
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

        {/* 3. JUGADORES — solo nombres, sin HCP aquí */}
        <section style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <h2 style={{ fontFamily: 'var(--display)', fontSize: 14, letterSpacing: 2, color: 'var(--text3)' }}>JUGADORES</h2>
            {isStroke && players.length < 4 && (
              <button onClick={addPlayer} style={{
                background: 'transparent', border: '1px solid var(--border2)',
                borderRadius: 6, color: 'var(--text2)', padding: '5px 12px', fontSize: 13, cursor: 'pointer'
              }}>＋ Agregar</button>
            )}
          </div>

          {(mode === 'combinado_4' || mode === 'matchplay_dobles' || mode === 'mejor_peor_suma') && (
            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
              {[1, 2].map(t => (
                <div key={t} style={{ flex: 1, padding: '8px 12px', borderRadius: 8, background: `${PLAYER_COLORS[t === 1 ? 0 : 2]}10`, border: `1px solid ${PLAYER_COLORS[t === 1 ? 0 : 2]}30`, fontSize: 12, color: PLAYER_COLORS[t === 1 ? 0 : 2] }}>
                  <strong>Team {t}:</strong> {players.filter(p => p.team === t).map(p => p.name || '…').join(' & ') || '—'}
                </div>
              ))}
            </div>
          )}

          {(mode === 'combinado_4' || mode === 'matchplay_dobles' || mode === 'mejor_peor_suma') && !teamBalanced && (
            <div style={{ marginBottom: 14, padding: '8px 12px', borderRadius: 8, background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.25)', fontSize: 12, color: '#f87171' }}>
              Cada equipo debe tener 2 jugadores. Usa los botones T1 / T2 para asignarlos.
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {players.map((p, i) => {
              const isDoubles = mode === 'combinado_4' || mode === 'matchplay_dobles' || mode === 'mejor_peor_suma'
              const teamColor = (t: number) => PLAYER_COLORS[t === 1 ? 0 : 2]
              const teamBg = (t: number) => PLAYER_BG[t === 1 ? 0 : 2]
              return (
              <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '10px 14px', borderRadius: 10, background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)' }}>
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
                        color: p.team === t ? '#071209' : 'var(--text3)'
                      }}>T{t}</button>
                    ))}
                  </div>
                )}
                {isStroke && players.length > 1 && (
                  <button onClick={() => removePlayer(i)} style={{
                    background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.2)',
                    color: '#f87171', borderRadius: 6, padding: '7px 10px',
                    cursor: 'pointer', fontSize: 13, flexShrink: 0
                  }}>✕</button>
                )}
              </div>
              )
            })}
          </div>
        </section>

        {/* 4. HANDICAP individual por jugador */}
        <section style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 20 }}>
          <h2 style={{ fontFamily: 'var(--display)', fontSize: 14, letterSpacing: 2, color: 'var(--text3)', marginBottom: 14 }}>HANDICAP</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {players.map((p, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 10, background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)' }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: PLAYER_BG[i], display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 11, color: 'white', flexShrink: 0 }}>
                  {p.name ? p.name[0].toUpperCase() : (i + 1)}
                </div>
                <span style={{ flex: 1, fontSize: 14, color: p.name ? PLAYER_COLORS[i] : 'var(--text3)', fontWeight: p.name ? 600 : 400 }}>
                  {p.name || `Jugador ${i + 1}`}
                </span>
                {(mode === 'combinado_4' || mode === 'matchplay_dobles' || mode === 'mejor_peor_suma') && (
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 6, marginRight: 4, color: '#071209', background: PLAYER_COLORS[p.team === 1 ? 0 : 2] }}>
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

        {/* 5. % HANDICAP */}

        {/* Modalidades simples */}
        {['stroke', 'matchplay_individual', 'matchplay_dobles', 'bismarck', 'mejor_peor_suma'].includes(mode) && (
          <section style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 20 }}>
            <h2 style={{ fontFamily: 'var(--display)', fontSize: 14, letterSpacing: 2, color: 'var(--text3)', marginBottom: 14 }}>% HANDICAP</h2>
            <HcpPctSelector value={hcpPct} onChange={setHcpPct} />
          </section>
        )}

        {/* Config combinado 4 (Ryder) */}
        {mode === 'combinado_4' && (
          <section style={{ background: 'var(--surface)', border: '1px solid #34d39930', borderRadius: 12, padding: 20 }}>
            <h2 style={{ fontFamily: 'var(--display)', fontSize: 14, letterSpacing: 2, color: '#34d399', marginBottom: 16 }}>% HANDICAP POR APUESTA</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ padding: 14, background: 'rgba(52,211,153,0.05)', borderRadius: 10, border: '1px solid #34d39920' }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#34d399', marginBottom: 10 }}>Dobles (T1 vs T2)</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <ModeSelector value={doblesMode} onChange={setDoblesMode} label="MODALIDAD DOBLES" />
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text3)', letterSpacing: 1, marginBottom: 6 }}>% HANDICAP DOBLES</div>
                    <HcpPctSelector value={doblesHcpPct} onChange={setDoblesHcpPct} />
                  </div>
                </div>
              </div>
              <div style={{ padding: 14, background: 'rgba(245,158,11,0.05)', borderRadius: 10, border: '1px solid #f59e0b20' }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#f59e0b', marginBottom: 10 }}>Individuales (4 partidos cruzados)</div>
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
            <h2 style={{ fontFamily: 'var(--display)', fontSize: 14, letterSpacing: 2, color: '#fb923c', marginBottom: 16 }}>% HANDICAP POR APUESTA</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ padding: 14, background: 'rgba(248,113,113,0.05)', borderRadius: 10, border: '1px solid #f8717120' }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#f87171', marginBottom: 10 }}>Bismarck</div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', letterSpacing: 1, marginBottom: 6 }}>% HANDICAP BISMARCK</div>
                  <HcpPctSelector value={bismarckHcpPct} onChange={setBismarckHcpPct} />
                </div>
              </div>
              <div style={{ padding: 14, background: 'rgba(245,158,11,0.05)', borderRadius: 10, border: '1px solid #f59e0b20' }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#f59e0b', marginBottom: 10 }}>Individuales (3 partidos cruzados)</div>
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
          background: !isValid() || saving ? 'var(--border)' : '#2dd4bf',
          color: !isValid() || saving ? 'var(--text3)' : '#071209',
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
