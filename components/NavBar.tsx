'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { useStore } from '@/lib/store'

const NAV = [
  { href: '/dashboard',  label: 'Dashboard',        icon: '▦' },
  { href: '/journal',    label: 'Daily Journal',     icon: '≡' },
  { href: '/trades',     label: 'Trades',            icon: '↗' },
  { href: '/notebook',   label: 'Notebook',          icon: '□' },
  { href: '/reports',    label: 'Reports',           icon: '⊞', badge: 'NEW' },
  { href: '/playbooks',  label: 'Playbooks',         icon: '▶', badge: 'NEW' },
  { href: '/progress',   label: 'Progress Tracker',  icon: '◔' },
]

// Global modal state - simple approach using a custom event
export function openGlobalTradeModal() {
  window.dispatchEvent(new CustomEvent('open-trade-modal'))
}

export default function NavBar() {
  const path = usePathname()
  const userId = useStore(s => s.userId)

  const handleSignOut = async () => {
    await signOut(auth)
    window.location.href = '/'
  }

  return (
    <aside style={{
      width: 220, minWidth: 220, height: '100vh',
      background: 'var(--bg2)', borderRight: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column', padding: '0 0 20px'
    }}>
      <div style={{
        padding: '24px 20px 20px',
        fontFamily: 'Syne, sans-serif', fontSize: 22, fontWeight: 800,
        letterSpacing: -1, color: '#fff',
        borderBottom: '1px solid var(--border)', marginBottom: 8
      }}>
        EDGE<span style={{ color: 'var(--accent)' }}>.</span>
      </div>

      <button
        onClick={openGlobalTradeModal}
        style={{
          margin: '12px 14px',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          background: 'var(--accent)', color: '#fff', borderRadius: 10,
          padding: '11px 16px', fontSize: 13, fontWeight: 600,
          border: 'none', cursor: 'pointer', fontFamily: 'inherit',
          transition: 'opacity .15s, transform .15s',
          animation: 'pulse-btn 2.5s infinite',
        }}
        onMouseOver={e => { (e.currentTarget as HTMLElement).style.opacity = '.85'; (e.currentTarget as HTMLElement).style.animation = 'none' }}
        onMouseOut={e => { (e.currentTarget as HTMLElement).style.opacity = '1'; (e.currentTarget as HTMLElement).style.animation = 'pulse-btn 2.5s infinite' }}
      >
        + Add Trade
      </button>

      <nav style={{ flex: 1 }}>
        {NAV.map(item => {
          const active = path === item.href || path.startsWith(item.href + '/')
          return (
            <Link key={item.href} href={item.href} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '9px 20px', fontSize: 13, fontWeight: 500,
              color: active ? 'var(--text)' : 'var(--muted)',
              background: active ? 'var(--bg4)' : 'transparent',
              borderRadius: 8, margin: '1px 8px',
              textDecoration: 'none', transition: 'all .15s',
              boxShadow: active ? 'inset 3px 0 0 var(--accent)' : 'none',
            }}>
              <span style={{ opacity: active ? 1 : 0.7, fontSize: 14 }}>{item.icon}</span>
              {item.label}
              {item.badge && (
                <span style={{
                  marginLeft: 'auto', fontSize: 9, fontWeight: 700,
                  background: 'var(--accent)', color: '#fff',
                  padding: '2px 6px', borderRadius: 4
                }}>{item.badge}</span>
              )}
            </Link>
          )
        })}
      </nav>

      <div style={{ padding: '12px 14px', borderTop: '1px solid var(--border)' }}>
        {userId && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ flex: 1, fontSize: 12, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              Signed in
            </div>
            <button onClick={handleSignOut} style={{
              background: 'transparent', border: '1px solid var(--border)',
              color: 'var(--muted)', padding: '4px 10px', borderRadius: 6,
              fontSize: 11, cursor: 'pointer', fontFamily: 'inherit'
            }}>
              Out
            </button>
          </div>
        )}
      </div>
    </aside>
  )
}
