'use client'
import { useState, useEffect, useRef } from 'react'
import AppFrame from '@/components/AppFrame'
import TradeModal from '@/components/TradeModal'
import { useStore } from '@/lib/store'
import { periodFilter, calcPnl, getWins, getLosses, getDecided, getWinRate, getProfitFactor, formatPnl, getStreaks, getTradingDays, getAvgHoldMins, formatHoldTime } from '@/lib/utils'
import { Chart, registerables } from 'chart.js'
Chart.register(...registerables)

export default function DashboardPage() {
  const trades = useStore(s => s.trades)
  const [period, setPeriod] = useState('all')
  const [showModal, setShowModal] = useState(false)
  const [calYear, setCalYear] = useState(new Date().getFullYear())
  const [calMonth, setCalMonth] = useState(new Date().getMonth())
  const equityRef = useRef<HTMLCanvasElement>(null)
  const dailyRef = useRef<HTMLCanvasElement>(null)
  const equityChart = useRef<Chart | null>(null)
  const dailyChart = useRef<Chart | null>(null)

  const filtered = periodFilter(trades, period)
  const decided = getDecided(filtered)
  const wins = getWins(filtered)
  const losses = getLosses(filtered)
  const totalPnl = calcPnl(filtered)
  const wr = getWinRate(filtered)
  const pf = getProfitFactor(filtered)
  const grossW = wins.reduce((s, t) => s + (t.pnl || 0), 0)
  const grossL = Math.abs(losses.reduce((s, t) => s + (t.pnl || 0), 0))
  const avgWin = wins.length ? grossW / wins.length : null
  const avgLoss = losses.length ? grossL / losses.length : null
  const exp = avgWin != null && avgLoss != null ? (wr / 100 * avgWin) - ((1 - wr / 100) * avgLoss) : null

  // Equity chart
  useEffect(() => {
    if (!equityRef.current) return
    const sorted = [...filtered].sort((a, b) => (a.date || '').localeCompare(b.date || ''))
    let cum = 0
    const labels = ['Start']
    const data = [0]
    sorted.forEach(t => { cum += t.pnl || 0; labels.push((t.date || '').slice(5)); data.push(+cum.toFixed(2)) })
    if (equityChart.current) equityChart.current.destroy()
    const isPos = (data[data.length - 1] || 0) >= 0
    const lc = isPos ? '#00d084' : '#ff4d4d'
    equityChart.current = new Chart(equityRef.current, {
      type: 'line',
      data: { labels, datasets: [{ data, borderColor: lc, borderWidth: 2, pointRadius: data.length > 20 ? 0 : 3, pointBackgroundColor: lc, tension: 0.3, fill: true, backgroundColor: (ctx: any) => { const g = ctx.chart.ctx.createLinearGradient(0, 0, 0, 160); g.addColorStop(0, isPos ? 'rgba(0,208,132,0.18)' : 'rgba(255,77,77,0.15)'); g.addColorStop(1, 'rgba(0,0,0,0)'); return g } }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { backgroundColor: '#1e1e2a', bodyColor: '#e8e8f0', titleColor: '#6b6b80', callbacks: { label: (c: any) => ' $' + c.parsed.y.toFixed(2) } } }, scales: { x: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#6b6b80', font: { size: 10 }, maxTicksLimit: 8 } }, y: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#6b6b80', font: { size: 10 }, callback: (v: any) => '$' + v } } } }
    })
  }, [filtered.length, period])

  // Daily bar chart
  useEffect(() => {
    if (!dailyRef.current) return
    const byDay: Record<string, number> = {}
    filtered.forEach(t => { const d = (t.date || '').slice(0, 10); if (d) byDay[d] = (byDay[d] || 0) + (t.pnl || 0) })
    const days = Object.keys(byDay).sort()
    const vals = days.map(d => +byDay[d].toFixed(2))
    if (dailyChart.current) dailyChart.current.destroy()
    dailyChart.current = new Chart(dailyRef.current, {
      type: 'bar',
      data: { labels: days.map(d => d.slice(5)), datasets: [{ data: vals, backgroundColor: vals.map(v => v >= 0 ? 'rgba(0,208,132,0.8)' : 'rgba(255,77,77,0.8)'), borderRadius: 3, borderSkipped: false as const }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { backgroundColor: '#1e1e2a', bodyColor: '#e8e8f0', titleColor: '#6b6b80', callbacks: { label: (c: any) => ' $' + c.parsed.y.toFixed(2) } } }, scales: { x: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#6b6b80', font: { size: 10 }, maxTicksLimit: 10 } }, y: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#6b6b80', font: { size: 10 }, callback: (v: any) => '$' + v } } } }
    })
  }, [filtered.length, period])

  // Calendar
  const byDay: Record<string, number> = {}
  const tradeCounts: Record<string, number> = {}
  trades.forEach(t => {
    const d = (t.date || '').slice(0, 10)
    if (!d) return
    const [y, m] = d.split('-').map(Number)
    if (y === calYear && m - 1 === calMonth) {
      byDay[d] = (byDay[d] || 0) + (t.pnl || 0)
      tradeCounts[d] = (tradeCounts[d] || 0) + 1
    }
  })
  const today = new Date().toISOString().slice(0, 10)
  const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
  const firstDow = new Date(calYear, calMonth, 1).getDay()
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate()

  const calNavFn = (dir: number) => {
    let m = calMonth + dir, y = calYear
    if (m > 11) { m = 0; y++ } else if (m < 0) { m = 11; y-- }
    setCalMonth(m); setCalYear(y)
  }

  const streaks = getStreaks(filtered)
  const tradingDays = getTradingDays(filtered)
  const avgHoldMins = getAvgHoldMins(filtered)

  // Monthly stats for goal progress
  const now2 = new Date()
  const monthPrefix = now2.getFullYear() + '-' + String(now2.getMonth() + 1).padStart(2, '0')
  const monthTrades = trades.filter(t => (t.date || '').startsWith(monthPrefix))
  const monthDays = new Set(monthTrades.map(t => (t.date || '').slice(0, 10))).size
  const monthWinDays = (() => {
    const byDay: Record<string, number> = {}
    monthTrades.forEach(t => { const d = (t.date || '').slice(0,10); byDay[d] = (byDay[d]||0) + (t.pnl||0) })
    return Object.values(byDay).filter(p => p > 0).length
  })()

  const recentTrades = [...filtered].sort((a, b) => (b.date || '').localeCompare(a.date || '')).slice(0, 8)

  return (
    <AppFrame>
      <div className="page-fade">
        {showModal && <TradeModal onClose={() => setShowModal(false)} />}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 2 }}>
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </div>
            <div className="page-title">Dashboard</div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <select className="form-input" value={period} onChange={e => setPeriod(e.target.value)} style={{ width: 'auto', padding: '7px 12px', fontSize: 12 }}>
              <option value="all">All time</option>
              <option value="today">Today</option>
              <option value="week">This week</option>
              <option value="month">This month</option>
            </select>
            <button className="btn btn-primary" onClick={() => setShowModal(true)} style={{ padding: '8px 16px', fontSize: 12 }}>+ Add Trade</button>
          </div>
        </div>

        {/* STAT CARDS ROW 1 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 12, marginBottom: 12 }}>
          {[
            { label: 'Net P&L', val: formatPnl(totalPnl), cls: totalPnl > 0 ? 'pos' : totalPnl < 0 ? 'neg' : '', sub: filtered.length + ' trades' },
            { label: 'Win Rate', val: wr.toFixed(1) + '%', cls: wr >= 55 ? 'pos' : wr < 40 ? 'neg' : '', sub: wins.length + 'W / ' + losses.length + 'L (excl. BE)' },
            { label: 'Profit Factor', val: pf != null ? pf.toFixed(2) : '--', cls: pf != null ? (pf >= 1.5 ? 'pos' : pf < 1 ? 'neg' : '') : '', sub: 'gross P / gross L' },
            { label: 'Expectancy', val: exp != null ? formatPnl(exp) : '--', cls: exp != null ? (exp >= 0 ? 'pos' : 'neg') : '', sub: 'per trade' },
            { label: 'Avg Win / Loss', val: avgWin != null ? '+$' + avgWin.toFixed(0) : '--', cls: 'pos', sub: avgLoss != null ? 'avg loss $' + avgLoss.toFixed(0) : 'avg loss --' },
          ].map(s => (
            <div key={s.label} className="stat-card">
              <div className="stat-label">{s.label}</div>
              <div className={`stat-val ${s.cls}`} style={{ fontSize: 22 }}>{s.val}</div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>{s.sub}</div>
            </div>
          ))}
        </div>

        {/* STAT CARDS ROW 2 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 12, marginBottom: 16 }}>
          {/* Current Streak */}
          <div className="stat-card">
            <div className="stat-label">Current Streak</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 4 }}>
              <span style={{ fontSize: 28 }}>{streaks.curType === 'win' ? '🔥' : streaks.curType === 'loss' ? '❌' : '--'}</span>
              {streaks.curStreak > 0 && <span className={`stat-val ${streaks.curType === 'win' ? 'pos' : 'neg'}`} style={{ fontSize: 22 }}>{streaks.curStreak}</span>}
            </div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
              {streaks.curType === 'win' ? 'win streak' : streaks.curType === 'loss' ? 'loss streak' : 'no trades'}
              {streaks.bestWin > 0 && <span style={{ marginLeft: 6 }}>· best {streaks.bestWin}W</span>}
            </div>
          </div>

          {/* Trading Days */}
          <div className="stat-card">
            <div className="stat-label">Trading Days</div>
            <div className="stat-val" style={{ fontSize: 22, marginTop: 4 }}>{tradingDays}</div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
              This month: {monthWinDays}W / {monthDays - monthWinDays}L days
            </div>
          </div>

          {/* Monthly Winning Days */}
          <div className="stat-card">
            <div className="stat-label">Monthly Win Days</div>
            <div style={{ marginTop: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span className="stat-val pos" style={{ fontSize: 20 }}>{monthWinDays}</span>
                <span style={{ fontSize: 13, color: 'var(--muted)', alignSelf: 'flex-end' }}>/ {monthDays} days</span>
              </div>
              <div style={{ height: 6, background: 'var(--bg4)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: monthDays ? (monthWinDays / monthDays * 100) + '%' : '0%', background: 'var(--green)', borderRadius: 3, transition: 'width .4s' }} />
              </div>
            </div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
              {monthDays ? Math.round(monthWinDays / monthDays * 100) : 0}% green days this month
            </div>
          </div>

          {/* Best Streak */}
          <div className="stat-card">
            <div className="stat-label">Best Win Streak</div>
            <div className="stat-val pos" style={{ fontSize: 22, marginTop: 4 }}>
              {streaks.bestWin > 0 ? streaks.bestWin + ' wins' : '--'}
            </div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
              worst loss streak: {streaks.bestLoss > 0 ? streaks.bestLoss : '--'}
            </div>
          </div>

          {/* Avg Hold Time */}
          <div className="stat-card">
            <div className="stat-label">Avg Hold Time</div>
            <div className="stat-val" style={{ fontSize: 22, marginTop: 4 }}>
              {avgHoldMins != null ? formatHoldTime(avgHoldMins) : '--'}
            </div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
              {filtered.filter(t => t.holdMins).length} trades with hold data
            </div>
          </div>
        </div>

        {/* CHARTS */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
          <div className="card" style={{ height: 220 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 10 }}>Daily Net Cumulative P&L</div>
            <div style={{ position: 'relative', height: 155 }}><canvas ref={equityRef} /></div>
          </div>
          <div className="card" style={{ height: 220 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 10 }}>Net Daily P&L</div>
            <div style={{ position: 'relative', height: 155 }}><canvas ref={dailyRef} /></div>
          </div>
        </div>

        {/* CALENDAR + RECENT */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 12 }}>
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button onClick={() => calNavFn(-1)} className="btn" style={{ padding: '4px 10px', fontSize: 12, color: 'var(--muted)' }}>‹ TODAY</button>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{MONTHS[calMonth]} {calYear}</span>
                <button onClick={() => calNavFn(1)} className="btn" style={{ padding: '4px 10px', fontSize: 12, color: 'var(--muted)' }}>›</button>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr) 80px', gap: 3 }}>
              {DAYS.map(d => <div key={d} style={{ fontSize: 10, color: 'var(--muted)', textAlign: 'center', padding: '3px 0', fontWeight: 600 }}>{d}</div>)}
              <div style={{ fontSize: 10, color: 'var(--muted)', textAlign: 'center', fontWeight: 600 }}>Week</div>
              {(() => {
                const cells: React.ReactNode[] = []
                let rowCells: React.ReactNode[] = []
                let rowPnl = 0, rowDays = 0
                for (let i = 0; i < firstDow; i++) { rowCells.push(<div key={`e${i}`} style={{ minHeight: 64 }} />) }
                for (let d = 1; d <= daysInMonth; d++) {
                  const key = `${calYear}-${String(calMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`
                  const pnl = byDay[key], cnt = tradeCounts[key], isT = key === today
                  if (pnl != null) { rowPnl += pnl; rowDays++ }
                  const bg = pnl != null ? (pnl >= 0 ? 'rgba(0,208,132,0.12)' : 'rgba(255,77,77,0.1)') : 'var(--bg3)'
                  const border = isT ? '1px solid var(--accent)' : '1px solid transparent'
                  rowCells.push(
                    <div key={key} style={{ minHeight: 64, background: bg, border, borderRadius: 8, padding: '6px 8px', display: 'flex', flexDirection: 'column', transition: 'transform .15s', cursor: pnl != null ? 'pointer' : 'default' }}>
                      <div style={{ fontSize: 10, color: 'var(--muted)' }}>{d}</div>
                      {pnl != null && <>
                        <div style={{ fontSize: 12, fontWeight: 700, fontFamily: 'var(--mono)', color: pnl >= 0 ? 'var(--green)' : 'var(--red)' }}>{pnl >= 0 ? '+' : ''}${Math.abs(pnl).toFixed(0)}</div>
                        <div style={{ fontSize: 9, color: 'var(--muted)' }}>{cnt} trade{cnt !== 1 ? 's' : ''}</div>
                      </>}
                    </div>
                  )
                  const dow = (firstDow + d - 1) % 7
                  if (dow === 6 || d === daysInMonth) {
                    while (rowCells.length % 8 !== 7) rowCells.push(<div key={`p${d}${rowCells.length}`} style={{ minHeight: 64 }} />)
                    const wc = rowPnl > 0 ? 'var(--green)' : rowPnl < 0 ? 'var(--red)' : 'var(--muted)'
                    rowCells.push(<div key={`w${d}`} style={{ minHeight: 64, background: 'var(--bg4)', borderRadius: 8, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 4 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, fontFamily: 'var(--mono)', color: wc }}>{rowPnl !== 0 ? (rowPnl > 0 ? '+' : '') + '$' + Math.abs(rowPnl).toFixed(0) : '$0'}</div>
                      <div style={{ fontSize: 9, color: 'var(--muted)' }}>{rowDays}d</div>
                    </div>)
                    cells.push(...rowCells)
                    rowCells = []; rowPnl = 0; rowDays = 0
                  }
                }
                return cells
              })()}
            </div>
          </div>

          <div className="card">
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 14 }}>Recent Trades</div>
            {!recentTrades.length ? (
              <div className="empty-state"><div style={{ fontSize: 28 }}>📋</div><div>No trades yet</div></div>
            ) : (
              <table className="trades-table">
                <thead><tr><th>Date</th><th>Symbol</th><th>Result</th><th style={{ textAlign: 'right' }}>Net P&L</th></tr></thead>
                <tbody>
                  {recentTrades.map(t => (
                    <tr key={t.id}>
                      <td style={{ color: 'var(--muted)', fontSize: 10, fontFamily: 'var(--mono)' }}>{(t.date || '').slice(5)}</td>
                      <td style={{ fontWeight: 700 }}>{t.ticker}</td>
                      <td><span className={`pill ${t.outcome}`}>{t.outcome === 'win' ? 'Win' : t.outcome === 'loss' ? 'Loss' : 'BE'}</span></td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--mono)', fontWeight: 600, color: (t.pnl || 0) > 0 ? 'var(--green)' : (t.pnl || 0) < 0 ? 'var(--red)' : 'var(--muted)' }}>
                        {(t.pnl || 0) >= 0 ? '+' : ''}${Math.abs(t.pnl || 0).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </AppFrame>
  )
}
