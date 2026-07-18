'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import TopBar from '@/components/TopBar'
import { supabase } from '@/lib/supabase'

interface Comp {
  key: string
  roundId: string
  name: string
  courseName: string
  date: string
  groups: number
}

export default function LeaderboardIndex() {
  const [comps, setComps] = useState<Comp[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('rounds')
        .select('*, course:courses!course_id(name)')
        .eq('mode', 'stroke_grupal').eq('grupal', true)
        .order('created_at', { ascending: false }).limit(300)
      const map = new Map<string, Comp>()
      ;(data || []).forEach((r: any) => {
        const key = `${r.course_id}|${r.date}|${r.competition_name || ''}`
        const existing = map.get(key)
        if (existing) { existing.groups += 1 }
        else map.set(key, {
          key, roundId: r.id,
          name: r.competition_name || 'Sin nombre',
          courseName: r.course?.name || '—',
          date: r.date, groups: 1,
        })
      })
      setComps(Array.from(map.values()))
      setLoading(false)
    }
    load()
  }, [])

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <TopBar title="Leaderboard" />
      <main style={{ maxWidth: 640, margin: '0 auto', padding: '24px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <h2 style={{ fontFamily: 'var(--display)', fontSize: 14, letterSpacing: 2, color: 'var(--text3)' }}>COMPETENCIAS GRUPALES</h2>
        {loading ? (
          <div style={{ color: 'var(--text3)', padding: 20, textAlign: 'center' }}>Cargando…</div>
        ) : comps.length === 0 ? (
          <div style={{ color: 'var(--text3)', padding: 20, textAlign: 'center', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12 }}>
            Aún no hay competencias grupales. Crea una partida en modo <strong style={{ color: '#2B5F7A' }}>Stroke Play Grupal</strong> con Grupal = Sí.
          </div>
        ) : comps.map(c => (
          <Link key={c.key} href={`/leaderboard/${c.roundId}`} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
            background: 'var(--surface)', border: '1px solid #38bdf830', borderRadius: 12, padding: '14px 16px',
            textDecoration: 'none'
          }}>
            <div>
              <div style={{ fontFamily: 'var(--display)', fontSize: 18, color: '#2B5F7A', letterSpacing: 1 }}>{c.name}</div>
              <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
                {c.courseName} · {new Date(c.date).toLocaleDateString('es-CL', { day: 'numeric', month: 'long' })} · {c.groups} {c.groups === 1 ? 'grupo' : 'grupos'}
              </div>
            </div>
            <span style={{ fontSize: 20 }}>🏆</span>
          </Link>
        ))}
      </main>
    </div>
  )
}
