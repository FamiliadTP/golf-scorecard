'use client'
export const dynamic = 'force-dynamic'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import TopBar from '@/components/TopBar'
import { supabase } from '@/lib/supabase'

const inputStyle = {
  background: 'rgba(27,42,26,0.04)',
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
  const [courseType, setCourseType] = useState<'h9' | 'h18' | 'loop'>('h18')
  const [loopLabel, setLoopLabel] = useState('')
  const holesCount: 9 | 18 = courseType === 'h18' ? 18 : 9
  const [holes, setHoles] = useState(() =>
    Array.from({ length: 18 }, (_, i) => ({
      hole_number: i + 1,
      par: 4,
      handicap: i + 1
    }))
  )
  const [saving, setSaving] = useState(false)

  const setType = (t: 'h9' | 'h18' | 'loop') => {
    setCourseType(t)
    const n = t === 'h18' ? 18 : 9
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
    if (courseType === 'loop' && !loopLabel.trim()) return
    setSaving(true)
    const { data: course, error } = await supabase
      .from('courses')
      .insert({
        name: name.trim(),
        club: club.trim(),
        holes_count: holesCount,
        loop_label: courseType === 'loop' ? loopLabel.trim() : null
      })
      .select().single()

    if (error || !course) { setSaving(false); alert('Error al guardar'); return }

    await supabase.from('holes').insert(
      holes.map(h => ({ ...h, course_id: course.id }))
    )
    router.push(`/course/${course.id}`)
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <TopBar title="Nuevo Campo" />

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
            <label style={labelStyle}>Tipo de campo</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {([
                { t: 'h9', label: '9 hoyos' },
                { t: 'h18', label: '18 hoyos' },
                { t: 'loop', label: 'Combinación de 9' },
              ] as const).map(({ t, label }) => (
                <button key={t} onClick={() => setType(t)} style={{
                  padding: '8px 18px', borderRadius: 8,
                  border: '1px solid var(--border)',
                  background: courseType === t ? '#1B4332' : 'transparent',
                  color: courseType === t ? '#F1EEE4' : 'var(--text3)',
                  fontWeight: courseType === t ? 700 : 400,
                  fontSize: 14, cursor: 'pointer'
                }}>{label}</button>
              ))}
            </div>
            {courseType === 'loop' && (
              <p style={{ fontSize: 12, color: 'var(--text3)', marginTop: 8, lineHeight: 1.4 }}>
                Vuelta de 9 hoyos con ventajas 1–9, que se combina con otra vuelta al armar la
                partida. Dale un apellido (ej: Sur, Este, Norte).
              </p>
            )}
          </div>

          {courseType === 'loop' && (
            <div style={{ marginTop: 16 }}>
              <label style={labelStyle}>Apellido de la vuelta *</label>
              <input
                style={inputStyle}
                value={loopLabel}
                onChange={e => setLoopLabel(e.target.value)}
                placeholder="Ej: Este"
              />
            </div>
          )}
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
              background: i % 2 === 0 ? 'transparent' : 'rgba(27,42,26,0.02)',
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
          disabled={saving || !name.trim() || (courseType === 'loop' && !loopLabel.trim())}
          style={{
            width: '100%', padding: '14px',
            background: saving || !name.trim() || (courseType === 'loop' && !loopLabel.trim()) ? 'var(--border)' : '#1B4332',
            color: saving || !name.trim() || (courseType === 'loop' && !loopLabel.trim()) ? 'var(--text3)' : '#F1EEE4',
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
