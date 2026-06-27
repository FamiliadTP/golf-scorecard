'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase, Round, Course } from '@/lib/supabase'
import Menu from '@/components/Menu'

const todayStr = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const MODE_LABELS: Record<string, string> = {
  stroke: 'Stroke Play',
  matchplay_individual: 'Match Play Individual',
  matchplay_dobles: 'Match Play Dobles',
  bismarck: 'Bismarck',
  combinado_4: 'Ryder',
  combinado_bismarck: 'Bismarck + Individuales',
  mejor_peor_suma: 'Mejor, Peor y Suma',
  stroke_grupal: 'Stroke Play Grupal'
}
const MODE_COLORS: Record<string, string> = {
  stroke: '#2dd4bf',
  matchplay_individual: '#f59e0b',
  matchplay_dobles: '#a78bfa',
  bismarck: '#f87171',
  combinado_4: '#34d399',
  combinado_bismarck: '#fb923c',
  mejor_peor_suma: '#22d3ee',
  stroke_grupal: '#38bdf8'
}

export default function Home() {
  const [rounds, setRounds] = useState<(Round & { course: Course })[]>([])
  const [courses, setCourses] = useState<Course[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [{ data: r }, { data: c }] = await Promise.all([
        supabase.from('rounds').select('*, course:courses!course_id(*)').order('created_at', { ascending: false }).limit(300),
        supabase.from('courses').select('*').order('name')
      ])
      setRounds((r || []) as any)
      setCourses((c || []) as any)
      setLoading(false)
    }
    load()
  }, [])

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      {/* Header */}
      <header style={{
        background: 'linear-gradient(135deg, #0a1f0f 0%, #071409 100%)',
        borderBottom: '1px solid var(--border)',
        padding: '28px 20px 24px',
        position: 'relative', overflow: 'hidden'
      }}>
        <div style={{
          position: 'absolute', top: -60, right: -60,
          width: 240, height: 240,
          background: 'radial-gradient(circle, rgba(45,212,130,0.06) 0%, transparent 70%)',
          pointerEvents: 'none'
        }} />
        <div style={{ maxWidth: 640, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
            <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
              <div style={{
                width: 44, height: 44,
                background: 'linear-gradient(135deg, #2dd4bf, #16a34a)',
                borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 22, boxShadow: '0 0 24px rgba(45,212,130,0.25)', flexShrink: 0
              }}>⛳</div>
              <div>
                <h1 style={{ fontFamily: 'var(--display)', fontSize: 32, letterSpacing: 2, lineHeight: 1 }}>Golf Scorecard</h1>
                <p style={{ fontSize: 11, color: 'var(--text3)', letterSpacing: 1, textTransform: 'uppercase' }}>Gestión de partidas</p>
              </div>
            </Link>
            <Menu />
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 20, flexWrap: 'wrap' }}>
            <Link href="/round/new" style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              background: '#2dd4bf', color: '#071209',
              padding: '10px 20px', borderRadius: 8,
              fontWeight: 700, fontSize: 14, letterSpacing: 0.3
            }}>⛳ Nueva Partida</Link>
            <Link href="/course/new" style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              background: 'transparent',
              border: '1px solid var(--border2)',
              color: 'var(--text2)',
              padding: '10px 20px', borderRadius: 8,
              fontWeight: 500, fontSize: 14
            }}>＋ Nuevo Campo</Link>
            <Link href="/course" style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              background: 'transparent',
              border: '1px solid var(--border)',
              color: 'var(--text3)',
              padding: '10px 20px', borderRadius: 8,
              fontWeight: 500, fontSize: 14
            }}>🏌️ Mis Campos ({courses.length})</Link>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 640, margin: '0 auto', padding: '24px 16px' }}>
        {(() => {
          const today = todayStr()
          const todayRounds = rounds.filter(r => r.date === today)
          const olderCount = rounds.length - todayRounds.length
          return (
            <>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14 }}>
                <h2 style={{ fontFamily: 'var(--display)', fontSize: 18, letterSpacing: 2, color: 'var(--text3)' }}>PARTIDAS DE HOY</h2>
                <span style={{ fontSize: 12, color: 'var(--text3)' }}>
                  {new Date().toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' })}
                </span>
              </div>

              {loading && (
                <div style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>Cargando…</div>
              )}

              {!loading && todayRounds.length === 0 && (
                <div style={{
                  textAlign: 'center', padding: '40px 20px',
                  background: 'var(--surface)', border: '1px dashed var(--border)',
                  borderRadius: 12, color: 'var(--text3)'
                }}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>⛳</div>
                  <p style={{ fontSize: 15 }}>No hay partidas registradas hoy.</p>
                  <p style={{ fontSize: 13, marginTop: 6 }}>Inicia una nueva partida o revisa las anteriores.</p>
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {todayRounds.map(r => (
                  <Link key={r.id} href={`/round/${r.id}`} style={{
                    display: 'block', background: 'var(--surface)', border: '1px solid var(--border)',
                    borderRadius: 12, padding: '14px 16px', transition: 'border-color 0.2s',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>
                          {r.course?.name || 'Campo desconocido'}
                          {r.course?.club && <span style={{ color: 'var(--text3)', fontWeight: 400, fontSize: 13 }}> — {r.course.club}</span>}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text3)' }}>
                          {new Date(r.date).toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' })}
                          {' · '}{r.holes_played} hoyos
                        </div>
                      </div>
                      <div style={{
                        padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, letterSpacing: 0.5,
                        background: `${MODE_COLORS[r.mode] || '#888'}18`,
                        border: `1px solid ${MODE_COLORS[r.mode] || '#888'}40`,
                        color: MODE_COLORS[r.mode] || '#888', whiteSpace: 'nowrap', flexShrink: 0
                      }}>
                        {MODE_LABELS[r.mode] || r.mode}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>

              {!loading && olderCount > 0 && (
                <Link href="/archive" style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  marginTop: 18, padding: '14px', borderRadius: 12,
                  background: 'var(--surface)', border: '1px solid var(--border)',
                  color: 'var(--text2)', fontSize: 14, fontWeight: 600
                }}>
                  📁 Partidas anteriores ({olderCount})
                </Link>
              )}
            </>
          )
        })()}
      </main>
    </div>
  )
}
