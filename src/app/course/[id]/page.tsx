'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase, Course, Hole } from '@/lib/supabase'

export default function CourseDetail() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [course, setCourse] = useState<Course | null>(null)
  const [holes, setHoles] = useState<Hole[]>([])
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    supabase.from('courses').select('*, holes(*)')
      .eq('id', id).single()
      .then(({ data }) => {
        if (data) {
          setCourse(data as any)
          const sorted = [...(data.holes || [])].sort((a: any, b: any) => a.hole_number - b.hole_number)
          setHoles(sorted as any)
        }
      })
  }, [id])

  const updateHole = (idx: number, field: 'par' | 'handicap', val: number) => {
    setHoles(prev => prev.map((h, i) => i === idx ? { ...h, [field]: val } : h))
  }

  const handleSave = async () => {
    setSaving(true)
    await Promise.all(holes.map(h =>
      supabase.from('holes').update({ par: h.par, handicap: h.handicap }).eq('id', h.id!)
    ))
    if (course) {
      await supabase.from('courses').update({ name: course.name, club: course.club }).eq('id', id)
    }
    setSaving(false)
    setEditing(false)
  }

  if (!course) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)' }}>
      Cargando…
    </div>
  )

  const inputStyle = {
    background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)',
    borderRadius: 6, color: 'var(--text)', fontFamily: 'var(--body)',
    padding: '6px 10px', fontSize: 14, outline: 'none'
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <header style={{
        background: 'var(--surface)', borderBottom: '1px solid var(--border)',
        padding: '20px 20px 16px'
      }}>
        <div style={{ maxWidth: 640, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <Link href="/course" style={{ color: 'var(--text3)', fontSize: 20 }}>←</Link>
            <div style={{ flex: 1 }}>
              {editing ? (
                <input
                  style={{ ...inputStyle, fontSize: 18, fontWeight: 600, width: '100%' }}
                  value={course.name}
                  onChange={e => setCourse({ ...course, name: e.target.value })}
                />
              ) : (
                <h1 style={{ fontFamily: 'var(--display)', fontSize: 26, letterSpacing: 1 }}>{course.name}</h1>
              )}
              {editing ? (
                <input
                  style={{ ...inputStyle, fontSize: 13, marginTop: 6, width: '100%' }}
                  value={course.club || ''}
                  onChange={e => setCourse({ ...course, club: e.target.value })}
                  placeholder="Club"
                />
              ) : (
                course.club && <p style={{ fontSize: 13, color: 'var(--text3)' }}>{course.club}</p>
              )}
            </div>
            <button onClick={() => editing ? handleSave() : setEditing(true)} style={{
              padding: '8px 16px', borderRadius: 8,
              background: editing ? '#2dd4bf' : 'transparent',
              border: editing ? 'none' : '1px solid var(--border2)',
              color: editing ? '#071209' : 'var(--text2)',
              fontWeight: 600, fontSize: 13, cursor: 'pointer'
            }}>
              {saving ? '…' : editing ? 'Guardar' : '✏️ Editar'}
            </button>
          </div>
          <Link href="/round/new" style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: '#2dd4bf', color: '#071209',
            padding: '9px 18px', borderRadius: 8,
            fontWeight: 700, fontSize: 13
          }}>⚡ Jugar en este campo</Link>
        </div>
      </header>

      <main style={{ maxWidth: 640, margin: '0 auto', padding: '20px 16px' }}>
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 12, overflow: 'hidden'
        }}>
          <div style={{
            display: 'grid', gridTemplateColumns: '48px 1fr 1fr',
            background: 'var(--surface2)', borderBottom: '1px solid var(--border)',
            padding: '8px 16px', gap: 8
          }}>
            {['HOYO', 'PAR', 'HCP'].map(h => (
              <span key={h} style={{ fontSize: 11, color: 'var(--text3)', letterSpacing: 1 }}>{h}</span>
            ))}
          </div>
          {holes.map((h, i) => (
            <div key={i} style={{
              display: 'grid', gridTemplateColumns: '48px 1fr 1fr',
              padding: '8px 16px', gap: 8,
              borderBottom: i < holes.length - 1 ? '1px solid var(--border)' : 'none',
              background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)',
              alignItems: 'center'
            }}>
              <span style={{ fontFamily: 'var(--display)', fontSize: 18, color: 'var(--text2)' }}>{h.hole_number}</span>
              {editing ? (
                <select value={h.par} onChange={e => updateHole(i, 'par', parseInt(e.target.value))}
                  style={{ ...inputStyle, width: 'auto' }}>
                  {[3, 4, 5].map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              ) : (
                <span style={{ color: 'var(--text)', fontWeight: 600 }}>{h.par}</span>
              )}
              {editing ? (
                <input type="number" min={1} max={holes.length} value={h.handicap}
                  onChange={e => updateHole(i, 'handicap', parseInt(e.target.value) || 1)}
                  style={{ ...inputStyle, width: 'auto' }} />
              ) : (
                <span style={{ color: 'var(--text3)' }}>{h.handicap}</span>
              )}
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}
