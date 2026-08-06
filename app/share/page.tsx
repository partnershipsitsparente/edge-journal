'use client'
import { useState, useRef, useEffect } from 'react'
import AppFrame from '@/components/AppFrame'
import { useStore } from '@/lib/store'
import { periodFilter, calcPnl, getWins, getLosses, getDecided, getWinRate, getProfitFactor, getAvgRR } from '@/lib/utils'
import { Trade } from '@/lib/types'

type Layout = 'square' | 'story' | 'landscape' | 'portrait'
type CardType = 'day' | 'summary' | 'trade'

const LAYOUTS: { id: Layout; label: string; w: number; h: number; icon: string }[] = [
  { id: 'square',    label: 'Square',    w: 500, h: 500,  icon: '⬛' },
  { id: 'story',     label: 'Story',     w: 390, h: 693,  icon: '📱' },
  { id: 'landscape', label: 'Landscape', w: 600, h: 338,  icon: '🖼' },
  { id: 'portrait',  label: 'Portrait',  w: 400, h: 560,  icon: '📄' },
]

const CARD_TYPES: { id: CardType; label: string; desc: string }[] = [
  { id: 'day',     label: 'Day Summary',    desc: "Today's P&L and stats" },
  { id: 'summary', label: 'Period Summary', desc: 'Week/month overview' },
  { id: 'trade',   label: 'Single Trade',   desc: 'One trade with screenshot' },
]

interface Visibility {
  pnl: boolean; rMultiple: boolean; winRate: boolean; tradeCount: boolean
  profitFactor: boolean; setupName: boolean; symbol: boolean
  screenshot: boolean; notes: boolean; edgeLogo: boolean; watermark: boolean
}

const DEFAULT_VIS: Visibility = {
  pnl: true, rMultiple: true, winRate: true, tradeCount: true,
  profitFactor: true, setupName: true, symbol: true,
  screenshot: true, notes: false, edgeLogo: true, watermark: true,
}

const THEMES = {
  dark:   { bg: '#05050a', bg2: '#0e0e18', accent: '#7c6fcd', text: '#e8e8f0', muted: '#6b6b80', green: '#00d084', red: '#ff4d4d' },
  green:  { bg: '#020d08', bg2: '#061a10', accent: '#00d084', text: '#e8f5ee', muted: '#5a8a6a', green: '#00d084', red: '#ff4d4d' },
  purple: { bg: '#06030f', bg2: '#100826', accent: '#a855f7', text: '#f0e8ff', muted: '#7a6a90', green: '#00d084', red: '#ff4d4d' },
}

type ThemeKey = keyof typeof THEMES

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

export default function SharePage() {
  const { trades } = useStore()
  const [cardType, setCardType] = useState<CardType>('day')
  const [layout, setLayout] = useState<Layout>('square')
  const [period, setPeriod] = useState('today')
  const [selectedTradeId, setSelectedTradeId] = useState<string>('')
  const [vis, setVis] = useState<Visibility>(DEFAULT_VIS)
  const [theme, setTheme] = useState<ThemeKey>('dark')
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const selectedLayout = LAYOUTS.find(l => l.id === layout)!
  const filtered = periodFilter(trades, period)
  const selectedTrade = trades.find(t => t.id === selectedTradeId) || (trades.length ? [...trades].sort((a,b) => (b.date||'').localeCompare(a.date||''))[0] : null)

  const totalPnl = calcPnl(filtered)
  const wr = getWinRate(filtered)
  const pf = getProfitFactor(filtered)
  const avgRR = getAvgRR(filtered)
  const wins = getWins(filtered)
  const losses = getLosses(filtered)

  const toggleVis = (key: keyof Visibility) => setVis(v => ({ ...v, [key]: !v[key] }))

  const drawCard = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    const W = selectedLayout.w, H = selectedLayout.h
    canvas.width = W; canvas.height = H
    const T = THEMES[theme]

    // Background
    const bgGrad = ctx.createLinearGradient(0, 0, W, H)
    bgGrad.addColorStop(0, T.bg); bgGrad.addColorStop(1, T.bg2)
    ctx.fillStyle = bgGrad; ctx.fillRect(0, 0, W, H)

    // Grid
    ctx.strokeStyle = 'rgba(255,255,255,0.03)'; ctx.lineWidth = 1
    for (let x = 0; x < W; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke() }
    for (let y = 0; y < H; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke() }

    // Accent glow
    const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, W * 0.6)
    glow.addColorStop(0, T.accent + '22'); glow.addColorStop(1, 'transparent')
    ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H)

    // Border
    ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 1
    roundRect(ctx, 2, 2, W-4, H-4, 16); ctx.stroke()

    const pad = W * 0.08
    let y = pad * 1.2

    // EDGE Logo
    if (vis.edgeLogo) {
      ctx.font = `800 ${W * 0.055}px sans-serif`
      ctx.fillStyle = '#fff'
      const edgeW = ctx.measureText('EDGE').width
      ctx.fillText('EDGE', pad, y)
      ctx.fillStyle = T.accent
      ctx.fillText('.', pad + edgeW, y)
      y += W * 0.08
    }

    if (cardType === 'trade' && selectedTrade) {
      // Single trade card
      const trade = selectedTrade
      const pnl = trade.pnl || 0
      const pnlColor = pnl >= 0 ? T.green : T.red

      if (vis.symbol) {
        ctx.font = `800 ${W * 0.09}px sans-serif`
        ctx.fillStyle = T.text
        ctx.fillText(trade.ticker || 'MNQ', pad, y)
        y += W * 0.04
      }

      // Side badge
      ctx.fillStyle = trade.side === 'long' ? 'rgba(0,208,132,0.2)' : 'rgba(255,77,77,0.2)'
      roundRect(ctx, pad, y, 64, 24, 5); ctx.fill()
      ctx.font = `700 ${W * 0.027}px sans-serif`
      ctx.fillStyle = trade.side === 'long' ? T.green : T.red
      ctx.fillText((trade.side || '').toUpperCase(), pad + 8, y + 16)
      y += W * 0.06

      if (vis.pnl) {
        const pnlStr = (pnl >= 0 ? '+' : '') + '$' + Math.abs(pnl).toFixed(2)
        ctx.font = `800 ${W * 0.11}px sans-serif`
        ctx.shadowColor = pnlColor; ctx.shadowBlur = 20
        ctx.fillStyle = pnlColor
        ctx.fillText(pnlStr, pad, y)
        ctx.shadowBlur = 0
        y += W * 0.04
      }

      if (vis.rMultiple && trade.rr != null) {
        ctx.font = `600 ${W * 0.04}px sans-serif`
        ctx.fillStyle = T.muted
        ctx.fillText(trade.rr.toFixed(2) + 'R', pad, y)
        y += W * 0.05
      }

      ctx.fillStyle = 'rgba(255,255,255,0.07)'
      ctx.fillRect(pad, y, W - pad*2, 1)
      y += W * 0.04

      if (vis.screenshot && trade.screenshots && trade.screenshots.length > 0) {
        const img = new window.Image()
        img.onload = () => {
          const imgH = H * 0.28
          ctx.save()
          roundRect(ctx, pad, y, W - pad*2, imgH, 10)
          ctx.clip()
          ctx.drawImage(img, pad, y, W - pad*2, imgH)
          ctx.restore()
          const footerY = y + imgH + W * 0.04
          ctx.font = `400 ${W * 0.028}px sans-serif`
          ctx.fillStyle = T.muted
          ctx.fillText(trade.date || '', pad, footerY)
          drawWatermark(ctx, W, H, pad, T, vis)
        }
        img.src = trade.screenshots[0]
      } else {
        ctx.font = `400 ${W * 0.028}px sans-serif`
        ctx.fillStyle = T.muted
        ctx.fillText(trade.date || '', pad, y)
        if (vis.notes && trade.notes) {
          y += W * 0.05
          ctx.font = `400 ${W * 0.026}px sans-serif`
          const words = trade.notes.split(' ')
          let line = ''
          words.forEach(word => {
            const test = line + word + ' '
            if (ctx.measureText(test).width > W - pad*2 && line) {
              ctx.fillText(line.trim(), pad, y); y += W * 0.038; line = word + ' '
            } else line = test
          })
          if (line) ctx.fillText(line.trim(), pad, y)
        }
        drawWatermark(ctx, W, H, pad, T, vis)
      }
    } else {
      // Summary card
      const periodLabel = period === 'today' ? 'Today' : period === 'week' ? 'This Week' : period === 'month' ? 'This Month' : 'All Time'
      ctx.font = `600 ${W * 0.028}px sans-serif`
      ctx.fillStyle = T.muted
      ctx.fillText(periodLabel.toUpperCase(), pad, y)
      y += W * 0.065

      if (vis.pnl) {
        const pnlStr = (totalPnl >= 0 ? '+' : '') + '$' + Math.abs(totalPnl).toFixed(2)
        ctx.font = `800 ${W * 0.13}px sans-serif`
        ctx.shadowColor = totalPnl >= 0 ? T.green : T.red; ctx.shadowBlur = 24
        ctx.fillStyle = totalPnl >= 0 ? T.green : T.red
        ctx.fillText(pnlStr, pad, y)
        ctx.shadowBlur = 0
        y += W * 0.05
      }

      ctx.fillStyle = 'rgba(255,255,255,0.07)'
      ctx.fillRect(pad, y, W - pad*2, 1)
      y += W * 0.05

      const statItems: { label: string; value: string; color?: string }[] = []
      if (vis.winRate) statItems.push({ label: 'WIN RATE', value: wr.toFixed(1) + '%', color: wr >= 55 ? T.green : wr < 40 ? T.red : T.text })
      if (vis.tradeCount) statItems.push({ label: 'TRADES', value: filtered.length + ' (' + wins.length + 'W/' + losses.length + 'L)' })
      if (vis.profitFactor) statItems.push({ label: 'PROFIT FACTOR', value: pf != null ? pf.toFixed(2) : '--' })
      if (vis.rMultiple) statItems.push({ label: 'AVG R:R', value: avgRR != null ? avgRR.toFixed(2) + 'R' : '--' })

      const cols = layout === 'landscape' ? 4 : 2
      const cellW = (W - pad * 2) / cols
      statItems.forEach((s, i) => {
        const cx = pad + (i % cols) * cellW
        const cy = y + Math.floor(i / cols) * (W * 0.13)
        ctx.fillStyle = 'rgba(255,255,255,0.04)'
        roundRect(ctx, cx + 3, cy - W*0.014, cellW - 6, W * 0.105, 8); ctx.fill()
        ctx.font = `600 ${W * 0.024}px sans-serif`
        ctx.fillStyle = T.muted
        ctx.fillText(s.label, cx + 10, cy + W * 0.022)
        ctx.font = `700 ${W * 0.046}px sans-serif`
        ctx.fillStyle = s.color || T.text
        ctx.fillText(s.value, cx + 10, cy + W * 0.068)
      })

      drawWatermark(ctx, W, H, pad, T, vis)
    }
  }

  function drawWatermark(ctx: CanvasRenderingContext2D, W: number, H: number, pad: number, T: typeof THEMES.dark, vis: Visibility) {
    if (!vis.watermark) return
    ctx.font = `400 ${W * 0.022}px sans-serif`
    ctx.fillStyle = 'rgba(255,255,255,0.2)'
    ctx.textAlign = 'right'
    ctx.fillText('edge-journal.vercel.app', W - pad, H - pad * 0.5)
    ctx.textAlign = 'left'
  }

  useEffect(() => { drawCard() }, [cardType, layout, period, selectedTradeId, vis, theme, trades, filtered.length])

  const downloadCard = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const link = document.createElement('a')
    link.download = `edge-${cardType}-${new Date().toISOString().slice(0,10)}.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
  }

  const visToggles: { key: keyof Visibility; label: string }[] = [
    { key: 'pnl', label: 'P&L' }, { key: 'rMultiple', label: 'R Multiple' },
    { key: 'winRate', label: 'Win Rate' }, { key: 'tradeCount', label: 'Trade Count' },
    { key: 'profitFactor', label: 'Profit Factor' }, { key: 'symbol', label: 'Symbol' },
    { key: 'screenshot', label: 'Screenshot' }, { key: 'notes', label: 'Notes' },
    { key: 'edgeLogo', label: 'EDGE Logo' }, { key: 'watermark', label: 'Watermark' },
  ]

  const lbl: React.CSSProperties = { fontSize: 11, fontWeight: 600, letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 8, display: 'block' }

  return (
    <AppFrame>
      <div className="page-fade">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <div className="page-title">Share Card</div>
            <div className="page-sub">Create shareable trade cards for social media</div>
          </div>
          <button className="btn btn-primary" onClick={downloadCard} style={{ padding: '10px 24px', fontSize: 13 }}>↓ Download PNG</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 20, alignItems: 'start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="card">
              <label style={lbl}>Card Type</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {CARD_TYPES.map(ct => (
                  <button key={ct.id} onClick={() => setCardType(ct.id)} style={{ padding: '10px 14px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', border: `1px solid ${cardType === ct.id ? 'var(--accent)' : 'var(--border)'}`, background: cardType === ct.id ? 'rgba(124,111,205,0.1)' : 'var(--bg3)', color: cardType === ct.id ? 'var(--accent)' : 'var(--muted)', textAlign: 'left' }}>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>{ct.label}</div>
                    <div style={{ fontSize: 11, opacity: .7, marginTop: 2 }}>{ct.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {cardType !== 'trade' ? (
              <div className="card">
                <label style={lbl}>Period</label>
                <select className="form-input" value={period} onChange={e => setPeriod(e.target.value)}>
                  <option value="today">Today</option>
                  <option value="week">This Week</option>
                  <option value="month">This Month</option>
                  <option value="all">All Time</option>
                </select>
              </div>
            ) : (
              <div className="card">
                <label style={lbl}>Select Trade</label>
                <select className="form-input" value={selectedTradeId} onChange={e => setSelectedTradeId(e.target.value)}>
                  {[...trades].sort((a,b)=>(b.date||'').localeCompare(a.date||'')).map(t => (
                    <option key={t.id} value={t.id}>{t.date?.slice(5)} · {t.ticker} · {(t.pnl||0)>=0?'+':''}${Math.abs(t.pnl||0).toFixed(2)}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="card">
              <label style={lbl}>Layout</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                {LAYOUTS.map(l => (
                  <button key={l.id} onClick={() => setLayout(l.id)} style={{ padding: '8px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', border: `1px solid ${layout === l.id ? 'var(--accent)' : 'var(--border)'}`, background: layout === l.id ? 'rgba(124,111,205,0.1)' : 'var(--bg3)', color: layout === l.id ? 'var(--accent)' : 'var(--muted)', fontSize: 12, fontWeight: 600, textAlign: 'center' }}>
                    <div>{l.icon}</div><div style={{ marginTop: 2 }}>{l.label}</div><div style={{ fontSize: 9, opacity: .6 }}>{l.w}×{l.h}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="card">
              <label style={lbl}>Theme</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {(['dark','green','purple'] as ThemeKey[]).map(t => (
                  <button key={t} onClick={() => setTheme(t)} style={{ flex: 1, padding: '8px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', background: THEMES[t].bg, border: `2px solid ${theme === t ? THEMES[t].accent : 'var(--border)'}`, color: theme === t ? THEMES[t].accent : THEMES[t].muted, fontSize: 11, fontWeight: 700 }}>
                    {t === 'dark' ? '🌑 Dark' : t === 'green' ? '💚 Green' : '💜 Purple'}
                  </button>
                ))}
              </div>
            </div>

            <div className="card">
              <label style={lbl}>Show / Hide</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {visToggles.map(({ key, label }) => (
                  <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 13, color: vis[key] ? 'var(--text)' : 'var(--muted)' }}>
                    <div onClick={() => toggleVis(key)} style={{ width: 36, height: 20, borderRadius: 10, position: 'relative', cursor: 'pointer', flexShrink: 0, background: vis[key] ? 'var(--accent)' : 'var(--bg4)', transition: 'background .2s', border: '1px solid rgba(255,255,255,0.1)' }}>
                      <div style={{ position: 'absolute', top: 2, left: vis[key] ? 16 : 2, width: 14, height: 14, borderRadius: '50%', background: '#fff', transition: 'left .2s' }} />
                    </div>
                    {label}
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
            <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.08em' }}>Preview</div>
            <div style={{ background: 'repeating-conic-gradient(#1a1a2a 0% 25%, #111118 0% 50%) 0 0 / 20px 20px', borderRadius: 16, padding: 24 }}>
              <canvas ref={canvasRef} style={{ display: 'block', borderRadius: 12, maxWidth: '100%', maxHeight: '65vh', objectFit: 'contain', boxShadow: '0 4px 32px rgba(0,0,0,0.6)' }} />
            </div>
            <button className="btn btn-primary" onClick={downloadCard} style={{ padding: '12px 32px', fontSize: 14 }}>↓ Download PNG</button>
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>High-res PNG · Instagram · Twitter/X · Discord</div>
          </div>
        </div>
      </div>
    </AppFrame>
  )
}
