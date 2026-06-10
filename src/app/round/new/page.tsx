'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase, Course, GameMode, Player } from '@/lib/supabase'

const MODES: { value: GameMode; label: string; desc: string; color: string; players: string }[] = [
  { value: 'combinado_4', label: 'Ryder', desc: 'Dobles + 4 individuales cruzados', color: '#34d399', players: '4 jugadores' },
  { value: 'stroke', label: 'Stroke Play', desc: 'Stableford con handicap', color: '#2dd4bf', players: '1–4 jugadores' },
  { value: 'matchplay_individual', label: 'Match Play', desc: 'Individual hoyo a hoyo', color: '#f59e0b', players: '2 jugadores' },
  { value: 'matchplay_dobles', label: 'Match Play Dobles', desc: 'Mejor bola 2 vs 2', color: '#a78bfa', players: '4 jugadores' },
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

// Componente selector de jugador con desplegable
function PlayerSelector({
  index, player, allPlayers, registeredPlayers, onUpdate, onRemove, showRemove, showTeam
}: {
  index: number
  player: { name: string; handicap: number; team: number }
  allPlayers: { name: string; handicap: number; team: number }[]
  registeredPlayers: Player[]
  onUpdate: (field: string, val: any) => void
  onRemove: () => void
  showRemove: boolean
  showTeam: boolean
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const usedNames = allPlayers.map((p, i) => i !== index ? p.name.toLowerCase() : '').filter(Boolean)
  const filtered = registeredPlayers.filter(p =>
    !usedNames.includes(p.name.toLowerCase()) &&
    p.name.toLowerCase().includes(search.toLowerCase())
  )
  const showAddNew = search.trim() && !registeredPlayers.find(p => p.name.toLowerCase() === search.toLowerCase())

  const selectPlayer = (name: string, hcp: number) => {
    onUpdate('name', name)
    onUpdate('handicap', hcp)
    setSearch('')
    setOpen(false)
  }

  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '12px 14px', borderRadius: 10, background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)' }}>
      <div style={{ width: 32, height: 32, borderRadius: '50%', background: PLAYER_BG[index], display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12, color: 'white', flexShrink: 0, marginTop: 18 }}>
        {showTeam ? `T${player.team}` : (index + 1)}
      </div>

      <div style={{ flex: 1 }} ref={ref}>
        <label style={{ fontSize: 10, color: 'var(--text3)', letterSpacing: 1, display: 'block', marginBottom: 4 }}>NOMBRE</label>
        <div style={{ position: 'relative' }}>
          <input
            value={open ? search : player.name}
            onFocus={() => { setOpen(true); setSearch('') }}
            onChange={e => { setSearch(e.target.value); if (!open) setOpen(true) }}
            placeholder="Buscar o escribir nombre..."
            style={{ ...inp, padding: '7px 10px' }}
          />
          {open && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
              background: '#0f2318', border: '1px solid var(--border2)',
              borderRadius: 8, marginTop: 4, maxHeight: 200, overflowY: 'auto',
              boxShadow: '0 8px 24px rgba(0,0,0,0.4)'
            }}>
              {filtered.length === 0 && !showAddNew && (
                <div style={{ padding: '10px 14px', fontSize: 13, color: 'var(--text3)' }}>No hay jugadores registrados</div>
              )}
              {filtered.map(p => (
                <button key={p.id} onClick={() => selectPlayer(p.name, p.last_handicap)} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  width: '100%', padding: '10px 14px', background: 'transparent',
                  border: 'none', borderBottom: '1px solid var(--border)',
                  color: 'var(--text)', cursor: 'pointer', fontSize: 13, textAlign: 'left'
                }}>
                  <span>{p.name}</span>
                  <span style={{ fontSize: 11, color: 'var(--text3)' }}>HCP {p.last_handicap}</span>
                </button>
              ))}
              {showAddNew && (
                <button onClick={() => selectPlayer(search.trim(), 18)} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  width: '100%', padding: '10px 14px', background: 'transparent',
                  border: 'none', color: '#2dd4bf', cursor: 'pointer', fontSize: 13, textAlign: 'left'
                }}>
                  <span>＋</span> Agregar "{search.trim()}"
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <div style={{ width: 70 }}>
        <label style={{ fontSize: 10, color: 'var(--text3)', letterSpacing: 1, display: 'block', marginBottom: 4 }}>HCP</label>
        <input type="number" min={0} max={54} value={player.handicap}
          onChange={e => onUpdate('handicap', parseInt(e.target.value) || 0)}
          onFocus={e => e.target.select()}
          style={{ ...inp, padding: '7px 10px' }} />
      </div>

      {showRemove && (
        <button onClick={onRemove} style={{
          background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.2)',
          color: '#f87171', borderRadius: 6, padding: '7px 10px',
          cursor: 'pointer', fontSize: 13, flexShrink: 0, marginTop: 18
        }}>✕</button>
      )}
    </div>
  )
}

export default function NewRound() {
  const router = useRouter()
  const [courses, setCourses] = useState<Course[]>([])
  const [registeredPlayers, setRegisteredPlayers] = useState<Player[]>([])
  const [courseId, setCourseId] = useState('')
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
  const [individualHcpPct, setIndividualHcpPct] = useState(80)
  const [bismarckHcpPct, setBismarckHcpPct] = useState(100)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    Promise.all([
      supabase.from('courses').select('*, holes(*)').order('name'),
      supabase.from('players').select('*').order('name')
    ]).then(([{ data: c }, { data: p }]) => {
      setCourses((c || []) as any)
      setRegisteredPlayers((p || []) as any)
      if (c && c.length > 0) { setCourseId(c[0].id); setHolesPlayed((c[0] as any).holes_count || 18) }
    })
  }, [])

  // Fixed player counts per mode
  const fixedCount: Record<GameMode, number | null> = {
    stroke: null, matchplay_individual: 2, matchplay_dobles: 4,
    bismarck: 3, combinado_4: 4, combinado_bismarck: 3
  }

  useEffect(() => {
    const needed = fixedCount[mode]
    if (needed !== null) {
      setPlayers(prev => {
        const base = prev.slice(0, needed)
        while (base.length < needed) base.push({ name: '', handicap: 18, team: base.length < 2 ? 1 : 2 })
        if (mode === 'combinado_4' || mode === 'matchplay_dobles') {
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

  const isValid = () => {
    if (!courseId) return false
    if (players.some(p => !p.name.trim())) return false
    if (mode === 'combinado_4' && players.length !== 4) return false
    if ((mode === 'bismarck' || mode === 'combinado_bismarck') && players.length !== 3) return false
    if (mode === 'matchplay_individual' && players.length !== 2) return false
    if (mode === 'matchplay_dobles' && players.length !== 4) return false
    return true
  }

  const handleStart = async () => {
    if (!isValid()) return
    setSaving(true)

    const roundData: any = { course_id: courseId, mode, holes_played: holesPlayed, date }
    // Modalidades simples: guardar hcp_pct
    if (['stroke', 'matchplay_individual', 'matchplay_dobles', 'bismarck'].includes(mode)) {
      roundData.hcp_pct = hcpPct
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
    if (error || !round) { setSaving(false); alert('Error: ' + error?.message); return }

    await supabase.from('round_players').insert(
      players.map((p, i) => ({
        round_id: round.id, name: p.name.trim(), handicap: p.handicap,
        team: ['matchplay_dobles', 'combinado_4'].includes(mode) ? p.team : null,
        position: i + 1
      }))
    )

    // Upsert players into master list with latest handicap
    await Promise.all(players.map(p =>
      supabase.from('players').upsert({ name: p.name.trim(), last_handicap: p.handicap }, { onConflict: 'name' })
    ))

    router.push(`/round/${round.id}`)
  }

  const isStroke = mode === 'stroke'

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <header style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '20px 20px 16px' }}>
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
                <select value={courseId} onChange={e => { setCourseId(e.target.value); const c = courses.find(c => c.id === e.target.value); if (c) setHolesPlayed((c as any).holes_count || 18) }} style={inp}>
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
                  <input type="date" value={date} onChange={e => setDate(e.target.value)} style={inp} />
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

        {/* % Handicap para modalidades simples */}
        {['stroke', 'matchplay_individual', 'matchplay_dobles', 'bismarck'].includes(mode) && (
          <section style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 20 }}>
            <h2 style={{ fontFamily: 'var(--display)', fontSize: 14, letterSpacing: 2, color: 'var(--text3)', marginBottom: 14 }}>% HANDICAP</h2>
            <HcpPctSelector value={hcpPct} onChange={setHcpPct} />
          </section>
        )}

        {/* Config combinado 4 */}
        {mode === 'combinado_4' && (
          <section style={{ background: 'var(--surface)', border: '1px solid #34d39930', borderRadius: 12, padding: 20 }}>
            <h2 style={{ fontFamily: 'var(--display)', fontSize: 14, letterSpacing: 2, color: '#34d399', marginBottom: 16 }}>CONFIGURACIÓN APUESTAS</h2>
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
            <h2 style={{ fontFamily: 'var(--display)', fontSize: 14, letterSpacing: 2, color: '#fb923c', marginBottom: 16 }}>CONFIGURACIÓN APUESTAS</h2>
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

        {/* Jugadores */}
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

          {(mode === 'combinado_4' || mode === 'matchplay_dobles') && (
            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
              {[1, 2].map(t => (
                <div key={t} style={{ flex: 1, padding: '8px 12px', borderRadius: 8, background: `${PLAYER_COLORS[t === 1 ? 0 : 2]}10`, border: `1px solid ${PLAYER_COLORS[t === 1 ? 0 : 2]}30`, fontSize: 12, color: PLAYER_COLORS[t === 1 ? 0 : 2] }}>
                  <strong>Team {t}:</strong> {players.filter(p => p.team === t).map(p => p.name || '…').join(' & ') || '—'}
                </div>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {players.map((p, i) => (
              <PlayerSelector
                key={i} index={i} player={p}
                allPlayers={players}
                registeredPlayers={registeredPlayers}
                onUpdate={(field, val) => updatePlayer(i, field, val)}
                onRemove={() => removePlayer(i)}
                showRemove={isStroke && players.length > 1}
                showTeam={mode === 'combinado_4' || mode === 'matchplay_dobles'}
              />
            ))}
          </div>
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
