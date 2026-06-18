'use client'
import { useState } from 'react'
import Link from 'next/link'

const LINKS = [
  { href: '/', label: 'Inicio', icon: '🏠' },
  { href: '/round/new', label: 'Nueva partida', icon: '⛳' },
  { href: '/course/new', label: 'Nuevo campo', icon: '＋' },
  { href: '/course', label: 'Mis campos', icon: '🏌️' },
  { href: '/archive', label: 'Partidas anteriores', icon: '📁' },
]

export default function Menu() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Menú"
        style={{
          width: 42, height: 42, borderRadius: 10, flexShrink: 0,
          background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border2)',
          color: 'var(--text2)', fontSize: 18, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}
      >☰</button>

      {open && (
        <>
          {/* Backdrop */}
          <div
            onClick={() => setOpen(false)}
            style={{
              position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
              zIndex: 50
            }}
          />
          {/* Drawer */}
          <nav style={{
            position: 'fixed', top: 0, right: 0, bottom: 0, width: 260, maxWidth: '80vw',
            background: 'var(--surface)', borderLeft: '1px solid var(--border)',
            zIndex: 51, padding: '18px 14px',
            display: 'flex', flexDirection: 'column', gap: 4,
            boxShadow: '-8px 0 30px rgba(0,0,0,0.4)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, padding: '0 6px' }}>
              <span style={{ fontFamily: 'var(--display)', fontSize: 16, letterSpacing: 2, color: 'var(--text2)' }}>MENÚ</span>
              <button onClick={() => setOpen(false)} aria-label="Cerrar" style={{
                background: 'transparent', border: 'none', color: 'var(--text3)',
                fontSize: 22, cursor: 'pointer', lineHeight: 1
              }}>✕</button>
            </div>
            {LINKS.map(l => (
              <Link key={l.href} href={l.href} onClick={() => setOpen(false)} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 12px', borderRadius: 8,
                color: 'var(--text2)', fontSize: 15, fontWeight: 500
              }}>
                <span style={{ width: 22, textAlign: 'center' }}>{l.icon}</span>
                {l.label}
              </Link>
            ))}
          </nav>
        </>
      )}
    </>
  )
}
