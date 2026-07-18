'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase, Course } from '@/lib/supabase'
import TopBar from '@/components/TopBar'

export default function CoursesPage() {
  const [courses, setCourses] = useState<Course[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('courses').select('*, holes(*)').order('name')
      .then(({ data }) => {
        setCourses((data || []) as any)
        setLoading(false)
      })
  }, [])

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <TopBar title="Mis Campos" />
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '14px 16px 0', display: 'flex', justifyContent: 'flex-end' }}>
        <Link href="/course/new" style={{
          background: '#1B4332', color: '#F1EEE4',
          padding: '8px 16px', borderRadius: 8, fontWeight: 700, fontSize: 13
        }}>＋ Nuevo campo</Link>
      </div>

      <main style={{ maxWidth: 640, margin: '0 auto', padding: '20px 16px' }}>
        {loading && <div style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>Cargando…</div>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {courses.map(c => (
            <Link key={c.id} href={`/course/${c.id}`} style={{
              display: 'block',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 12, padding: '14px 16px'
            }}>
              <div style={{ fontWeight: 600, fontSize: 15 }}>{c.name}{c.loop_label ? <span style={{ color: '#1B4332' }}> · {c.loop_label}</span> : null}</div>
              {c.club && <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>{c.club}</div>}
              <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>
                {c.loop_label ? 'Vuelta de 9 (combinable)' : `${c.holes_count} hoyos`} · {(c.holes || []).length} cargados
              </div>
            </Link>
          ))}
        </div>
      </main>
    </div>
  )
}
