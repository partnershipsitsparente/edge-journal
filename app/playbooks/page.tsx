'use client'
import AppFrame from '@/components/AppFrame'

export default function PlaybooksPage() {
  return (
    <AppFrame>
      <div className="page-fade">
        <div className="page-title">Playbooks</div>
        <div className="page-sub">Document your setups and trading rules</div>
        <div className="empty-state" style={{ marginTop: 60 }}>
          <div style={{ fontSize: 48 }}>▶</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>Coming Soon</div>
          <div style={{ fontSize: 13 }}>Build and document your trading playbooks here</div>
        </div>
      </div>
    </AppFrame>
  )
}
