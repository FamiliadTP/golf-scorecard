'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase, Round, Course } from '@/lib/supabase'
import Menu from '@/components/Menu'

const MODE_LABELS: Record<string, string> = {
  stroke: 'Stroke Play', matchplay_individual: 'Match Play Individual',
  matchplay_dobles: 'Match Play Dobles', bismarck: 'Bismarck',
  combinado_4: 'Ryder', combinado_bismarck: 'Bismarck + Individuales'
}
const MODE_COLORS: Record<string, string> = {
  stroke: '#1B4332', matchplay_individual: '#B8935A', matchplay_dobles: '#6B5B95',
  bismarck: '#7A2E2E', combinado_4: '#2F6B4F', combinado_bismarck: '#B8703C'
}

const todayStr = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function ArchivePage() {
  const [rounds, setRounds] = useState<(Round & { course: Course })[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('rounds').select('*, course:courses!course_id(*)')
      .order('date', { ascending: false }).order('created_at', { ascending: false }).limit(500)
      .then(({ data }) => {
        const today = todayStr()
        setRounds(((data || []) as any).filter((r: any) => r.date !== today))
        setLoading(false)
      })
  }, [])

  // Agrupar por fecha
  const groups: { date: string; items: (Round & { course: Course })[] }[] = []
  rounds.forEach(r => {
    const g = groups.find(x => x.date === r.date)
    if (g) g.items.push(r)
    else groups.push({ date: r.date, items: [r] })
  })

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <header style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '20px 20px 16px' }}>
        <div style={{ maxWidth: 640, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 12 }}>
          <Link href="/" style={{ color: 'var(--text3)', fontSize: 20 }}>←</Link>
          <h1 style={{ fontFamily: 'var(--display)', fontSize: 24, letterSpacing: 2, flex: 1 }}>📁 PARTIDAS ANTERIORES</h1>
          <Menu />
        </div>
      </header>

      <main style={{ maxWidth: 640, margin: '0 auto', padding: '20px 16px' }}>
        {loading && <div style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>Cargando…</div>}

        {!loading && groups.length === 0 && (
          <div style={{ textAlign: 'center', padding: '48px 20px', background: 'var(--surface)', border: '1px dashed var(--border)', borderRadius: 12, color: 'var(--text3)' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📁</div>
            <p style={{ fontSize: 15 }}>No hay partidas anteriores.</p>
          </div>
        )}

        {groups.map(g => (
          <div key={g.date} style={{ marginBottom: 22 }}>
            <h2 style={{ fontSize: 13, letterSpacing: 1, color: 'var(--text3)', textTransform: 'capitalize', marginBottom: 10 }}>
              {new Date(g.date + 'T00:00:00').toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {g.items.map(r => (
                <Link key={r.id} href={`/round/${r.id}`} style={{
                  display: 'block', background: 'var(--surface)', border: '1px solid var(--border)',
                  borderRadius: 12, padding: '14px 16px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>
                        {r.course?.name || 'Campo desconocido'}
                        {r.course?.club && <span style={{ color: 'var(--text3)', fontWeight: 400, fontSize: 13 }}> — {r.course.club}</span>}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text3)' }}>{r.holes_played} hoyos</div>
                    </div>
                    <div style={{
                      padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, letterSpacing: 0.5,
                      background: `${MODE_COLORS[r.mode] || '#8B9285'}18`,
                      border: `1px solid ${MODE_COLORS[r.mode] || '#8B9285'}40`,
                      color: MODE_COLORS[r.mode] || '#8B9285', whiteSpace: 'nowrap', flexShrink: 0
                    }}>{MODE_LABELS[r.mode] || r.mode}</div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </main>
    </div>
  )
}
