'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase, Course, Hole } from '@/lib/supabase'
import TopBar from '@/components/TopBar'
import CourseStats from '@/components/CourseStats'
import { isAdminUnlocked, tryUnlockAdmin } from '@/lib/admin'

export default function CourseDetail() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [course, setCourse] = useState<Course | null>(null)
  const [holes, setHoles] = useState<Hole[]>([])
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  // Borrar campo (protegido con clave de admin)
  const [delStep, setDelStep] = useState<'idle' | 'pin' | 'confirm'>('idle')
  const [pinInput, setPinInput] = useState('')
  const [pinError, setPinError] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [delError, setDelError] = useState<string | null>(null)

  const startDelete = () => {
    setDelError(null)
    if (isAdminUnlocked()) setDelStep('confirm')
    else { setPinInput(''); setPinError(false); setDelStep('pin') }
  }
  const submitPin = () => {
    if (tryUnlockAdmin(pinInput.trim())) setDelStep('confirm')
    else setPinError(true)
  }
  const confirmDelete = async () => {
    setDeleting(true); setDelError(null)
    const { error } = await supabase.from('courses').delete().eq('id', id)
    setDeleting(false)
    if (error) {
      setDelError('No se pudo eliminar. Probablemente el campo tiene partidas asociadas; primero hay que borrar esas partidas.')
      setDelStep('idle')
      return
    }
    router.push('/course')
  }

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
    background: 'rgba(27,42,26,0.04)', border: '1px solid var(--border)',
    borderRadius: 6, color: 'var(--text)', fontFamily: 'var(--body)',
    padding: '6px 10px', fontSize: 14, outline: 'none'
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <TopBar />
      <header style={{
        background: 'var(--surface)', borderBottom: '1px solid var(--border)',
        padding: '20px 20px 16px'
      }}>
        <div style={{ maxWidth: 640, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
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
              background: editing ? '#1B4332' : 'transparent',
              border: editing ? 'none' : '1px solid var(--border2)',
              color: editing ? '#F1EEE4' : 'var(--text2)',
              fontWeight: 600, fontSize: 13, cursor: 'pointer'
            }}>
              {saving ? '…' : editing ? 'Guardar' : '✏️ Editar'}
            </button>
          </div>
          <Link href="/round/new" style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: '#1B4332', color: '#F1EEE4',
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
              background: i % 2 === 0 ? 'transparent' : 'rgba(27,42,26,0.02)',
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

        {/* Histórico por hoyo de la cancha */}
        <div style={{ marginTop: 24 }}>
          <CourseStats courseId={id} />
        </div>

        {/* Zona de peligro — borrar campo (solo admin) */}
        <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
          {delError && (
            <div style={{ marginBottom: 12, padding: '10px 12px', borderRadius: 8, background: 'rgba(122,46,46,0.06)', border: '1px solid rgba(122,46,46,0.15)', fontSize: 12, color: '#7A2E2E' }}>{delError}</div>
          )}
          <button onClick={startDelete} style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: 'rgba(122,46,46,0.06)', border: '1px solid rgba(122,46,46,0.15)',
            color: '#7A2E2E', borderRadius: 8, padding: '9px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer'
          }}>🗑️ Eliminar campo</button>
          <p style={{ fontSize: 11, color: 'var(--text3)', marginTop: 8 }}>Requiere clave de administrador.</p>
        </div>
      </main>

      {/* Modal: clave de admin */}
      {delStep === 'pin' && (
        <div onClick={() => setDelStep('idle')} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 22, maxWidth: 320, width: '100%' }}>
            <h3 style={{ fontFamily: 'var(--display)', fontSize: 16, letterSpacing: 1, marginBottom: 10 }}>CLAVE DE ADMINISTRADOR</h3>
            <p style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 14 }}>Ingresa la clave para poder borrar campos en esta sesión.</p>
            <input
              type="password" inputMode="numeric" autoFocus value={pinInput}
              onChange={e => { setPinInput(e.target.value); setPinError(false) }}
              onKeyDown={e => { if (e.key === 'Enter') submitPin() }}
              placeholder="Clave"
              style={{ width: '100%', boxSizing: 'border-box', background: 'rgba(27,42,26,0.04)', border: `1px solid ${pinError ? '#7A2E2E' : 'var(--border)'}`, borderRadius: 8, color: 'var(--text)', padding: '10px 12px', fontSize: 16, outline: 'none', marginBottom: pinError ? 6 : 14 }}
            />
            {pinError && <p style={{ fontSize: 12, color: '#7A2E2E', marginBottom: 14 }}>Clave incorrecta.</p>}
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setDelStep('idle')} style={{ flex: 1, padding: '10px', borderRadius: 8, background: 'transparent', border: '1px solid var(--border2)', color: 'var(--text2)', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>Cancelar</button>
              <button onClick={submitPin} style={{ flex: 1, padding: '10px', borderRadius: 8, background: '#1B4332', border: 'none', color: '#F1EEE4', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>Continuar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: confirmar borrado */}
      {delStep === 'confirm' && (
        <div onClick={() => setDelStep('idle')} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--surface)', border: '1px solid rgba(122,46,46,0.18)', borderRadius: 14, padding: 22, maxWidth: 340, width: '100%' }}>
            <h3 style={{ fontFamily: 'var(--display)', fontSize: 16, letterSpacing: 1, marginBottom: 10, color: '#7A2E2E' }}>ELIMINAR CAMPO</h3>
            <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 16, lineHeight: 1.5 }}>
              ¿Seguro que quieres eliminar <strong>{course.name}</strong>{course.loop_label ? ` · ${course.loop_label}` : ''}? Esta acción no se puede deshacer.
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setDelStep('idle')} disabled={deleting} style={{ flex: 1, padding: '10px', borderRadius: 8, background: 'transparent', border: '1px solid var(--border2)', color: 'var(--text2)', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>Cancelar</button>
              <button onClick={confirmDelete} disabled={deleting} style={{ flex: 1, padding: '10px', borderRadius: 8, background: '#7A2E2E', border: 'none', color: '#F3E2E0', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>{deleting ? 'Eliminando…' : 'Eliminar'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
