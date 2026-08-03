'use client'
import AppFrame from '@/components/AppFrame'

export default function ProgressPage() {
  return (
    <AppFrame>
      <div className="page-fade">
        <div className="page-title">Progress Tracker</div>
        <div className="page-sub">Track your trading goals and milestones</div>
        <div className="empty-state" style={{ marginTop: 60 }}>
          <div style={{ fontSize: 48 }}>◔</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>Coming Soon</div>
          <div style={{ fontSize: 13 }}>Set goals and track your progress over time</div>
        </div>
      </div>
    </AppFrame>
  )
}
