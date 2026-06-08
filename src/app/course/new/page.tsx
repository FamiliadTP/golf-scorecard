'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

const inputStyle = {
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  color: 'var(--text)',
  fontFamily: 'var(--body)',
  padding: '10px 12px',
  fontSize: 14,
  outline: 'none',
  width: '100%',
  transition: 'border-color 0.2s'
}

const labelStyle = {
  display: 'block',
  fontSize: 11,
  color: 'var(--text3)',
  letterSpacing: 1,
  textTransform: 'uppercase' as const,
  marginBottom: 6
}

export default function NewCourse() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [club, setClub] = useState('')
  const [holesCount, setHolesCount] = useState<9 | 18>(18)
  const [holes, setHoles] = useState(() =>
    Array.from({ length: 18 }, (_, i) => ({
      hole_number: i + 1,
      par: 4,
      handicap: i + 1
    }))
  )
  const [saving, setSaving] = useState(false)

  const setHoleCount = (n: 9 | 18) => {
    setHolesCount(n)
    setHoles(Array.from({ length: n }, (_, i) => ({
      hole_number: i + 1,
      par: holes[i]?.par ?? 4,
      handicap: holes[i]?.handicap ?? (i + 1)
    })))
  }

  const updateHole = (idx: number, field: 'par' | 'handicap', val: number) => {
    setHoles(prev => prev.map((h, i) => i === idx ? { ...h, [field]: val } : h))
  }

  const handleSave = async () => {
    if (!name.trim()) return
    setSaving(true)
    const { data: course, error } = await supabase
      .from('courses')
      .insert({ name: name.trim(), club: club.trim(), holes_count: holesCount })
      .select().single()

    if (error || !course) { setSaving(false); alert('Error al guardar'); return }

    await supabase.from('holes').insert(
      holes.map(h => ({ ...h, course_id: course.id }))
    )
    router.push(`/course/${course.id}`)
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <header style={{
        background: 'var(--surface)', borderBottom: '1px solid var(--border)',
        padding: '20px 20px 16px'
      }}>
        <div style={{ maxWidth: 640, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 12 }}>
          <Link href="/course" style={{ color: 'var(--text3)', fontSize: 20 }}>←</Link>
          <h1 style={{ fontFamily: 'var(--display)', fontSize: 26, letterSpacing: 2 }}>NUEVO CAMPO</h1>
        </div>
      </header>

      <main style={{ maxWidth: 640, margin: '0 auto', padding: '24px 16px' }}>
        {/* Course info */}
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 12, padding: '20px', marginBottom: 20
        }}>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Nombre del campo *</label>
            <input style={inputStyle} value={name} onChange={e => setName(e.target.value)} placeholder="Ej: Club de Golf Maipo" />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Club</label>
            <input style={inputStyle} value={club} onChange={e => setClub(e.target.value)} placeholder="Ej: Los Leones" />
          </div>
          <div>
            <label style={labelStyle}>Número de hoyos</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {([9, 18] as const).map(n => (
                <button key={n} onClick={() => setHoleCount(n)} style={{
                  padding: '8px 24px', borderRadius: 8,
                  border: '1px solid var(--border)',
                  background: holesCount === n ? '#2dd4bf' : 'transparent',
                  color: holesCount === n ? '#071209' : 'var(--text3)',
                  fontWeight: holesCount === n ? 700 : 400,
                  fontSize: 14, cursor: 'pointer'
                }}>{n} hoyos</button>
              ))}
            </div>
          </div>
        </div>

        {/* Holes table */}
        <h2 style={{
          fontFamily: 'var(--display)', fontSize: 16, letterSpacing: 2,
          color: 'var(--text3)', marginBottom: 12
        }}>HOYOS — PAR Y VENTAJA (HCP)</h2>

        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 12, overflow: 'hidden', marginBottom: 24
        }}>
          <div style={{
            display: 'grid', gridTemplateColumns: '48px 1fr 1fr',
            background: 'var(--surface2)', borderBottom: '1px solid var(--border)',
            padding: '8px 16px', gap: 8
          }}>
            <span style={{ fontSize: 11, color: 'var(--text3)', letterSpacing: 1 }}>HOYO</span>
            <span style={{ fontSize: 11, color: 'var(--text3)', letterSpacing: 1 }}>PAR</span>
            <span style={{ fontSize: 11, color: 'var(--text3)', letterSpacing: 1 }}>HCP</span>
          </div>
          {holes.map((h, i) => (
            <div key={i} style={{
              display: 'grid', gridTemplateColumns: '48px 1fr 1fr',
              padding: '8px 16px', gap: 8,
              borderBottom: i < holes.length - 1 ? '1px solid var(--border)' : 'none',
              background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)',
              alignItems: 'center'
            }}>
              <span style={{
                fontFamily: 'var(--display)', fontSize: 18, color: 'var(--text2)',
                letterSpacing: 1
              }}>{h.hole_number}</span>
              <select
                value={h.par}
                onChange={e => updateHole(i, 'par', parseInt(e.target.value))}
                style={{ ...inputStyle, width: 'auto', padding: '6px 10px' }}
              >
                {[3, 4, 5].map(p => <option key={p} value={p}>{p}</option>)}
              </select>
              <input
                type="number" min={1} max={holesCount}
                value={h.handicap}
                onChange={e => updateHole(i, 'handicap', parseInt(e.target.value) || 1)}
                style={{ ...inputStyle, width: 'auto', padding: '6px 10px' }}
              />
            </div>
          ))}
        </div>

        <button
          onClick={handleSave}
          disabled={saving || !name.trim()}
          style={{
            width: '100%', padding: '14px',
            background: saving || !name.trim() ? 'var(--border)' : '#2dd4bf',
            color: saving || !name.trim() ? 'var(--text3)' : '#071209',
            border: 'none', borderRadius: 10,
            fontSize: 16, fontWeight: 700, cursor: saving ? 'wait' : 'pointer',
            fontFamily: 'var(--display)', letterSpacing: 2
          }}
        >
          {saving ? 'GUARDANDO…' : 'GUARDAR CAMPO'}
        </button>
      </main>
    </div>
  )
}
