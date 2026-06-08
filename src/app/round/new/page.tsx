'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase, Course, GameMode } from '@/lib/supabase'

const MODES: { value: GameMode; label: string; desc: string; players: string; color: string }[] = [
  { value: 'stroke', label: 'Stroke Play', desc: 'Stableford con handicap', players: '1–4 jugadores', color: '#2dd4bf' },
  { value: 'matchplay_individual', label: 'Match Play', desc: 'Individual hoyo a hoyo', players: '2 jugadores', color: '#f59e0b' },
  { value: 'matchplay_dobles', label: 'Match Play Dobles', desc: 'Mejor bola 2 vs 2', players: '4 jugadores', color: '#a78bfa' },
  { value: 'bismarck', label: 'Bismarck', desc: '6 puntos por hoyo (4-2-0)', players: 'Exactamente 3', color: '#f87171' },
]

const PLAYER_COLORS = ['#2dd4bf', '#f59e0b', '#a78bfa', '#f87171']
const PLAYER_BG = ['#0d9488', '#d97706', '#7c3aed', '#dc2626']

const inputStyle = {
  background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)',
  borderRadius: 8, color: 'var(--text)', fontFamily: 'var(--body)',
  padding: '10px 12px', fontSize: 14, outline: 'none', width: '100%'
}

export default function NewRound() {
  const router = useRouter()
  const [courses, setCourses] = useState<Course[]>([])
  const [courseId, setCourseId] = useState('')
  const [mode, setMode] = useState<GameMode>('stroke')
  const [holesPlayed, setHolesPlayed] = useState(18)
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [players, setPlayers] = useState([
    { name: '', handicap: 18, team: 1 },
    { name: '', handicap: 18, team: 2 },
  ])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    supabase.from('courses').select('*, holes(*)').order('name')
      .then(({ data }) => {
        setCourses((data || []) as any)
        if (data && data.length > 0) {
          setCourseId(data[0].id)
          setHolesPlayed((data[0] as any).holes_count || 18)
        }
      })
  }, [])

  const selectedCourse = courses.find(c => c.id === courseId)

  const playerCount = { stroke: [1, 2, 3, 4], matchplay_individual: [2], matchplay_dobles: [4], bismarck: [3] }[mode]

  const addPlayer = () => {
    if (players.length >= 4) return
    setPlayers([...players, { name: '', handicap: 18, team: players.length % 2 + 1 }])
  }
  const removePlayer = (i: number) => setPlayers(players.filter((_, idx) => idx !== i))
  const updatePlayer = (i: number, field: string, val: any) => {
    setPlayers(prev => prev.map((p, idx) => idx === i ? { ...p, [field]: val } : p))
  }

  const isValid = () => {
    if (!courseId) return false
    const needed = { stroke: null, matchplay_individual: 2, matchplay_dobles: 4, bismarck: 3 }[mode]
    if (needed && players.length !== needed) return false
    if (players.some(p => !p.name.trim())) return false
    return true
  }

  const handleStart = async () => {
    if (!isValid()) return
    setSaving(true)

    const { data: round, error } = await supabase.from('rounds')
      .insert({ course_id: courseId, mode, holes_played: holesPlayed, date })
      .select().single()

    if (error || !round) { setSaving(false); alert('Error al crear partida'); return }

    await supabase.from('round_players').insert(
      players.map((p, i) => ({
        round_id: round.id,
        name: p.name.trim(),
        handicap: p.handicap,
        team: mode === 'matchplay_dobles' ? p.team : null,
        position: i + 1
      }))
    )

    router.push(`/round/${round.id}`)
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <header style={{
        background: 'var(--surface)', borderBottom: '1px solid var(--border)',
        padding: '20px 20px 16px'
      }}>
        <div style={{ maxWidth: 640, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 12 }}>
          <Link href="/" style={{ color: 'var(--text3)', fontSize: 20 }}>←</Link>
          <h1 style={{ fontFamily: 'var(--display)', fontSize: 26, letterSpacing: 2 }}>NUEVA PARTIDA</h1>
        </div>
      </header>

      <main style={{ maxWidth: 640, margin: '0 auto', padding: '24px 16px', display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Campo */}
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
                <select value={courseId} onChange={e => {
                  setCourseId(e.target.value)
                  const c = courses.find(c => c.id === e.target.value)
                  if (c) setHolesPlayed((c as any).holes_count || 18)
                }} style={inputStyle}>
                  {courses.map(c => <option key={c.id} value={c.id}>{c.name}{c.club ? ` — ${c.club}` : ''}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
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
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 11, color: 'var(--text3)', letterSpacing: 1, display: 'block', marginBottom: 6 }}>FECHA</label>
                  <input type="date" value={date} onChange={e => setDate(e.target.value)} style={inputStyle} />
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Modalidad */}
        <section style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 20 }}>
          <h2 style={{ fontFamily: 'var(--display)', fontSize: 14, letterSpacing: 2, color: 'var(--text3)', marginBottom: 14 }}>MODALIDAD</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {MODES.map(m => (
              <button key={m.value} onClick={() => setMode(m.value)} style={{
                display: 'flex', alignItems: 'center', gap: 14,
                padding: '12px 14px', borderRadius: 10, cursor: 'pointer',
                border: `1px solid ${mode === m.value ? m.color + '60' : 'var(--border)'}`,
                background: mode === m.value ? `${m.color}12` : 'transparent',
                textAlign: 'left'
              }}>
                <div style={{
                  width: 10, height: 10, borderRadius: '50%',
                  background: mode === m.value ? m.color : 'var(--border2)',
                  flexShrink: 0
                }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, color: mode === m.value ? m.color : 'var(--text)' }}>{m.label}</div>
                  <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>{m.desc} · {m.players}</div>
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* Jugadores */}
        <section style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <h2 style={{ fontFamily: 'var(--display)', fontSize: 14, letterSpacing: 2, color: 'var(--text3)' }}>JUGADORES</h2>
            {mode === 'stroke' && players.length < 4 && (
              <button onClick={addPlayer} style={{
                background: 'transparent', border: '1px solid var(--border2)',
                borderRadius: 6, color: 'var(--text2)', padding: '5px 12px',
                fontSize: 13, cursor: 'pointer'
              }}>＋ Agregar</button>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {players.map((p, i) => (
              <div key={i} style={{
                display: 'flex', gap: 10, alignItems: 'flex-end',
                padding: '12px 14px', borderRadius: 10,
                background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)'
              }}>
                <div style={{
                  width: 32, height: 32, borderRadius: '50%',
                  background: PLAYER_BG[i],
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 700, fontSize: 13, color: 'white', flexShrink: 0
                }}>
                  {mode === 'matchplay_dobles' ? `T${p.team}` : (i + 1)}
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 10, color: 'var(--text3)', letterSpacing: 1, display: 'block', marginBottom: 4 }}>NOMBRE</label>
                  <input value={p.name} onChange={e => updatePlayer(i, 'name', e.target.value)}
                    placeholder={`Jugador ${i + 1}`}
                    style={{ ...inputStyle, padding: '7px 10px' }} />
                </div>
                <div style={{ width: 70 }}>
                  <label style={{ fontSize: 10, color: 'var(--text3)', letterSpacing: 1, display: 'block', marginBottom: 4 }}>HCP</label>
                  <input type="number" min={0} max={54} value={p.handicap}
                    onChange={e => updatePlayer(i, 'handicap', parseInt(e.target.value) || 0)}
                    style={{ ...inputStyle, padding: '7px 10px' }} />
                </div>
                {mode === 'matchplay_dobles' && (
                  <div style={{ width: 80 }}>
                    <label style={{ fontSize: 10, color: 'var(--text3)', letterSpacing: 1, display: 'block', marginBottom: 4 }}>EQUIPO</label>
                    <select value={p.team} onChange={e => updatePlayer(i, 'team', parseInt(e.target.value))}
                      style={{ ...inputStyle, padding: '7px 10px' }}>
                      <option value={1}>Team 1</option>
                      <option value={2}>Team 2</option>
                    </select>
                  </div>
                )}
                {mode === 'stroke' && players.length > 1 && (
                  <button onClick={() => removePlayer(i)} style={{
                    background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.2)',
                    color: '#f87171', borderRadius: 6, padding: '7px 10px',
                    cursor: 'pointer', fontSize: 13, flexShrink: 0
                  }}>✕</button>
                )}
              </div>
            ))}
          </div>

          {/* Team display for doubles */}
          {mode === 'matchplay_dobles' && (
            <div style={{ marginTop: 12, display: 'flex', gap: 10 }}>
              {[1, 2].map(t => (
                <div key={t} style={{
                  flex: 1, padding: '8px 12px', borderRadius: 8,
                  background: `${PLAYER_COLORS[t === 1 ? 0 : 2]}10`,
                  border: `1px solid ${PLAYER_COLORS[t === 1 ? 0 : 2]}30`,
                  fontSize: 12, color: PLAYER_COLORS[t === 1 ? 0 : 2]
                }}>
                  <strong>Team {t}:</strong> {players.filter(p => p.team === t).map(p => p.name || '…').join(' & ') || '—'}
                </div>
              ))}
            </div>
          )}
        </section>

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
