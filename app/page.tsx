'use client'
import { useState, useEffect, useRef } from 'react'
import AppFrame from '@/components/AppFrame'
import { useStore } from '@/lib/store'
import { Chart, registerables } from 'chart.js'
Chart.register(...registerables)

function getDatesInRange(days: number | 'all'): string[] {
  const dates: string[] = []
  const now = new Date()
  const count = days === 'all' ? 365 : days
  for (let i = 0; i < count; i++) {
    const d = new Date(now)
    d.setDate(now.getDate() - i)
    dates.push(d.toISOString().slice(0, 10))
  }
  return dates
}

function Sparkline({ trades }: { trades: { pnl: number; datetime?: string; date?: string }[] }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const chartRef = useRef<Chart | null>(null)

  useEffect(() => {
    if (!ref.current) return
    const sorted = [...trades].sort((a, b) => (a.datetime || a.date || '').localeCompare(b.datetime || b.date || ''))
    let cum = 0
    const pts = [0, ...sorted.map(t => { cum += t.pnl || 0; return +cum.toFixed(2) })]
    const W = ref.current.width, H = ref.current.height
    const mn = Math.min(...pts), mx = Math.max(...pts), rng = mx - mn || 1
    const pad = 4
    const xs = pts.map((_, i) => pad + (i / (pts.length - 1 || 1)) * (W - pad * 2))
    const ys = pts.map(v => pad + (1 - (v - mn) / rng) * (H - pad * 2))
    const isPos = pts[pts.length - 1] >= 0
    const ctx = ref.current.getContext('2d')!
    ctx.clearRect(0, 0, W, H)
    ctx.beginPath(); ctx.moveTo(xs[0], ys[0])
    xs.forEach((x, i) => ctx.lineTo(x, ys[i]))
    ctx.lineTo(xs[xs.length - 1], H); ctx.lineTo(xs[0], H); ctx.closePath()
    ctx.fillStyle = isPos ? 'rgba(0,208,132,0.15)' : 'rgba(255,77,77,0.15)'; ctx.fill()
    ctx.beginPath(); ctx.moveTo(xs[0], ys[0])
    xs.forEach((x, i) => ctx.lineTo(x, ys[i]))
    ctx.strokeStyle = isPos ? '#00d084' : '#ff4d4d'; ctx.lineWidth = 1.8; ctx.stroke()
  }, [trades])

  return <canvas ref={ref} width={180} height={70} />
}

export default function JournalPage() {
  const { trades, journalNotes, setJournalNote } = useStore()
  const [period, setPeriod] = useState('30')
  const [openDays, setOpenDays] = useState<Set<string>>(new Set())
  const [jCalYear, setJCalYear] = useState(new Date().getFullYear())
  const [jCalMonth, setJCalMonth] = useState(new Date().getMonth())

  const allDates = getDatesInRange(period === 'all' ? 'all' : parseInt(period))

  // Only show dates that have trades OR have journal notes
  const visibleDates = allDates.filter(date => {
    const hasTrades = trades.some(t => (t.date || '').slice(0, 10) === date)
    const hasNotes = journalNotes[date] && (journalNotes[date].pre || journalNotes[date].post)
    return hasTrades || hasNotes
  })

  // Also include today always
  const today = new Date().toISOString().slice(0, 10)
  const displayDates = [today, ...visibleDates.filter(d => d !== today)]
    .filter((d, i, arr) => arr.indexOf(d) === i)
    .sort((a, b) => b.localeCompare(a))

  const toggleDay = (date: string) => {
    setOpenDays(prev => { const n = new Set(prev); n.has(date) ? n.delete(date) : n.add(date); return n })
  }
  const collapseAll = () => setOpenDays(new Set())
  const expandAll = () => setOpenDays(new Set(displayDates))

  // Auto-open today
  useEffect(() => {
    setOpenDays(new Set([today]))
  }, [])

  const DAYS = ['Su','Mo','Tu','We','Th','Fr','Sa']
  const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
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
            {displayDates.map(date => {
              const dayTrades = trades.filter(t => (t.date || '').slice(0, 10) === date)
              const wins = dayTrades.filter(t => t.outcome === 'win').length
              const losses = dayTrades.filter(t => t.outcome === 'loss').length
              const decided = wins + losses
              const wr = decided ? (wins / decided * 100).toFixed(1) : '0.0'
              const totalPnl = dayTrades.reduce((s, t) => s + (t.pnl || 0), 0)
              const grossP = dayTrades.filter(t => (t.pnl || 0) > 0).reduce((s, t) => s + t.pnl, 0)
              const grossL = Math.abs(dayTrades.filter(t => (t.pnl || 0) < 0).reduce((s, t) => s + t.pnl, 0))
              const pf = grossL > 0 ? (grossP / grossL).toFixed(2) : grossP > 0 ? '∞' : '--'
              const pnlColor = totalPnl > 0 ? 'var(--green)' : totalPnl < 0 ? 'var(--red)' : 'var(--muted)'
              const isToday = date === today
              const dateLabel = new Date(date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
              const isOpen = openDays.has(date)
              const notes = journalNotes[date] || {}

              return (
                <div key={date} id={`jday-${date}`} style={{
                  background: 'var(--bg2)',
                  border: `1px solid ${isToday ? 'rgba(124,111,205,0.4)' : 'var(--border)'}`,
                  borderRadius: 12, marginBottom: 10, overflow: 'hidden',
                  boxShadow: isToday ? '0 0 0 1px rgba(124,111,205,0.15)' : 'none'
                }}>
                  {/* HEADER */}
                  <div onClick={() => toggleDay(date)} style={{
                    display: 'flex', alignItems: 'center', gap: 14,
                    padding: '14px 20px', cursor: 'pointer', userSelect: 'none',
                    transition: 'background .15s'
                  }}>
                    <span style={{ color: 'var(--muted)', fontSize: 14, transition: 'transform .2s', display: 'inline-block', transform: isOpen ? 'rotate(90deg)' : 'none' }}>›</span>
                    <span style={{ fontSize: 14, fontWeight: 700, color: isToday ? 'var(--accent)' : 'var(--text)' }}>
                      {isToday ? 'Today · ' : ''}{dateLabel}
                    </span>
                    {dayTrades.length > 0 && (
                      <span style={{ fontFamily: 'var(--mono)', fontSize: 14, fontWeight: 700, color: pnlColor }}>
                        Net P&L {totalPnl >= 0 ? '+' : ''}${Math.abs(totalPnl).toFixed(2)}
                      </span>
                    )}
                    {dayTrades.length === 0 && (
                      <span style={{ fontSize: 12, color: 'var(--muted)' }}>No trades</span>
                    )}
                    <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                      <button onClick={e => { e.stopPropagation(); if (!isOpen) toggleDay(date); setTimeout(() => document.getElementById(`pre-${date}`)?.focus(), 80) }}
                        style={{ fontSize: 11, fontWeight: 600, background: 'transparent', border: '1px solid var(--border)', color: 'var(--muted)', padding: '5px 12px', borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                        ✏ Pre-market
                      </button>
                      <button onClick={e => { e.stopPropagation(); if (!isOpen) toggleDay(date); setTimeout(() => document.getElementById(`post-${date}`)?.focus(), 80) }}
                        style={{ fontSize: 11, fontWeight: 600, background: 'transparent', border: '1px solid var(--border)', color: 'var(--muted)', padding: '5px 12px', borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                        📝 Post-market
                      </button>
                    </div>
                  </div>

                  {isOpen && (
                    <>
                      {/* SUMMARY ROW (only if trades) */}
                      {dayTrades.length > 0 && (
                        <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr 1fr 1fr 1fr', borderTop: '1px solid var(--border)', background: 'var(--bg3)' }}>
                          <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRight: '1px solid var(--border)' }}>
                            <Sparkline trades={dayTrades} />
                          </div>
                          {[
                            { l: 'Total Trades', v: String(dayTrades.length) },
                            { l: 'Win Rate', v: wr + '%' },
                            { l: 'Winners / Losers', v: `${wins} / ${losses}` },
                            { l: 'Profit Factor', v: pf },
                          ].map((s, i) => (
                            <div key={s.l} style={{ padding: '12px 16px', borderRight: i < 3 ? '1px solid var(--border)' : 'none' }}>
                              <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 4 }}>{s.l}</div>
                              <div style={{ fontSize: 13, fontWeight: 600, fontFamily: 'var(--mono)' }}>{s.v}</div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* NOTES */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, padding: '14px 20px', borderTop: '1px solid var(--border)' }}>
                        <div>
                          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 6 }}>🌅 Pre-Market Bias</div>
                          <textarea
                            id={`pre-${date}`}
                            defaultValue={notes.pre || ''}
                            onBlur={e => setJournalNote(date, 'pre', e.target.value)}
                            placeholder="What's your bias? What setup are you ONLY taking today? What would make today a success even if red?"
                            style={{ width: '100%', background: 'var(--bg4)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', color: 'var(--text)', fontFamily: 'inherit', fontSize: 12, lineHeight: 1.6, resize: 'vertical', outline: 'none', minHeight: 80, transition: 'border-color .15s' }}
                            onFocus={e => e.target.style.borderColor = 'var(--accent)'}
                            onBlurCapture={e => (e.target as HTMLTextAreaElement).style.borderColor = 'var(--border)'}
                          />
                        </div>
                        <div>
                          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 6 }}>📋 Post-Market Review</div>
                          <textarea
                            id={`post-${date}`}
                            defaultValue={notes.post || ''}
                            onBlur={e => setJournalNote(date, 'post', e.target.value)}
                            placeholder="Did you follow your plan? What went well? What would you do differently?"
                            style={{ width: '100%', background: 'var(--bg4)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', color: 'var(--text)', fontFamily: 'inherit', fontSize: 12, lineHeight: 1.6, resize: 'vertical', outline: 'none', minHeight: 80, transition: 'border-color .15s' }}
                            onFocus={e => e.target.style.borderColor = 'var(--accent)'}
                            onBlurCapture={e => (e.target as HTMLTextAreaElement).style.borderColor = 'var(--border)'}
                          />
                        </div>
                      </div>

                      {/* TRADES TABLE */}
                      {dayTrades.length > 0 && (
                        <div style={{ borderTop: '1px solid var(--border)' }}>
                          <table className="trades-table">
                            <thead>
                              <tr>
                                <th>Time</th><th>Ticker</th><th>Side</th>
                                <th>Net P&L</th><th>Outcome</th><th>R:R</th><th>Notes</th>
                              </tr>
                            </thead>
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
                      )}
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
                const hasNote = journalNotes[key] && (journalNotes[key].pre || journalNotes[key].post)
                const bg = pnl != null ? (pnl >= 0 ? 'rgba(0,208,132,0.15)' : 'rgba(255,77,77,0.1)') : hasNote ? 'rgba(124,111,205,0.1)' : 'transparent'
                const color = pnl != null ? (pnl >= 0 ? 'var(--green)' : 'var(--red)') : hasNote ? 'var(--accent)' : 'var(--muted)'
                return (
                  <div key={key}
                    onClick={() => { setOpenDays(prev => new Set([...prev, key])); document.getElementById(`jday-${key}`)?.scrollIntoView({ behavior: 'smooth' }) }}
                    style={{ aspectRatio: '1', borderRadius: 4, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, cursor: 'pointer', color, fontWeight: pnl != null || hasNote ? 700 : 400, boxShadow: isT ? '0 0 0 1px var(--accent)' : 'none', transition: 'transform .1s' }}>
                    {d}
                  </div>
                )
              })}
            </div>
            <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
              <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 6, fontWeight: 600 }}>LEGEND</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: 'var(--muted)' }}><div style={{ width: 10, height: 10, borderRadius: 2, background: 'rgba(0,208,132,0.15)' }} /> Green day</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: 'var(--muted)' }}><div style={{ width: 10, height: 10, borderRadius: 2, background: 'rgba(255,77,77,0.1)' }} /> Red day</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: 'var(--muted)' }}><div style={{ width: 10, height: 10, borderRadius: 2, background: 'rgba(124,111,205,0.1)' }} /> Journal note</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppFrame>
  )
}
