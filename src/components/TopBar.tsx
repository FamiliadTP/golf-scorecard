'use client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Menu from './Menu'

export default function TopBar({ title }: { title?: string }) {
  const router = useRouter()
  return (
    <header style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '12px 16px' }}>
      <div style={{ maxWidth: 800, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 10 }}>
        <button onClick={() => router.back()} aria-label="Volver" style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          background: 'rgba(27,42,26,0.06)', border: '1px solid var(--border2)',
          color: 'var(--text2)', borderRadius: 8, padding: '8px 12px',
          fontSize: 14, fontWeight: 600, cursor: 'pointer', flexShrink: 0
        }}>← Volver</button>
        <Link href="/" aria-label="Inicio" style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
          <div style={{
            width: 32, height: 32, borderRadius: '50%',
            background: 'linear-gradient(135deg, #1B4332, #2F6B4F)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 16, flexShrink: 0
          }}>⛳</div>
          {title && <span style={{ fontFamily: 'var(--display)', fontSize: 18, letterSpacing: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</span>}
        </Link>
        <Menu />
      </div>
    </header>
  )
}
