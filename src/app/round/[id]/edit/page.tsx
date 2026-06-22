'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import TopBar from '@/components/TopBar'
import { supabase, Course, GameMode, Round, RoundPlayer } from '@/lib/supabase'

const PLAYER_COLORS = ['#2dd4bf', '#f59e0b', '#a78bfa', '#f87171']
const PLAYER_BG = ['#0d9488', '#d97706', '#7c3aed', '#dc2626']
const HCP_OPTIONS = [0, 75, 80, 100]

const MODE_LABELS: Record<string, string> = {
  stroke: 'Stroke Play', matchplay_individual: 'Match Play',
  matchplay_dobles: 'Match Play Dobles', bismarck: 'Bismarck',
  combinado_4: 'Ryder', combinado_bismarck: 'Bismarck + Individuales', mejor_peor_suma: 'Mejor, Peor y Suma'
}

const inp: React.CSSProperties = {
  background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)',
  borderRadius: 8, color: 'var(--text)', fontFamily: 'var(--body)',
  padding: '10px 12px', fontSize: 14, outline: 'none', width: '100%'
}

function HcpPctSelector({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
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

interface EditPlayer { id: string; name: string; handicap: number; team: number; position: number }

export default function EditRound() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [courses, setCourses] = useState<Course[]>([])
  const [round, setRound] = useState<Round | null>(null)
  const [courseId, setCourseId] = useState('')
  const [mode, setMode] = useState<GameMode>('stroke')
  const [holesPlayed, setHolesPlayed] = useState(18)
  const [date, setDate] = useState('')
  const [players, setPlayers] = useState<EditPlayer[]>([])
  const [hcpPct, setHcpPct] = useState(100)
  const [doblesMode, setDoblesMode] = useState<'stroke' | 'matchplay'>('matchplay')
  const [doblesHcpPct, setDoblesHcpPct] = useState(100)
  const [individualMode, setIndividualMode] = useState<'stroke' | 'matchplay'>('matchplay')
  const [individualHcpPct, setIndividualHcpPct] = useState(100)
  const [bismarckHcpPct, setBismarckHcpPct] = useState(100)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!id) return
    async function load() {
      const [{ data: c }, { data: r }, { data: p }] = await Promise.all([
        supabase.from('courses').select('*, holes(*)').order('name'),
        supabase.from('rounds').select('*').eq('id', id).single(),
        supabase.from('round_players').select('*').eq('round_id', id).order('position'),
      ])
      if (!r) { router.push('/'); return }
      setCourses((c || []) as any)
      setRound(r as any)
      setCourseId((r as any).course_id)
      setMode((r as any).mode)
      setHolesPlayed((r as any).holes_played || 18)
      setDate((r as any).date)
      setHcpPct((r as any).hcp_pct ?? 100)
      setDoblesMode((r as any).dobles_mode || 'matchplay')
      setDoblesHcpPct((r as any).dobles_hcp_pct ?? 100)
      setIndividualMode((r as any).individual_mode || 'matchplay')
      setIndividualHcpPct((r as any).individual_hcp_pct ?? 100)
      setBismarckHcpPct((r as any).bismarck_hcp_pct ?? 100)
      setPlayers(((p || []) as any[]).map(pl => ({
        id: pl.id, name: pl.name, handicap: pl.handicap, team: pl.team || 1, position: pl.position
      })))
      setLoading(false)
    }
    load()
  }, [id, router])

  const updatePlayer = (i: number, field: keyof EditPlayer, val: any) =>
    setPlayers(prev => prev.map((p, idx) => idx === i ? { ...p, [field]: val } : p))

  const isValid = () => {
    if (!courseId) return false
    return players.every(p => p.name.trim())
  }

  const handleSave = async () => {
    if (!isValid() || saving) return
    setSaving(true)
    const update: any = { course_id: courseId, holes_played: holesPlayed, date }
    if (['stroke', 'matchplay_individual', 'matchplay_dobles', 'bismarck', 'mejor_peor_suma'].includes(mode)) {
      update.hcp_pct = hcpPct
    }
    if (mode === 'combinado_4') {
      update.dobles_mode = doblesMode; update.dobles_hcp_pct = doblesHcpPct
      update.individual_mode = individualMode; update.individual_hcp_pct = individualHcpPct
    }
    if (mode === 'combinado_bismarck') {
      update.bismarck_hcp_pct = bismarckHcpPct
      update.individual_mode = individualMode; update.individual_hcp_pct = individualHcpPct
    }
    await supabase.from('rounds').update(update).eq('id', id)
    for (const p of players) {
      await supabase.from('round_players')
        .update({ name: p.name.trim(), handicap: p.handicap, team: p.team })
        .eq('id', p.id)
      await supabase.from('players').upsert({ name: p.name.trim(), last_handicap: p.handicap }, { onConflict: 'name' })
    }
    router.push(`/round/${id}`)
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)' }}>Cargando…</div>
  )

  const isDoublesMode = mode === 'combinado_4' || mode === 'matchplay_dobles' || mode === 'mejor_peor_suma'

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <TopBar title="Editar Partida" />

      <main style={{ maxWidth: 640, margin: '0 auto', padding: '24px 16px', display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* MODALIDAD — read-only */}
        <section style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 20 }}>
          <h2 style={{ fontFamily: 'var(--display)', fontSize: 14, letterSpacing: 2, color: 'var(--text3)', marginBottom: 8 }}>MODALIDAD</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#2dd4bf' }} />
            <div style={{ fontWeight: 600, fontSize: 15 }}>{MODE_LABELS[mode] || mode}</div>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 8 }}>
            La modalidad no se puede modificar. Si necesitas otra, crea una partida nueva.
          </div>
        </section>

        {/* CAMPO */}
        <section style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 20 }}>
          <h2 style={{ fontFamily: 'var(--display)', fontSize: 14, letterSpacing: 2, color: 'var(--text3)', marginBottom: 14 }}>CAMPO</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div>
              <label style={{ fontSize: 11, color: 'var(--text3)', letterSpacing: 1, display: 'block', marginBottom: 6 }}>CAMPO</label>
              <select value={courseId} onChange={e => setCourseId(e.target.value)} style={{ ...inp, color: '#e2f5e9' }}>
                {courses.map(c => <option key={c.id} value={c.id} style={{ background: '#0f2318', color: '#e2f5e9' }}>{c.name}{c.club ? ` — ${c.club}` : ''}</option>)}
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
        </section>

        {/* JUGADORES — nombres y parejas */}
        <section style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 20 }}>
          <h2 style={{ fontFamily: 'var(--display)', fontSize: 14, letterSpacing: 2, color: 'var(--text3)', marginBottom: 14 }}>JUGADORES</h2>

          {isDoublesMode && (
            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
              {[1, 2].map(t => (
                <div key={t} style={{ flex: 1, padding: '8px 12px', borderRadius: 8, background: `${PLAYER_COLORS[t === 1 ? 0 : 2]}10`, border: `1px solid ${PLAYER_COLORS[t === 1 ? 0 : 2]}30`, fontSize: 12, color: PLAYER_COLORS[t === 1 ? 0 : 2] }}>
                  <strong>Team {t}:</strong> {players.filter(p => p.team === t).map(p => p.name || '…').join(' & ') || '—'}
                </div>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {players.map((p, i) => (
              <div key={p.id} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '10px 14px', borderRadius: 10, background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)' }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: PLAYER_BG[i], display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12, color: 'white', flexShrink: 0 }}>
                  {isDoublesMode ? `T${p.team}` : (i + 1)}
                </div>
                <input
                  value={p.name}
                  onChange={e => updatePlayer(i, 'name', e.target.value)}
                  placeholder="Nombre del jugador..."
                  style={{ ...inp, padding: '8px 12px', flex: 1 }}
                />
                {isDoublesMode && (
                  <select value={p.team} onChange={e => updatePlayer(i, 'team', parseInt(e.target.value))}
                    style={{ ...inp, width: 84, padding: '8px 10px' }}>
                    <option value={1} style={{ background: '#0f2318' }}>Team 1</option>
                    <option value={2} style={{ background: '#0f2318' }}>Team 2</option>
                  </select>
                )}
              </div>
            ))}
          </div>
          {isDoublesMode && (
            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 10 }}>
              Cada equipo debe quedar con 2 jugadores antes de guardar.
            </div>
          )}
        </section>

        {/* HANDICAP individual */}
        <section style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 20 }}>
          <h2 style={{ fontFamily: 'var(--display)', fontSize: 14, letterSpacing: 2, color: 'var(--text3)', marginBottom: 14 }}>HANDICAP</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {players.map((p, i) => (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 10, background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)' }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: PLAYER_BG[i], display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 11, color: 'white', flexShrink: 0 }}>
                  {p.name ? p.name[0].toUpperCase() : (i + 1)}
                </div>
                <span style={{ flex: 1, fontSize: 14, color: p.name ? PLAYER_COLORS[i] : 'var(--text3)', fontWeight: p.name ? 600 : 400 }}>
                  {p.name || `Jugador ${i + 1}`}
                </span>
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

        {/* % HANDICAP — modos simples */}
        {['stroke', 'matchplay_individual', 'matchplay_dobles', 'bismarck', 'mejor_peor_suma'].includes(mode) && (
          <section style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 20 }}>
            <h2 style={{ fontFamily: 'var(--display)', fontSize: 14, letterSpacing: 2, color: 'var(--text3)', marginBottom: 14 }}>% HANDICAP</h2>
            <HcpPctSelector value={hcpPct} onChange={setHcpPct} />
          </section>
        )}

        {/* RYDER */}
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

        {/* COMBINADO BISMARCK */}
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

        <div style={{ display: 'flex', gap: 10 }}>
          <Link href={`/round/${id}`} style={{
            flex: 1, padding: 16, textAlign: 'center',
            background: 'transparent', border: '1px solid var(--border2)',
            color: 'var(--text2)', borderRadius: 12,
            fontFamily: 'var(--display)', fontSize: 14, letterSpacing: 2,
            textDecoration: 'none'
          }}>CANCELAR</Link>
          <button onClick={handleSave} disabled={!isValid() || saving} style={{
            flex: 2, padding: 16,
            background: !isValid() || saving ? 'var(--border)' : '#2dd4bf',
            color: !isValid() || saving ? 'var(--text3)' : '#071209',
            border: 'none', borderRadius: 12,
            fontFamily: 'var(--display)', fontSize: 16, letterSpacing: 2,
            cursor: !isValid() || saving ? 'not-allowed' : 'pointer'
          }}>
            {saving ? 'GUARDANDO…' : 'GUARDAR CAMBIOS'}
          </button>
        </div>

        <div style={{ fontSize: 11, color: 'var(--text3)', textAlign: 'center', paddingTop: 4 }}>
          Los scores ya registrados se mantienen.
        </div>
      </main>
    </div>
  )
}
