'use client'
import { useState } from 'react'
import AppFrame from '@/components/AppFrame'
import { useStore } from '@/lib/store'

export default function JournalPage() {
  const { trades, journalNotes, setJournalNote } = useStore()
  const [period, setPeriod] = useState('30')
  const [openDays, setOpenDays] = useState<Set<string>>(new Set())
  const [jCalYear, setJCalYear] = useState(new Date().getFullYear())
  const [jCalMonth, setJCalMonth] = useState(new Date().getMonth())

  const cutoff = period === 'all' ? null : (() => { const d = new Date(); d.setDate(d.getDate() - parseInt(period)); return d })()
  const byDate: Record<string, typeof trades> = {}
  trades.forEach(t => {
    const d = (t.date || '').slice(0, 10)
    if (!d) return
    if (cutoff && new Date(d) < cutoff) return
    if (!byDate[d]) byDate[d] = []
    byDate[d].push(t)
  })
  const dates = Object.keys(byDate).sort((a, b) => b.localeCompare(a))

  const toggleDay = (date: string) => {
    setOpenDays(prev => { const n = new Set(prev); n.has(date) ? n.delete(date) : n.add(date); return n })
  }
  const collapseAll = () => setOpenDays(new Set())
  const expandAll = () => setOpenDays(new Set(dates))

  // Mini calendar
  const DAYS = ['Su','Mo','Tu','We','Th','Fr','Sa']
  const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
  const today = new Date().toISOString().slice(0, 10)
  const byDayCal: Record<string, number> = {}
  trades.forEach(t => {
    const d = (t.date || '').slice(0, 10)
    if (!d) return
    const [y, m] = d.split('-').map(Number)
    if (y === jCalYear && m - 1 === jCalMonth) byDayCal[d] = (byDayCal[d] || 0) + (t.pnl || 0)
  })
  const calFirst = new Date(jCalYear, jCalMonth, 1).getDay()
  const calDays = new Date(jCalYear, jCalMonth + 1, 0).getDate()
  const jCalNav = (dir: number) => {
    let m = jCalMonth + dir, y = jCalYear
    if (m > 11) { m = 0; y++ } else if (m < 0) { m = 11; y-- }
    setJCalMonth(m); setJCalYear(y)
  }

  return (
    <AppFrame>
      <div className="page-fade">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div className="page-title">Daily Journal</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn" onClick={collapseAll} style={{ fontSize: 11, padding: '6px 12px', color: 'var(--muted)' }}>Collapse all</button>
            <button className="btn" onClick={expandAll} style={{ fontSize: 11, padding: '6px 12px', color: 'var(--muted)' }}>Expand all</button>
            <select className="form-input" value={period} onChange={e => setPeriod(e.target.value)} style={{ width: 'auto', padding: '7px 12px', fontSize: 12 }}>
              <option value="30">Last 30 days</option>
              <option value="60">Last 60 days</option>
              <option value="90">Last 90 days</option>
              <option value="all">All time</option>
            </select>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 240px', gap: 16, alignItems: 'start' }}>
          <div>
            {!dates.length ? (
              <div className="empty-state"><div style={{ fontSize: 36 }}>📅</div><div>No trades in this period</div></div>
            ) : dates.map(date => {
              const dayTrades = byDate[date]
              const wins = dayTrades.filter(t => t.outcome === 'win').length
              const losses = dayTrades.filter(t => t.outcome === 'loss').length
              const decided = wins + losses
              const wr = decided ? (wins / decided * 100).toFixed(1) : '0.0'
              const totalPnl = dayTrades.reduce((s, t) => s + (t.pnl || 0), 0)
              const grossP = dayTrades.filter(t => (t.pnl || 0) > 0).reduce((s, t) => s + t.pnl, 0)
              const grossL = Math.abs(dayTrades.filter(t => (t.pnl || 0) < 0).reduce((s, t) => s + t.pnl, 0))
              const pf = grossL > 0 ? (grossP / grossL).toFixed(2) : grossP > 0 ? '∞' : '--'
              const pnlCls = totalPnl >= 0 ? 'var(--green)' : 'var(--red)'
              const dateLabel = new Date(date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
              const isOpen = openDays.has(date)
              const notes = journalNotes[date] || {}

              return (
                <div key={date} style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, marginBottom: 10, overflow: 'hidden', transition: 'border-color .2s' }}>
                  <div onClick={() => toggleDay(date)} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 20px', cursor: 'pointer', userSelect: 'none' }}>
                    <span style={{ color: 'var(--muted)', fontSize: 13, transition: 'transform .2s', transform: isOpen ? 'rotate(90deg)' : 'none' }}>›</span>
                    <span style={{ fontSize: 14, fontWeight: 700 }}>{dateLabel}</span>
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 14, fontWeight: 700, color: pnlCls }}>
                      Net P&L {totalPnl >= 0 ? '+' : ''}${Math.abs(totalPnl).toFixed(2)}
                    </span>
                    <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                      <button onClick={e => { e.stopPropagation(); if (!isOpen) toggleDay(date); setTimeout(() => document.getElementById(`pre-${date}`)?.focus(), 50) }}
                        style={{ fontSize: 11, fontWeight: 600, background: 'transparent', border: '1px solid var(--border)', color: 'var(--muted)', padding: '5px 12px', borderRadius: 6, cursor: 'pointer' }}>
                        ✏ Pre-market
                      </button>
                      <button onClick={e => { e.stopPropagation(); if (!isOpen) toggleDay(date); setTimeout(() => document.getElementById(`post-${date}`)?.focus(), 50) }}
                        style={{ fontSize: 11, fontWeight: 600, background: 'transparent', border: '1px solid var(--border)', color: 'var(--muted)', padding: '5px 12px', borderRadius: 6, cursor: 'pointer' }}>
                        📝 Post-market
                      </button>
                    </div>
                  </div>

                  {isOpen && (
                    <>
                      {/* SUMMARY */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', borderTop: '1px solid var(--border)', background: 'var(--bg3)' }}>
                        {[
                          { l: 'Total Trades', v: dayTrades.length },
                          { l: 'Win Rate', v: wr + '%' },
                          { l: 'Winners / Losers', v: `${wins} / ${losses}` },
                          { l: 'Profit Factor', v: pf },
                        ].map(s => (
                          <div key={s.l} style={{ padding: '12px 20px', borderRight: '1px solid var(--border)' }}>
                            <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 3 }}>{s.l}</div>
                            <div style={{ fontSize: 13, fontWeight: 600, fontFamily: 'var(--mono)' }}>{s.v}</div>
                          </div>
                        ))}
                      </div>

                      {/* NOTES */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, padding: '14px 20px', borderTop: '1px solid var(--border)' }}>
                        <div>
                          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 6 }}>🌅 Pre-Market Bias</div>
                          <textarea id={`pre-${date}`} defaultValue={notes.pre || ''} onBlur={e => setJournalNote(date, 'pre', e.target.value)}
                            placeholder="What's your bias? What setup are you ONLY taking today?"
                            style={{ width: '100%', background: 'var(--bg4)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', color: 'var(--text)', fontFamily: 'inherit', fontSize: 12, lineHeight: 1.6, resize: 'vertical', outline: 'none', minHeight: 70 }} />
                        </div>
                        <div>
                          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 6 }}>📋 Post-Market Review</div>
                          <textarea id={`post-${date}`} defaultValue={notes.post || ''} onBlur={e => setJournalNote(date, 'post', e.target.value)}
                            placeholder="Did you follow your plan? What went well? What would you change?"
                            style={{ width: '100%', background: 'var(--bg4)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', color: 'var(--text)', fontFamily: 'inherit', fontSize: 12, lineHeight: 1.6, resize: 'vertical', outline: 'none', minHeight: 70 }} />
                        </div>
                      </div>

                      {/* TRADES TABLE */}
                      <div style={{ borderTop: '1px solid var(--border)' }}>
                        <table className="trades-table">
                          <thead><tr><th>Time</th><th>Ticker</th><th>Side</th><th>Net P&L</th><th>Outcome</th><th>R:R</th><th>Notes</th></tr></thead>
                          <tbody>
                            {dayTrades.map(t => (
                              <tr key={t.id}>
                                <td style={{ color: 'var(--muted)', fontFamily: 'var(--mono)', fontSize: 11 }}>{(t.datetime || '').slice(11, 16) || '--'}</td>
                                <td style={{ fontWeight: 700 }}>{t.ticker}</td>
                                <td><span className={`pill ${t.side}`}>{(t.side || '').toUpperCase()}</span></td>
                                <td style={{ fontFamily: 'var(--mono)', fontWeight: 600, color: (t.pnl || 0) > 0 ? 'var(--green)' : (t.pnl || 0) < 0 ? 'var(--red)' : 'var(--muted)' }}>
                                  {(t.pnl || 0) >= 0 ? '+' : ''}${Math.abs(t.pnl || 0).toFixed(2)}
                                </td>
                                <td><span className={`pill ${t.outcome}`}>{t.outcome === 'win' ? 'Win' : t.outcome === 'loss' ? 'Loss' : 'BE'}</span></td>
                                <td style={{ fontFamily: 'var(--mono)', color: 'var(--muted)' }}>{t.rr != null ? t.rr.toFixed(2) + 'R' : '--'}</td>
                                <td style={{ color: 'var(--muted)', fontSize: 11, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.notes || ''}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </div>
              )
            })}
          </div>

          {/* MINI CALENDAR */}
          <div className="card" style={{ position: 'sticky', top: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <button onClick={() => jCalNav(-1)} className="btn" style={{ padding: '4px 8px', fontSize: 11 }}>‹</button>
              <span style={{ fontSize: 12, fontWeight: 600 }}>{MONTHS[jCalMonth]} {jCalYear}</span>
              <button onClick={() => jCalNav(1)} className="btn" style={{ padding: '4px 8px', fontSize: 11 }}>›</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2 }}>
              {DAYS.map(d => <div key={d} style={{ fontSize: 9, color: 'var(--muted)', textAlign: 'center', padding: '3px 0', fontWeight: 600 }}>{d}</div>)}
              {Array.from({ length: calFirst }).map((_, i) => <div key={`e${i}`} />)}
              {Array.from({ length: calDays }).map((_, i) => {
                const d = i + 1
                const key = `${jCalYear}-${String(jCalMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
                const pnl = byDayCal[key]
                const isT = key === today
                const bg = pnl != null ? (pnl >= 0 ? 'rgba(0,208,132,0.15)' : 'rgba(255,77,77,0.1)') : 'transparent'
                return (
                  <div key={key} onClick={() => pnl != null && document.getElementById(`jday-${key}`)?.scrollIntoView({ behavior: 'smooth' })}
                    style={{ aspectRatio: '1', borderRadius: 4, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, cursor: pnl != null ? 'pointer' : 'default', color: pnl != null ? (pnl >= 0 ? 'var(--green)' : 'var(--red)') : 'var(--muted)', fontWeight: pnl != null ? 700 : 400, boxShadow: isT ? '0 0 0 1px var(--accent)' : 'none' }}>
                    {d}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </AppFrame>
  )
}
