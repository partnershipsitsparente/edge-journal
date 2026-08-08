'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import AppFrame from '@/components/AppFrame'
import { useStore } from '@/lib/store'
import { periodFilter, calcPnl, getWins, getLosses, getWinRate, getProfitFactor, getAvgRR } from '@/lib/utils'

type Layout = 'square' | 'story' | 'landscape' | 'portrait'
type CardType = 'day' | 'summary' | 'trade'
type ThemeKey = 'dark' | 'green' | 'purple'
type BigStat = 'pnl' | 'rr'

const LAYOUTS: { id: Layout; label: string; w: number; h: number; icon: string }[] = [
  { id: 'square',    label: 'Square',    w: 500, h: 500,  icon: '⬛' },
  { id: 'story',     label: 'Story',     w: 390, h: 693,  icon: '📱' },
  { id: 'landscape', label: 'Landscape', w: 600, h: 338,  icon: '🖼' },
  { id: 'portrait',  label: 'Portrait',  w: 400, h: 560,  icon: '📄' },
]

const THEMES = {
  dark:   { bg: '#05050a', bg2: '#0e0e18', accent: '#7c6fcd', text: '#e8e8f0', muted: '#6b6b80', green: '#00d084', red: '#ff4d4d' },
  green:  { bg: '#020d08', bg2: '#061a10', accent: '#00d084', text: '#e8f5ee', muted: '#5a8a6a', green: '#00d084', red: '#ff4d4d' },
  purple: { bg: '#06030f', bg2: '#100826', accent: '#a855f7', text: '#f0e8ff', muted: '#7a6a90', green: '#00d084', red: '#ff4d4d' },
}

interface Vis {
  winRate: boolean; tradeCount: boolean; profitFactor: boolean
  rMultiple: boolean; symbol: boolean; screenshot: boolean
  notes: boolean; edgeLogo: boolean
}

const DEFAULT_VIS: Vis = {
  winRate: true, tradeCount: true, profitFactor: true,
  rMultiple: true, symbol: true, screenshot: true,
  notes: false, edgeLogo: true,
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y); ctx.quadraticCurveTo(x+w,y,x+w,y+r)
  ctx.lineTo(x+w,y+h-r); ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h)
  ctx.lineTo(x+r,y+h); ctx.quadraticCurveTo(x,y+h,x,y+h-r)
  ctx.lineTo(x,y+r); ctx.quadraticCurveTo(x,y,x+r,y)
  ctx.closePath()
}

export default function SharePage() {
  const { trades } = useStore()
  const [cardType, setCardType] = useState<CardType>('day')
  const [layout, setLayout] = useState<Layout>('square')
  const [period, setPeriod] = useState('today')
  const [selectedTradeId, setSelectedTradeId] = useState('')
  const [vis, setVis] = useState<Vis>(DEFAULT_VIS)
  const [theme, setTheme] = useState<ThemeKey>('dark')
  const [bigStat, setBigStat] = useState<BigStat>('pnl')
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const sortedTrades = [...trades].sort((a,b) => (b.date||'').localeCompare(a.date||''))
  const selectedTrade = trades.find(t => t.id === selectedTradeId) || sortedTrades[0] || null
  const lyt = LAYOUTS.find(l => l.id === layout)!
  const filtered = periodFilter(trades, period)
  const totalPnl = calcPnl(filtered)
  const wr = getWinRate(filtered)
  const pf = getProfitFactor(filtered)
  const avgRR = getAvgRR(filtered)
  const wins = getWins(filtered)
  const losses = getLosses(filtered)
  const T = THEMES[theme]

  const toggleVis = (k: keyof Vis) => setVis(v => ({...v, [k]: !v[k]}))

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    const W = lyt.w, H = lyt.h
    canvas.width = W; canvas.height = H

    // BG
    const bg = ctx.createLinearGradient(0, 0, W, H)
    bg.addColorStop(0, T.bg); bg.addColorStop(1, T.bg2)
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H)

    // Grid lines
    ctx.strokeStyle = 'rgba(255,255,255,0.03)'; ctx.lineWidth = 1
    for (let x = 0; x < W; x += 40) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke() }
    for (let y = 0; y < H; y += 40) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke() }

    // Glow
    const glow = ctx.createRadialGradient(0,0,0,0,0,W*0.6)
    glow.addColorStop(0, T.accent+'22'); glow.addColorStop(1,'transparent')
    ctx.fillStyle = glow; ctx.fillRect(0,0,W,H)

    // Border
    ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 1
    roundRect(ctx, 1, 1, W-2, H-2, 14); ctx.stroke()

    const pad = Math.round(W * 0.07)
    const isLandscape = layout === 'landscape'
    const lineH = (size: number) => size * 1.25

    // --- LOGO ---
    const logoSize = Math.round(W * 0.052)
    let y = pad + logoSize  // y is baseline of logo text
    if (vis.edgeLogo) {
      ctx.font = `800 ${logoSize}px Arial, sans-serif`
      ctx.fillStyle = '#fff'
      const edgeW = ctx.measureText('EDGE').width
      ctx.fillText('EDGE', pad, y)
      ctx.fillStyle = T.accent
      ctx.fillText('.', pad + edgeW - 2, y)
    }
    // Pass y=0 to drawSummary/drawTrade — they use absolute positioning

    if (cardType === 'trade' && selectedTrade) {
      drawTrade(ctx, W, H, pad, 0, T, vis, selectedTrade, bigStat, layout)
    } else {
      drawSummary(ctx, W, H, pad, 0, T, vis, totalPnl, wr, pf, avgRR, wins.length, losses.length, filtered.length, period, layout)
    }

    // Watermark - always shown, no toggle
    ctx.font = `400 ${Math.round(W * 0.022)}px Arial, sans-serif`
    ctx.fillStyle = 'rgba(255,255,255,0.18)'
    ctx.textAlign = 'right'
    ctx.fillText('edge-journal.vercel.app', W - pad, H - Math.round(pad * 0.5))
    ctx.textAlign = 'left'

  }, [lyt, T, vis, cardType, selectedTrade, bigStat, layout, totalPnl, wr, pf, avgRR, wins.length, losses.length, filtered.length, period])

  useEffect(() => { draw() }, [draw])

  function drawSummary(
    ctx: CanvasRenderingContext2D, W: number, H: number, pad: number, startY: number,
    T: typeof THEMES.dark, vis: Vis, pnl: number, wr: number, pf: number|null,
    avgRR: number|null, winsC: number, lossesC: number, total: number, period: string, layout: Layout
  ) {
    const isLandscape = layout === 'landscape'
    const pnlColor = pnl >= 0 ? T.green : T.red
    const pLabel: Record<string,string> = { today:'TODAY', week:'THIS WEEK', month:'THIS MONTH', all:'ALL TIME' }

    // Fixed positions — calculated from top of canvas, not cumulative
    // This prevents any overlap regardless of font sizes
    const logoH = vis.edgeLogo ? Math.round(W * 0.12) : Math.round(W * 0.04)
    const periodY = logoH + Math.round(H * 0.04)
    const periodSize = Math.round(W * 0.026)
    const pnlSize = Math.round(W * (isLandscape ? 0.088 : 0.11))
    const pnlY = periodY + Math.round(periodSize * 1.4) + Math.round(H * 0.02)
    const dividerY = pnlY + Math.round(H * 0.04)
    const statsY = dividerY + Math.round(H * 0.04)

    // Period label
    ctx.font = `600 ${periodSize}px Arial, sans-serif`
    ctx.fillStyle = T.muted
    ctx.fillText(pLabel[period] || 'ALL TIME', pad, periodY)

    // Big P&L
    const pnlStr = (pnl >= 0 ? '+' : '') + '$' + Math.abs(pnl).toFixed(2)
    ctx.font = `800 ${pnlSize}px Arial, sans-serif`
    ctx.shadowColor = pnlColor; ctx.shadowBlur = 20
    ctx.fillStyle = pnlColor
    ctx.fillText(pnlStr, pad, pnlY)
    ctx.shadowBlur = 0

    // Divider
    ctx.fillStyle = 'rgba(255,255,255,0.08)'
    ctx.fillRect(pad, dividerY, W - pad*2, 1)

    // Stat grid — fixed cell size based on remaining space
    type StatItem = { label: string; value: string; color?: string }
    const stats: StatItem[] = []
    if (vis.winRate) stats.push({ label: 'WIN RATE', value: wr.toFixed(1) + '%', color: wr >= 55 ? T.green : wr < 40 ? T.red : T.text })
    if (vis.tradeCount) stats.push({ label: 'TRADES', value: `${total} (${winsC}W/${lossesC}L)` })
    if (vis.profitFactor) stats.push({ label: 'PROFIT FACTOR', value: pf != null ? pf.toFixed(2) : '--' })
    if (vis.rMultiple) stats.push({ label: 'AVG R:R', value: avgRR != null ? avgRR.toFixed(2) + 'R' : '--' })

    const cols = isLandscape ? Math.min(stats.length, 4) : 2
    const rows = Math.ceil(stats.length / cols)
    const availH = H - statsY - Math.round(H * 0.1) // leave room for watermark
    const cellH = Math.min(Math.round(availH / rows), Math.round(H * 0.2))
    const cellW = Math.floor((W - pad * 2) / cols)
    const gap = 6
    const labelSize = Math.round(cellH * 0.2)
    const valSize = Math.round(cellH * 0.38)

    stats.forEach((s, i) => {
      const col = i % cols
      const row = Math.floor(i / cols)
      const cx = pad + col * cellW
      const cy = statsY + row * (cellH + gap)

      ctx.fillStyle = 'rgba(255,255,255,0.04)'
      roundRect(ctx, cx + 3, cy, cellW - 6, cellH - gap, 8)
      ctx.fill()

      // Label at top of cell
      ctx.font = `600 ${labelSize}px Arial, sans-serif`
      ctx.fillStyle = T.muted
      ctx.fillText(s.label, cx + 10, cy + labelSize + 6)

      // Value below label
      ctx.font = `700 ${valSize}px Arial, sans-serif`
      ctx.fillStyle = s.color || T.text
      ctx.fillText(s.value, cx + 10, cy + labelSize + 10 + valSize)
    })
  }

  function drawTrade(
    ctx: CanvasRenderingContext2D, W: number, H: number, pad: number, _startY: number,
    T: typeof THEMES.dark, vis: Vis, trade: NonNullable<typeof selectedTrade>,
    bigStat: BigStat, layout: Layout
  ) {
    const pnl = trade.pnl || 0
    const pnlColor = pnl >= 0 ? T.green : T.red
    const rrColor = (trade.rr || 0) >= 1 ? T.green : T.red
    const isLandscape = layout === 'landscape'

    // Absolute positions from top
    const logoH = vis.edgeLogo ? Math.round(W * 0.12) : Math.round(W * 0.04)
    const symSize = Math.round(W * 0.068)
    const symY = logoH + Math.round(H * 0.04) + symSize
    const bigSize = Math.round(W * (isLandscape ? 0.088 : 0.105))
    const bigY = symY + Math.round(H * 0.06) + bigSize
    const smallSize = Math.round(W * 0.036)
    const smallY = bigY + Math.round(smallSize * 1.5)
    const dividerY = smallY + Math.round(H * 0.03)
    const contentY = dividerY + Math.round(H * 0.035)

    // Symbol + side badge
    if (vis.symbol) {
      ctx.font = `800 ${symSize}px Arial, sans-serif`
      ctx.fillStyle = T.text
      const symW = ctx.measureText(trade.ticker || 'MNQ').width
      ctx.fillText(trade.ticker || 'MNQ', pad, symY)
      // Side badge
      const badgeX = pad + symW + 10
      const badgeH2 = Math.round(symSize * 0.45)
      const badgeW2 = Math.round(badgeH2 * 2.6)
      const badgeY2 = symY - symSize + Math.round(symSize * 0.6)
      ctx.fillStyle = trade.side === 'long' ? 'rgba(0,208,132,0.2)' : 'rgba(255,77,77,0.2)'
      roundRect(ctx, badgeX, badgeY2, badgeW2, badgeH2, 5); ctx.fill()
      const sideSize = Math.round(badgeH2 * 0.55)
      ctx.font = `700 ${sideSize}px Arial, sans-serif`
      ctx.fillStyle = trade.side === 'long' ? T.green : T.red
      ctx.fillText((trade.side || '').toUpperCase(), badgeX + 8, badgeY2 + sideSize * 1.1)
    }

    // Big number
    if (bigStat === 'rr' && trade.rr != null) {
      const rrStr = (trade.rr >= 0 ? '+' : '') + trade.rr.toFixed(2) + 'R'
      ctx.font = `800 ${bigSize}px Arial, sans-serif`
      ctx.shadowColor = rrColor; ctx.shadowBlur = 20
      ctx.fillStyle = rrColor; ctx.fillText(rrStr, pad, bigY)
      ctx.shadowBlur = 0
      const pnlStr = (pnl >= 0 ? '+' : '') + '$' + Math.abs(pnl).toFixed(2)
      ctx.font = `500 ${smallSize}px Arial, sans-serif`
      ctx.fillStyle = T.muted; ctx.fillText(pnlStr, pad, smallY)
    } else {
      const pnlStr = (pnl >= 0 ? '+' : '') + '$' + Math.abs(pnl).toFixed(2)
      ctx.font = `800 ${bigSize}px Arial, sans-serif`
      ctx.shadowColor = pnlColor; ctx.shadowBlur = 20
      ctx.fillStyle = pnlColor; ctx.fillText(pnlStr, pad, bigY)
      ctx.shadowBlur = 0
      if (trade.rr != null) {
        ctx.font = `500 ${smallSize}px Arial, sans-serif`
        ctx.fillStyle = T.muted
        ctx.fillText(trade.rr.toFixed(2) + 'R', pad, smallY)
      }
    }

    // Divider
    ctx.fillStyle = 'rgba(255,255,255,0.08)'
    ctx.fillRect(pad, dividerY, W - pad*2, 1)

    // Screenshot
    if (vis.screenshot && trade.screenshots && trade.screenshots.length > 0) {
      const ssW = W - pad * 2
      const ssH = Math.min(Math.round(H * 0.32), H - contentY - Math.round(H * 0.12))
      const img = new window.Image()
      img.onload = () => {
        ctx.save()
        roundRect(ctx, pad, contentY, ssW, ssH, 10)
        ctx.clip()
        const scale = Math.max(ssW / img.width, ssH / img.height)
        const dw = img.width * scale, dh = img.height * scale
        const dx = pad + (ssW - dw) / 2, dy = contentY + (ssH - dh) / 2
        ctx.drawImage(img, dx, dy, dw, dh)
        ctx.restore()
        const dateY2 = contentY + ssH + Math.round(H * 0.03)
        ctx.font = `400 ${Math.round(W * 0.026)}px Arial, sans-serif`
        ctx.fillStyle = T.muted
        ctx.fillText(trade.date || '', pad, dateY2)
        // Re-draw watermark on top
        ctx.font = `400 ${Math.round(W * 0.022)}px Arial, sans-serif`
        ctx.fillStyle = 'rgba(255,255,255,0.18)'
        ctx.textAlign = 'right'
        ctx.fillText('edge-journal.vercel.app', W - pad, H - Math.round(pad * 0.5))
        ctx.textAlign = 'left'
      }
      img.src = trade.screenshots[0]
      return
    }

    // No screenshot
    ctx.font = `400 ${Math.round(W * 0.028)}px Arial, sans-serif`
    ctx.fillStyle = T.muted
    ctx.fillText(trade.date || '', pad, contentY)
    if (vis.notes && trade.notes) {
      let ny = contentY + Math.round(H * 0.055)
      const noteSize = Math.round(W * 0.026)
      ctx.font = `400 ${noteSize}px Arial, sans-serif`
      ctx.fillStyle = T.muted
      const maxLineW = W - pad * 2
      const words = trade.notes.split(' ')
      let line = ''
      for (const word of words) {
        const test = line + word + ' '
        if (ctx.measureText(test).width > maxLineW && line) {
          ctx.fillText(line.trim(), pad, ny); ny += Math.round(noteSize * 1.5); line = word + ' '
        } else line = test
      }
      if (line) ctx.fillText(line.trim(), pad, ny)
    }
  }

  const download = () => {
    const c = canvasRef.current; if (!c) return
    const a = document.createElement('a')
    a.download = `edge-${cardType}-${new Date().toISOString().slice(0,10)}.png`
    a.href = c.toDataURL('image/png'); a.click()
  }

  const lbl: React.CSSProperties = { fontSize: 11, fontWeight: 600, letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 8, display: 'block' }

  const visToggles: { key: keyof Vis; label: string }[] = [
    { key: 'winRate',      label: 'Win Rate' },
    { key: 'tradeCount',   label: 'Trade Count' },
    { key: 'profitFactor', label: 'Profit Factor' },
    { key: 'rMultiple',    label: 'R Multiple' },
    { key: 'symbol',       label: 'Symbol' },
    { key: 'screenshot',   label: 'Screenshot' },
    { key: 'notes',        label: 'Notes' },
    { key: 'edgeLogo',     label: 'EDGE Logo' },
  ]

  return (
    <AppFrame>
      <div className="page-fade">
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:24 }}>
          <div>
            <div className="page-title">Share Card</div>
            <div className="page-sub">Create shareable trade cards · watermark always included</div>
          </div>
          <button className="btn btn-primary" onClick={download} style={{ padding:'10px 24px', fontSize:13 }}>↓ Download PNG</button>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'300px 1fr', gap:20, alignItems:'start' }}>
          {/* CONTROLS */}
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>

            {/* Card type */}
            <div className="card">
              <label style={lbl}>Card Type</label>
              <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                {[{ id:'day' as CardType, label:'Day Summary', desc:"Today's P&L and stats" }, { id:'summary' as CardType, label:'Period Summary', desc:'Week/month overview' }, { id:'trade' as CardType, label:'Single Trade', desc:'One trade with screenshot' }].map(ct => (
                  <button key={ct.id} onClick={() => setCardType(ct.id)} style={{ padding:'10px 14px', borderRadius:8, cursor:'pointer', fontFamily:'inherit', border:`1px solid ${cardType===ct.id?'var(--accent)':'var(--border)'}`, background:cardType===ct.id?'rgba(124,111,205,0.1)':'var(--bg3)', color:cardType===ct.id?'var(--accent)':'var(--muted)', textAlign:'left' }}>
                    <div style={{ fontWeight:700, fontSize:13 }}>{ct.label}</div>
                    <div style={{ fontSize:11, opacity:.7, marginTop:2 }}>{ct.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Trade options */}
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
              <div className="card" style={{ display:'flex', flexDirection:'column', gap:12 }}>
                <div>
                  <label style={lbl}>Select Trade</label>
                  <select className="form-input" value={selectedTradeId} onChange={e => setSelectedTradeId(e.target.value)}>
                    {sortedTrades.map(t => (
                      <option key={t.id} value={t.id}>{t.date?.slice(5)} · {t.ticker} · {(t.pnl||0)>=0?'+':''}${Math.abs(t.pnl||0).toFixed(2)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={lbl}>Big Number Shows</label>
                  <div style={{ display:'flex', gap:6 }}>
                    {([['pnl','P&L $'],['rr','R Multiple']] as [BigStat,string][]).map(([s,l]) => (
                      <button key={s} onClick={() => setBigStat(s)} style={{ flex:1, padding:'8px', borderRadius:8, cursor:'pointer', fontFamily:'inherit', border:`1px solid ${bigStat===s?'var(--accent)':'var(--border)'}`, background:bigStat===s?'rgba(124,111,205,0.1)':'var(--bg3)', color:bigStat===s?'var(--accent)':'var(--muted)', fontSize:12, fontWeight:700 }}>{l}</button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Layout */}
            <div className="card">
              <label style={lbl}>Layout</label>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
                {LAYOUTS.map(l => (
                  <button key={l.id} onClick={() => setLayout(l.id)} style={{ padding:'8px', borderRadius:8, cursor:'pointer', fontFamily:'inherit', border:`1px solid ${layout===l.id?'var(--accent)':'var(--border)'}`, background:layout===l.id?'rgba(124,111,205,0.1)':'var(--bg3)', color:layout===l.id?'var(--accent)':'var(--muted)', fontSize:12, fontWeight:600, textAlign:'center' }}>
                    <div>{l.icon}</div><div style={{ marginTop:2 }}>{l.label}</div><div style={{ fontSize:9, opacity:.6 }}>{l.w}×{l.h}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Theme */}
            <div className="card">
              <label style={lbl}>Theme</label>
              <div style={{ display:'flex', gap:8 }}>
                {(['dark','green','purple'] as ThemeKey[]).map(t => (
                  <button key={t} onClick={() => setTheme(t)} style={{ flex:1, padding:'8px', borderRadius:8, cursor:'pointer', fontFamily:'inherit', background:THEMES[t].bg, border:`2px solid ${theme===t?THEMES[t].accent:'rgba(255,255,255,0.1)'}`, color:theme===t?THEMES[t].accent:THEMES[t].muted, fontSize:11, fontWeight:700 }}>
                    {t==='dark'?'🌑 Dark':t==='green'?'💚 Green':'💜 Purple'}
                  </button>
                ))}
              </div>
            </div>

            {/* Visibility */}
            <div className="card">
              <label style={lbl}>Show / Hide</label>
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {visToggles.map(({key,label}) => (
                  <label key={key} style={{ display:'flex', alignItems:'center', gap:10, cursor:'pointer', fontSize:13, color:vis[key]?'var(--text)':'var(--muted)' }}>
                    <div onClick={() => toggleVis(key)} style={{ width:36, height:20, borderRadius:10, position:'relative', cursor:'pointer', flexShrink:0, background:vis[key]?'var(--accent)':'var(--bg4)', transition:'background .2s' }}>
                      <div style={{ position:'absolute', top:3, left:vis[key]?17:3, width:14, height:14, borderRadius:'50%', background:'#fff', transition:'left .2s' }} />
                    </div>
                    {label}
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* PREVIEW */}
          <div style={{ display:'flex', flexDirection:'column', gap:12, alignItems:'center' }}>
            <div style={{ fontSize:11, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'.08em' }}>Preview</div>
            <div style={{ background:'repeating-conic-gradient(#1a1a2a 0% 25%, #111118 0% 50%) 0 0 / 20px 20px', borderRadius:16, padding:24 }}>
              <canvas ref={canvasRef} style={{ display:'block', borderRadius:12, maxWidth:'100%', maxHeight:'65vh', objectFit:'contain', boxShadow:'0 4px 32px rgba(0,0,0,0.6)' }} />
            </div>
            <button className="btn btn-primary" onClick={download} style={{ padding:'12px 32px', fontSize:14 }}>↓ Download PNG</button>
            <div style={{ fontSize:11, color:'var(--muted)', textAlign:'center' }}>Watermark always included · Instagram · Twitter/X · Discord</div>
          </div>
        </div>
      </div>
    </AppFrame>
  )
}
